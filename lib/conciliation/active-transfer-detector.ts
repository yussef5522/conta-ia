// Sprint 5.0.2.t/u — Detector ATIVO de transferências cross-conta.
//
// Sprint t entregou versão lenient (só matching por valor + janela).
// Sprint u REESCREVEU com regras rígidas anti-falsos-positivos baseadas
// nos 11 candidatos falsos do Cacula Mix:
//
//   ❌ Pix Cristian -100 ↔ Pix Daniela +100 (pessoas distintas)
//   ❌ Pix -20.000 ↔ OP. CRÉDITO C/GARANTIA +20.000 (empréstimo)
//   ❌ Pix -1.000 GHOST AGENCIA ↔ OP. CRÉDITO +1.000 (pagamento + empréstimo)
//   ❌ Pix -500 Fernanda ↔ DEP DINHEIRO ATM +500 (depósito espécie)
//
// REGRAS RÍGIDAS:
//   1. AMBAS pernas devem ter padrão PIX (descarta TED/DOC/Depósito por ora)
//   2. NENHUMA perna pode bater blacklist (OP CRÉDITO, EMPRÉSTIMO,
//      DEP DINHEIRO, TARIFA, JUROS, etc)
//   3. CNPJ check: se descrição tem CNPJ formatado, deve ser da empresa
//      (rejeita CNPJ de terceiros)
//   4. Anti-pessoa: se AMBAS descrições mostram nome de pessoa terceira
//      E nenhuma tem CNPJ próprio, rejeita
//   5. Valor comum: se mesmo valor aparece 3+ vezes em 60 dias, baixa
//      confidence (provavelmente coincidência)
//   6. Threshold mínimo 0.85 pra ser candidato (era 0.70 na Sprint t)
//
// Confidence final:
//   - Base 0.70
//   - +0.20 quando CNPJ próprio detectado em alguma perna (= 0.90)
//   - +0.05 quando same-day (até 0.95)
//   - -0.20 quando valor comum (penalidade)
//
// Auto-apply: caller decide threshold (recomendado ≥ 0.95).

import { prisma } from '@/lib/db'

// ──────────────────────────────────────────────────────────────────────────
// CONSTANTES — Heurísticas anti-falso-positivo
// ──────────────────────────────────────────────────────────────────────────

/** Descrições que GARANTIDAMENTE não são transferência interna. */
const BLACKLIST_DESCRIPTIONS: ReadonlyArray<string> = [
  // Empréstimos/Crédito bancário
  'OP. CRÉDITO',
  'OP CREDITO',
  'OP. CREDITO',
  'OPERACAO CREDITO',
  'OPERAÇÃO CRÉDITO',
  'EMPRÉSTIMO',
  'EMPRESTIMO',
  'FINANCIAMENTO',
  'CHEQUE ESPECIAL',
  'CRED ROTATIVO',
  // Depósito em espécie / caixa eletrônico
  'DEP DINHEIRO',
  'DEPOSITO DINHEIRO',
  'DEPOSITO ATM',
  'DEP ATM',
  // Operações bancárias
  'TARIFA',
  'TAXA BANCARIA',
  'TAXA BANCÁRIA',
  'IOF',
  'JUROS',
  'PAGAMENTO BOLETO',
  'PAGAMENTO TRIBUTO',
  'DARF',
  'DAS ',
  'INSS',
  'FGTS',
  // Investimentos
  'INVESTIMENTO',
  'APLICAÇÃO',
  'APLICACAO',
  'RESGATE',
  // Cobrança
  'COBRANÇA',
  'COBRANCA',
]

/** Padrões que identificam DEBIT como PIX enviado. */
const PIX_DEB_PATTERNS: ReadonlyArray<string> = [
  'PIX_DEB',
  'PIX-DEB',
  'PIX-PIX_DEB',
  'PIX ENVIADO',
  'PIX BANRISUL ENVIADO',
  'PIX TRANSFERIDO',
  'PAGAMENTO PIX',
]

/** Padrões que identificam CREDIT como PIX recebido. */
const PIX_CRED_PATTERNS: ReadonlyArray<string> = [
  'PIX_CRED',
  'PIX-CRED',
  'PIX-PIX_CRED',
  'PIX RECEBIDO',
  'RECEBIMENTO PIX',
]

// ──────────────────────────────────────────────────────────────────────────
// Helpers PUROS (testáveis sem DB)
// ──────────────────────────────────────────────────────────────────────────

function upper(s: string | null | undefined): string {
  return (s ?? '').toUpperCase()
}

export function isPixDebitDesc(description: string | null | undefined): boolean {
  const desc = upper(description)
  if (!desc) return false
  return PIX_DEB_PATTERNS.some((p) => desc.includes(p))
}

export function isPixCreditDesc(description: string | null | undefined): boolean {
  const desc = upper(description)
  if (!desc) return false
  return PIX_CRED_PATTERNS.some((p) => desc.includes(p))
}

export function isBlacklistedDesc(description: string | null | undefined): boolean {
  const desc = upper(description)
  if (!desc) return false
  return BLACKLIST_DESCRIPTIONS.some((b) => desc.includes(b))
}

/** Extrai 1ª sequência de 14 dígitos da descrição (CNPJ não formatado). */
function extractRawCnpj(description: string | null | undefined): string | null {
  if (!description) return null
  const digits = description.replace(/\D/g, '')
  const match = digits.match(/\d{14}/)
  return match ? match[0] : null
}

/** Confere se descrição contém o CNPJ informado (em qualquer formato). */
export function descContainsCnpj(
  description: string | null | undefined,
  cnpj: string,
): boolean {
  if (!description) return false
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  if (cnpjLimpo.length !== 14) return false
  const descDigits = description.replace(/\D/g, '')
  return descDigits.includes(cnpjLimpo)
}

/**
 * Heurística pra detectar nome próprio de PESSOA na descrição.
 * Sinais:
 *   - CPF (11 dígitos isolados de 14)
 *   - Pelo menos 2 palavras com 4+ letras seguidas (típico de NOMES — PEDRO SILVA)
 */
export function hasPersonName(description: string | null | undefined): boolean {
  const desc = upper(description)
  if (!desc) return false

  // CPF formatado XXX.XXX.XXX-XX
  if (/\d{3}\.\d{3}\.\d{3}-?\d{2}/.test(desc)) return true

  // CPF não formatado (11 dígitos isolados)
  // Atenção: também aceita 11 dígitos dentro de seq maior, então só conta
  // se NÃO houver CNPJ (14 dígitos) nas redondezas
  const has14 = /\d{14}/.test(desc.replace(/\D/g, ''))
  if (!has14 && /(?:^|\D)\d{11}(?:\D|$)/.test(desc.replace(/[.\-/]/g, ''))) {
    return true
  }

  // Padrão: 2+ palavras com 4+ letras (sem dígitos), sequenciais
  // ex: "PEDRO SILVA", "MARIA DA CONCEICAO"
  const palavras = desc
    .replace(/[^\wÀ-Ú\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
  let nomeSeq = 0
  for (const p of palavras) {
    // palavra de 4+ letras só (sem dígitos)
    if (p.length >= 4 && /^[A-ZÀ-Ú]+$/i.test(p)) {
      nomeSeq++
      if (nomeSeq >= 2) return true
    } else {
      nomeSeq = 0
    }
  }
  return false
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

function daysBetween(a: Date, b: Date): number {
  const ONE_DAY = 86400000
  return Math.abs(Math.round((a.getTime() - b.getTime()) / ONE_DAY))
}

// ──────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO RÍGIDA — função PURA exportada pra reuso (cleanup + tests)
// ──────────────────────────────────────────────────────────────────────────

export interface ValidationInput {
  debit: { description: string | null; date: Date; paymentDate: Date | null }
  credit: { description: string | null; date: Date; paymentDate: Date | null }
  companyCnpj: string
  /** Quando true, aplica penalidade -0.20 ao confidence. */
  valorComum?: boolean
}

export interface ValidationResult {
  valid: boolean
  /** Motivo de rejeição (null quando valid=true). */
  reason: string | null
  confidence: number
  /** Sinais detectados pra UI mostrar contexto. */
  signals: {
    debitContainsOwnCnpj: boolean
    creditContainsOwnCnpj: boolean
    debitHasPerson: boolean
    creditHasPerson: boolean
    debitForeignCnpj: boolean
    creditForeignCnpj: boolean
    valorComum: boolean
  }
}

export function validateTransferPair(input: ValidationInput): ValidationResult {
  const { debit, credit, companyCnpj } = input

  const debitContainsOwnCnpj = descContainsCnpj(debit.description, companyCnpj)
  const creditContainsOwnCnpj = descContainsCnpj(credit.description, companyCnpj)
  const debitRawCnpj = extractRawCnpj(debit.description)
  const creditRawCnpj = extractRawCnpj(credit.description)
  const debitForeignCnpj = !!debitRawCnpj && !debitContainsOwnCnpj
  const creditForeignCnpj = !!creditRawCnpj && !creditContainsOwnCnpj
  const debitHasPerson = hasPersonName(debit.description)
  const creditHasPerson = hasPersonName(credit.description)
  const valorComum = !!input.valorComum

  const signals = {
    debitContainsOwnCnpj,
    creditContainsOwnCnpj,
    debitHasPerson,
    creditHasPerson,
    debitForeignCnpj,
    creditForeignCnpj,
    valorComum,
  }

  // REGRA 1: AMBAS pernas devem ter padrão PIX
  if (!isPixDebitDesc(debit.description)) {
    return {
      valid: false,
      reason: 'Débito não é PIX (apenas PIX é aceito como transferência interna)',
      confidence: 0,
      signals,
    }
  }
  if (!isPixCreditDesc(credit.description)) {
    return {
      valid: false,
      reason: 'Crédito não é PIX (rejeita OP CRÉDITO, DEP DINHEIRO, etc)',
      confidence: 0,
      signals,
    }
  }

  // REGRA 2: Blacklist (defensiva — PIX pattern não deve casar com OP CRÉDITO,
  // mas garante em caso de descrições compostas)
  if (isBlacklistedDesc(debit.description)) {
    return {
      valid: false,
      reason: `Débito contém termo blacklisted (empréstimo/tarifa/imposto)`,
      confidence: 0,
      signals,
    }
  }
  if (isBlacklistedDesc(credit.description)) {
    return {
      valid: false,
      reason: `Crédito contém termo blacklisted (empréstimo/tarifa/imposto)`,
      confidence: 0,
      signals,
    }
  }

  // REGRA 3: CNPJ de terceiro NÃO pode estar
  if (debitForeignCnpj) {
    return {
      valid: false,
      reason: 'Débito menciona CNPJ de terceiro',
      confidence: 0,
      signals,
    }
  }
  if (creditForeignCnpj) {
    return {
      valid: false,
      reason: 'Crédito menciona CNPJ de terceiro',
      confidence: 0,
      signals,
    }
  }

  // REGRA 4: Anti-pessoa — ambas pernas com nome de pessoa terceira
  // e SEM CNPJ próprio → quase certo que são pagamentos distintos
  if (
    debitHasPerson &&
    creditHasPerson &&
    !debitContainsOwnCnpj &&
    !creditContainsOwnCnpj
  ) {
    return {
      valid: false,
      reason: 'Ambas pernas mencionam pessoas terceiras (pagamentos distintos)',
      confidence: 0,
      signals,
    }
  }

  // CONFIDENCE
  let confidence = 0.7 // base
  if (debitContainsOwnCnpj || creditContainsOwnCnpj) {
    confidence = 0.9 // CNPJ próprio em pelo menos uma perna
  }
  const debitDate = debit.paymentDate ?? debit.date
  const creditDate = credit.paymentDate ?? credit.date
  if (sameDay(debitDate, creditDate)) {
    confidence = Math.min(0.99, confidence + 0.05)
  }
  if (valorComum) {
    confidence = Math.max(0.5, confidence - 0.2)
  }

  return { valid: true, reason: null, confidence, signals }
}

// ──────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ──────────────────────────────────────────────────────────────────────────

export interface TransferCandidate {
  debit: {
    id: string
    description: string | null
    date: Date
    paymentDate: Date | null
    amount: number
    bankAccountId: string | null
    bankAccountName?: string
  }
  credit: {
    id: string
    description: string | null
    date: Date
    paymentDate: Date | null
    amount: number
    bankAccountId: string | null
    bankAccountName?: string
  }
  confidence: number
  matchType: 'EXACT_SAME_DAY' | 'EXACT_ADJACENT' | 'WITHIN_3DAYS'
  daysApart: number
  signals?: ValidationResult['signals']
}

export interface DetectOptions {
  daysWindow?: number
  minAmount?: number
  onlyPending?: boolean
  cap?: number
  /** Threshold mínimo pra retornar como candidato. Default: 0.85. */
  minConfidence?: number
}

const DEFAULT_DAYS_WINDOW = 3
const DEFAULT_CAP = 200
const DEFAULT_MIN_CONFIDENCE = 0.85

// ──────────────────────────────────────────────────────────────────────────
// BUSCA EM BATCH
// ──────────────────────────────────────────────────────────────────────────

export async function findActiveTransferCandidates(
  companyId: string,
  options: DetectOptions = {},
): Promise<TransferCandidate[]> {
  const daysWindow = options.daysWindow ?? DEFAULT_DAYS_WINDOW
  const cap = options.cap ?? DEFAULT_CAP
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE

  // 1. CNPJ da empresa (sem CNPJ não dá pra validar)
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { cnpj: true, setor: true },
  })
  if (!company?.cnpj) {
    console.warn(
      `[ActiveTransferDetector] Empresa ${companyId} sem CNPJ — não roda detector`,
    )
    return []
  }

  // 2. Contas (precisa de 2+ pra existir transferência interna)
  const contas = await prisma.bankAccount.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true },
  })
  if (contas.length < 2) return []
  const contaNomeById = new Map(contas.map((c) => [c.id, c.name]))

  // 3. Valores comuns (aparecem 3+ vezes em 60 dias) — geram penalidade
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
  const valoresPorContagem = await prisma.transaction.groupBy({
    by: ['amount'],
    where: {
      bankAccount: { companyId },
      date: { gte: sixtyDaysAgo },
    },
    _count: { _all: true },
  })
  const valoresComuns = new Set(
    valoresPorContagem.filter((v) => v._count._all >= 3).map((v) => v.amount),
  )

  // 4. DEBITs candidatos (já filtra blacklist no SQL via contains seria caro;
  // filtra em memória pelo padrão PIX)
  const debits = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId, isActive: true },
      type: 'DEBIT',
      transferGroupId: null,
      ...(options.onlyPending ? { status: 'PENDING' } : {}),
      ...(options.minAmount && options.minAmount > 0
        ? { amount: { gte: options.minAmount } }
        : {}),
      lifecycle: 'EFFECTED',
    },
    select: {
      id: true,
      description: true,
      date: true,
      paymentDate: true,
      amount: true,
      bankAccountId: true,
    },
    orderBy: { date: 'desc' },
    take: cap * 5, // pega mais pra ter folga de filtragem
  })

  const candidates: TransferCandidate[] = []

  for (const debit of debits) {
    if (!debit.bankAccountId) continue
    if (candidates.length >= cap) break

    // PRE-FILTROS (rápidos antes de bater no DB)
    if (!isPixDebitDesc(debit.description)) continue
    if (isBlacklistedDesc(debit.description)) continue

    const debitRawCnpj = extractRawCnpj(debit.description)
    if (debitRawCnpj && !descContainsCnpj(debit.description, company.cnpj)) {
      continue // CNPJ de terceiro
    }

    const debitDate = debit.paymentDate ?? debit.date
    const dataMin = new Date(debitDate)
    dataMin.setDate(dataMin.getDate() - daysWindow)
    const dataMax = new Date(debitDate)
    dataMax.setDate(dataMax.getDate() + daysWindow)

    const credits = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId, isActive: true },
        type: 'CREDIT',
        amount: debit.amount,
        bankAccountId: { not: debit.bankAccountId },
        transferGroupId: null,
        lifecycle: 'EFFECTED',
        OR: [
          { paymentDate: { gte: dataMin, lte: dataMax } },
          {
            paymentDate: null,
            date: { gte: dataMin, lte: dataMax },
          },
        ],
      },
      select: {
        id: true,
        description: true,
        date: true,
        paymentDate: true,
        amount: true,
        bankAccountId: true,
      },
    })

    if (credits.length === 0) continue

    // Aplica validação RÍGIDA em cada candidato
    const valorComum = valoresComuns.has(debit.amount)
    const validatedHits = credits
      .map((credit) => ({
        credit,
        validation: validateTransferPair({
          debit,
          credit,
          companyCnpj: company.cnpj,
          valorComum,
        }),
      }))
      .filter((v) => v.validation.valid && v.validation.confidence >= minConfidence)

    // ÚNICO match (ambiguidade rejeita)
    if (validatedHits.length === 0) continue
    if (validatedHits.length > 1) {
      console.warn(
        `[ActiveTransferDetector] Múltiplos matches válidos pra debit=${debit.id} — skip`,
      )
      continue
    }

    const { credit, validation } = validatedHits[0]
    const creditDate = credit.paymentDate ?? credit.date
    const dApart = daysBetween(creditDate, debitDate)
    const matchType: TransferCandidate['matchType'] = sameDay(debitDate, creditDate)
      ? 'EXACT_SAME_DAY'
      : dApart === 1
        ? 'EXACT_ADJACENT'
        : 'WITHIN_3DAYS'

    candidates.push({
      debit: {
        ...debit,
        bankAccountName: contaNomeById.get(debit.bankAccountId),
      },
      credit: {
        ...credit,
        bankAccountName: credit.bankAccountId
          ? contaNomeById.get(credit.bankAccountId)
          : undefined,
      },
      confidence: validation.confidence,
      matchType,
      daysApart: dApart,
      signals: validation.signals,
    })
  }

  // Ordena por confidence desc → valor desc
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.debit.amount - a.debit.amount
  })

  return candidates
}

// ──────────────────────────────────────────────────────────────────────────
// APPLY / REVERT
// ──────────────────────────────────────────────────────────────────────────

export async function applyTransferCandidate(
  candidate: TransferCandidate,
): Promise<{ ok: true; transferGroupId: string }> {
  const transferGroupId = `tx_${candidate.debit.id}_${candidate.credit.id}`

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: candidate.debit.id },
      data: {
        transferGroupId,
        type: 'TRANSFER',
        status: 'RECONCILED',
        classificationSource: 'AI',
        aiConfidence: candidate.confidence,
      },
    }),
    prisma.transaction.update({
      where: { id: candidate.credit.id },
      data: {
        transferGroupId,
        type: 'TRANSFER',
        status: 'RECONCILED',
        classificationSource: 'AI',
        aiConfidence: candidate.confidence,
      },
    }),
  ])

  return { ok: true, transferGroupId }
}
