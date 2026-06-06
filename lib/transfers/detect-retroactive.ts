// Sprint Central de Transferências — varredura retroativa.
//
// Diferente da detecção do IMPORT OFX (lib/ofx/detect-transfer.ts), que cruza
// o preview com tx existentes ±7 dias, a retroativa cruza TODAS as tx órfãs
// (transferGroupId IS NULL + transferDismissedAt IS NULL) entre contas da
// mesma empresa, com threshold mais alto (≥0.85) pra reduzir falso positivo.
//
// Produz 2 conjuntos:
//   - pairs:  candidatos a transferência (par com 2 lados encontrados)
//   - lonely: tx órfãs que TÊM sinais de transferência mas sem par no
//             histórico (provavelmente esperando import do outro banco)
//
// Função PURA: caller passa as tx pré-carregadas. Testável sem DB.

import { extractOwnSignals, type OwnEntityRefs } from './own-entity-signals'

export interface TxForDetect {
  id: string
  bankAccountId: string
  bankAccountName: string
  date: Date
  type: 'CREDIT' | 'DEBIT' | string
  amount: number
  description: string
}

export interface PairCandidate {
  from: TxForDetect
  to: TxForDetect
  /** 0-1 */
  confidence: number
  /** ms entre as duas datas (>=0). 0 = mesmo dia */
  deltaMs: number
  /** Lista de evidências legíveis pt-BR pra UI mostrar */
  evidences: string[]
}

export interface LonelyTx {
  tx: TxForDetect
  /** Sinais de transferência detectados (sem par achado) */
  signals: {
    hasOwnCnpj: boolean
    hasOwnName: boolean
    hasOwnAccountName: boolean
    hasTransferKeyword: boolean
  }
  /** 1-4 (CNPJ + nome + conta + keyword) */
  signalCount: number
}

export interface RetroactiveResult {
  pairs: PairCandidate[]
  lonely: LonelyTx[]
}

// Threshold pra entrar em "Sugeridas" (Aba 2). Mais alto que import (0.70).
const PAIR_THRESHOLD = 0.85
// Janela de data (cobre transferências bancárias que demoram 1-2 dias)
const MAX_DELTA_DAYS = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000
// Tolerância de valor (1 centavo + margem de float precision pra rounding).
// Usar 0.015 pra cobrir casos como 8000.01 - 8000.00 = 0.00999999... (JS float).
const CENT_TOLERANCE = 0.015

// Keywords de transferência (NÃO inclui PIX puro pois apareceria em vendas;
// só termos que QUASE certamente são transferência interna). TED inclui
// porque transferência bancária explícita raramente é venda.
const TRANSFER_KEYWORDS =
  /\b(transfer[eê]ncia|transferencia|transf|entre\s+contas|pix[\s_-]*deb|pix[\s_-]*enviado|pix[\s_-]*recebido|envio\s+pix|pagamento\s+pix|ted|doc)\b/i
// Keyword puro PIX (boost menor pra evitar falso positivo de venda)
const SOFT_KEYWORDS = /\bpix\b/i

interface PairScoring {
  confidence: number
  evidences: string[]
}

function scorePair(
  a: TxForDetect,
  b: TxForDetect,
  refs: OwnEntityRefs,
): PairScoring {
  const evidences: string[] = []
  let score = 0

  // Mesma data, D+1, D+2, D+3. Pra D+3 + sinais fortes ainda passar de 0.85
  // (caso TED lenta entre bancos com CNPJ próprio), score base é generoso
  // mas escala com confiança crescente quanto mais perto.
  const deltaDays = Math.abs(a.date.getTime() - b.date.getTime()) / MS_PER_DAY
  if (deltaDays === 0) {
    score += 0.45
    evidences.push('Mesmo dia')
  } else if (deltaDays <= 1) {
    score += 0.35
    evidences.push('D+1')
  } else if (deltaDays <= 2) {
    score += 0.3
    evidences.push('D+2')
  } else if (deltaDays <= 3) {
    score += 0.3
    evidences.push('D+3')
  }

  // Valor exato (sempre verdade se chegou aqui, mas explícito pra evidência)
  score += 0.2
  evidences.push('Valor exato')

  // Sinais OWN-ENTITY (CNPJ próprio, nome empresa, nome conta) — aplicado nas
  // 2 descrições; pega o MELHOR (max) pra não inflar se ambos coincidem.
  const sigA = extractOwnSignals(a.description, refs)
  const sigB = extractOwnSignals(b.description, refs)
  const bestBoost = Math.max(sigA.scoreBoost, sigB.scoreBoost)
  score += bestBoost
  if (sigA.hasOwnCnpj || sigB.hasOwnCnpj) evidences.push('CNPJ próprio')
  if (sigA.hasOwnAccountName || sigB.hasOwnAccountName)
    evidences.push('Nome de outra conta')
  if (sigA.hasOwnName || sigB.hasOwnName) evidences.push('Nome da empresa')

  // Keyword de transferência forte
  const aHasStrong = TRANSFER_KEYWORDS.test(a.description)
  const bHasStrong = TRANSFER_KEYWORDS.test(b.description)
  if (aHasStrong || bHasStrong) {
    score += 0.1
    evidences.push('Palavra de transferência')
  } else {
    // Keyword soft (PIX/TED) só dá boost pequeno
    if (SOFT_KEYWORDS.test(a.description) || SOFT_KEYWORDS.test(b.description)) {
      score += 0.05
      evidences.push('Contém PIX/TED')
    }
  }

  return { confidence: Math.min(1, score), evidences }
}

/**
 * Varredura retroativa: cruza tx órfãs (DEBIT × CREDIT) entre contas
 * diferentes da empresa. Retorna pares com score ≥ 0.85 e tx sozinhas com
 * sinais fortes de transferência.
 *
 * Caller é responsável por:
 *   - Pré-carregar SÓ tx ÓRFÃS (transferGroupId IS NULL +
 *     transferDismissedAt IS NULL) da empresa
 *   - Filtrar por janela razoável (ex: últimos 12 meses) pra perf
 */
export function findRetroactivePairs(
  txs: TxForDetect[],
  refs: OwnEntityRefs,
): RetroactiveResult {
  // Separa DEBIT e CREDIT pra cruzar
  const debits: TxForDetect[] = []
  const credits: TxForDetect[] = []
  for (const tx of txs) {
    if (tx.type === 'DEBIT') debits.push(tx)
    else if (tx.type === 'CREDIT') credits.push(tx)
  }

  // Cruza pares: pra cada DEBIT, procura CREDIT com mesmo valor (±0.01),
  // conta diferente, data próxima (±3d). Pega o melhor par por DEBIT.
  const pairs: PairCandidate[] = []
  const usedTxIds = new Set<string>()

  for (const d of debits) {
    if (usedTxIds.has(d.id)) continue
    let best: PairCandidate | null = null
    for (const c of credits) {
      if (usedTxIds.has(c.id)) continue
      if (Math.abs(c.amount - d.amount) > CENT_TOLERANCE) continue
      if (c.bankAccountId === d.bankAccountId) continue
      const delta = Math.abs(c.date.getTime() - d.date.getTime()) / MS_PER_DAY
      if (delta > MAX_DELTA_DAYS) continue
      const scoring = scorePair(d, c, refs)
      if (scoring.confidence < PAIR_THRESHOLD) continue
      if (best === null || scoring.confidence > best.confidence) {
        best = {
          from: d,
          to: c,
          confidence: scoring.confidence,
          deltaMs: Math.abs(c.date.getTime() - d.date.getTime()),
          evidences: scoring.evidences,
        }
      }
    }
    if (best) {
      pairs.push(best)
      usedTxIds.add(best.from.id)
      usedTxIds.add(best.to.id)
    }
  }

  // Tx sozinhas: as que NÃO foram pareadas E têm sinais de transferência
  // (≥1 sinal forte: CNPJ/nome próprio/conta/keyword strong).
  const lonely: LonelyTx[] = []
  for (const tx of txs) {
    if (usedTxIds.has(tx.id)) continue
    const sig = extractOwnSignals(tx.description, refs)
    const hasTransferKeyword = TRANSFER_KEYWORDS.test(tx.description)
    const signals = {
      hasOwnCnpj: sig.hasOwnCnpj,
      hasOwnName: sig.hasOwnName,
      hasOwnAccountName: sig.hasOwnAccountName,
      hasTransferKeyword,
    }
    const signalCount =
      (signals.hasOwnCnpj ? 1 : 0) +
      (signals.hasOwnName ? 1 : 0) +
      (signals.hasOwnAccountName ? 1 : 0) +
      (signals.hasTransferKeyword ? 1 : 0)
    // Sozinha entra se tem ao menos 2 sinais OU 1 sinal MUITO forte (CNPJ).
    if (signals.hasOwnCnpj || signalCount >= 2) {
      lonely.push({ tx, signals, signalCount })
    }
  }

  // Ordena pairs por confidence desc; lonely por signalCount desc
  pairs.sort((a, b) => b.confidence - a.confidence)
  lonely.sort((a, b) => b.signalCount - a.signalCount)

  return { pairs, lonely }
}

export { PAIR_THRESHOLD, MAX_DELTA_DAYS }
