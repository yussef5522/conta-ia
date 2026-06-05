// Detecção heurística de transferências entre contas da MESMA empresa.
//
// Contexto real (Yussef): 13 academias × 3-4 contas cada, transferências
// frequentes entre contas (PIX hoje predomina, TED minoritário).
//
// Estratégia em 2 níveis de confiança:
//
//   NÍVEL ALTO (≥0.90) → mesma data + mesmo valor abs + sinais opostos
//     → provável PIX (instantâneo, mesmo dia)
//     → UI pode oferecer "auto-parear" (1 clique)
//
//   NÍVEL MÉDIO (0.70-0.89) → D ou D+1 + mesmo valor abs + sinais opostos
//     → provável TED (D+1 quando feita após 16h)
//     → UI pede confirmação
//
//   BOOST → descrição contém PIX/TED/TRANSF/etc → +0.05 a +0.10
//
// Threshold pra sugerir: ≥ 0.70. Abaixo disso, não vira sugestão.
// Threshold pra auto-pair (decisão UI, não desta lib): ≥ 0.90.

export interface OfxCandidateTransaction {
  // ID temporário do preview (não persistido ainda) ou ID real após import.
  id: string
  description: string
  // amount sempre positivo; sinal vem do type (CREDIT=entrada, DEBIT=saída).
  amount: number
  type: 'CREDIT' | 'DEBIT' | string
  date: Date
}

export interface AccountTransactionsBundle {
  accountId: string
  accountName: string
  transactions: OfxCandidateTransaction[]
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM'
export type SuggestedAction = 'AUTO_PAIR' | 'CONFIRM' | 'IGNORE'

// Snapshot dos 2 lados pra UI mostrar lado-a-lado (data/valor/descrição completos).
export interface TransferSideSnapshot {
  transactionId: string
  accountId: string
  date: Date
  amount: number
  description: string
}

// Evidência granular (substitui parsing da string `reason` na UI).
export interface TransferEvidence {
  sameDay: boolean
  deltaDays: number
  amountExact: boolean // sempre true hoje (já filtrado antes), mas explícito p/ UI
  keywordMatched: string | null // 'PIX' | 'TED' | 'TRANSF...' | null
}

export interface TransferCandidate {
  fromTransactionId: string
  toTransactionId: string
  fromAccountId: string
  toAccountId: string
  confidence: number // 0-1
  confidenceLevel: ConfidenceLevel
  reason: string
  suggestedAction: SuggestedAction
  // Snapshots dos 2 lados (saída + entrada) para card 2-col na UI.
  from: TransferSideSnapshot
  to: TransferSideSnapshot
  evidence: TransferEvidence
}

export interface DetectTransferResult {
  candidates: TransferCandidate[]
}

// Regex pra detectar palavras-chave de transferência na descrição
const TRANSFER_KEYWORDS = /\b(PIX|TED|DOC|TRANSF(?:ERENCIA|ER[EÊ]NCIA)?|ENTRE\s+CONTAS)\b/i

// Boost por keyword: +0.10 se PIX/TED, +0.05 pra outros transfer hints
function keywordBoost(description: string): { boost: number; matched: string | null } {
  const match = description.match(TRANSFER_KEYWORDS)
  if (!match) return { boost: 0, matched: null }
  const upper = match[0].toUpperCase()
  if (upper === 'PIX' || upper.startsWith('TED')) {
    return { boost: 0.1, matched: upper }
  }
  return { boost: 0.05, matched: upper }
}

// Confiança base por proximidade de data:
//   - mesmo dia → 0.90
//   - D+1 → 0.75
//   - >1 dia → 0 (não sugere)
function baseConfidenceByDateDelta(deltaDays: number): { base: number; level: ConfidenceLevel | null } {
  if (deltaDays === 0) return { base: 0.9, level: 'HIGH' }
  if (deltaDays === 1) return { base: 0.75, level: 'MEDIUM' }
  return { base: 0, level: null }
}

function diffInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  // Normaliza pra meia-noite local pra evitar problemas de timezone/hora
  const dayA = Math.floor(a.getTime() / MS_PER_DAY)
  const dayB = Math.floor(b.getTime() / MS_PER_DAY)
  return Math.abs(dayA - dayB)
}

function actionForConfidence(c: number): SuggestedAction {
  if (c >= 0.9) return 'AUTO_PAIR'
  if (c >= 0.7) return 'CONFIRM'
  return 'IGNORE'
}

// Detecta candidatos de transferência olhando UMA transação por vez (a que está
// sendo importada via OFX preview) e comparando contra TODAS as transações
// existentes nas OUTRAS contas da mesma empresa.
//
// Importante: a função NÃO consulta DB — recebe tudo já carregado.
// Caller (rota OFX preview) é responsável por buscar `outrasContasDaEmpresa`
// num range de data razoável (±7 dias da transação sendo importada).
export function detectarTransferenciasNoPreview(
  transacoesNovas: OfxCandidateTransaction[],
  outrasContasDaEmpresa: AccountTransactionsBundle[],
  contaSendoImportada: { id: string; name: string },
): DetectTransferResult {
  const candidates: TransferCandidate[] = []

  // Pre-index: junta TODAS as transações das outras contas com referência da conta
  type IndexedTx = OfxCandidateTransaction & {
    accountId: string
    accountName: string
  }
  const otherTxs: IndexedTx[] = []
  for (const bundle of outrasContasDaEmpresa) {
    if (bundle.accountId === contaSendoImportada.id) continue
    for (const tx of bundle.transactions) {
      otherTxs.push({
        ...tx,
        accountId: bundle.accountId,
        accountName: bundle.accountName,
      })
    }
  }

  for (const txNova of transacoesNovas) {
    for (const txOutra of otherTxs) {
      // 1. Mesmo valor absoluto (tolerância de 1 centavo pra rounding errors)
      if (Math.abs(txNova.amount - txOutra.amount) > 0.01) continue

      // 2. Sinais opostos (CREDIT ↔ DEBIT). TRANSFER já pareada não vira candidato.
      const opposite =
        (txNova.type === 'CREDIT' && txOutra.type === 'DEBIT') ||
        (txNova.type === 'DEBIT' && txOutra.type === 'CREDIT')
      if (!opposite) continue

      // 3. Proximidade de data
      const delta = diffInDays(txNova.date, txOutra.date)
      const { base, level } = baseConfidenceByDateDelta(delta)
      if (!level) continue

      // 4. Boost por keyword (olha as 2 descrições — qualquer uma menciona transfer)
      const boostNova = keywordBoost(txNova.description)
      const boostOutra = keywordBoost(txOutra.description)
      const boost = Math.max(boostNova.boost, boostOutra.boost)
      const matchedKw = boostNova.matched ?? boostOutra.matched

      const confidence = Math.min(1, base + boost)

      // 5. Threshold pra virar sugestão
      if (confidence < 0.7) continue

      // Direção: quem é "from" (saída) e quem é "to" (entrada)?
      // Saída = DEBIT (sai de uma conta); Entrada = CREDIT (chega na outra).
      const fromIsNova = txNova.type === 'DEBIT'
      const fromTx = fromIsNova ? txNova : txOutra
      const toTx = fromIsNova ? txOutra : txNova
      const fromAccountId = fromIsNova ? contaSendoImportada.id : txOutra.accountId
      const toAccountId = fromIsNova ? txOutra.accountId : contaSendoImportada.id

      const reasonParts: string[] = []
      reasonParts.push(delta === 0 ? 'Mesmo dia' : `D+${delta}`)
      reasonParts.push('valor exato')
      if (matchedKw) reasonParts.push(`descrição contém "${matchedKw}"`)

      candidates.push({
        fromTransactionId: fromTx.id,
        toTransactionId: toTx.id,
        fromAccountId,
        toAccountId,
        confidence: roundTo2(confidence),
        confidenceLevel: confidence >= 0.9 ? 'HIGH' : level,
        reason: reasonParts.join(' + '),
        suggestedAction: actionForConfidence(confidence),
        from: {
          transactionId: fromTx.id,
          accountId: fromAccountId,
          date: fromTx.date,
          amount: fromTx.amount,
          description: fromTx.description,
        },
        to: {
          transactionId: toTx.id,
          accountId: toAccountId,
          date: toTx.date,
          amount: toTx.amount,
          description: toTx.description,
        },
        evidence: {
          sameDay: delta === 0,
          deltaDays: delta,
          amountExact: true,
          keywordMatched: matchedKw,
        },
      })
    }
  }

  // Ordena por confiança desc (UI mostra melhores primeiro)
  candidates.sort((a, b) => b.confidence - a.confidence)

  return { candidates }
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}
