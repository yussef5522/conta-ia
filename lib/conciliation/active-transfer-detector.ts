// Sprint 5.0.2.t — Detector ATIVO de transferências cross-conta.
//
// Diferente do matchSameCompanyTransfer (Sprint j, que processa 1 tx por
// chamada exigindo keyword Pix), este detector:
//   1. Roda em BATCH sobre TODAS as DEBITs não-conciliadas da empresa
//   2. Pra cada DEBIT busca CREDIT pareada em OUTRA conta com:
//      - Mesmo valor (tolerância 0)
//      - Janela ±3 dias
//      - Status PENDING ou RECONCILED (ignora IGNORED/CANCELED)
//   3. Só sugere quando match é ÚNICO (zero ambiguidade)
//   4. Caller decide: preview vs apply em batch
//
// Confidence dinâmica:
//   - 0.95 same-day
//   - 0.85 D±1
//   - 0.70 D±2..3

import { prisma } from '@/lib/db'

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
}

export interface DetectOptions {
  /** Janela em dias pra busca. Default: 3. */
  daysWindow?: number
  /** Valor mínimo (R$). Default: 0 (qualquer). Útil pra filtrar tarifas pequenas. */
  minAmount?: number
  /** Se true, só busca em tx PENDING (não mexe em conciliadas). Default: false. */
  onlyPending?: boolean
  /** Máximo de candidatos retornados. Default: 200. */
  cap?: number
}

const DEFAULT_DAYS_WINDOW = 3
const DEFAULT_CAP = 200

function effectiveDate(tx: { date: Date; paymentDate: Date | null }): Date {
  return tx.paymentDate ?? tx.date
}

function isSameDay(a: Date, b: Date): boolean {
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

/**
 * Acha candidatos de transferência interna na empresa.
 * Não modifica nada — apenas retorna pares.
 */
export async function findActiveTransferCandidates(
  companyId: string,
  options: DetectOptions = {},
): Promise<TransferCandidate[]> {
  const daysWindow = options.daysWindow ?? DEFAULT_DAYS_WINDOW
  const cap = options.cap ?? DEFAULT_CAP

  // 1. Lista contas ativas da empresa
  const contas = await prisma.bankAccount.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true },
  })
  if (contas.length < 2) return []
  const contaNomeById = new Map(contas.map((c) => [c.id, c.name]))

  // 2. Lista DEBITs candidatas (não já conciliadas como transferência)
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
    take: cap * 2, // pega mais — alguns vão filtrar
  })

  const candidates: TransferCandidate[] = []

  for (const debit of debits) {
    if (!debit.bankAccountId) continue
    if (candidates.length >= cap) break

    const debitDate = effectiveDate(debit)
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
    // AMBIGUIDADE: pula se houver mais de 1 candidato pra evitar marcação errada
    if (credits.length > 1) continue

    const credit = credits[0]
    const creditDate = effectiveDate(credit)
    const daysApart = daysBetween(creditDate, debitDate)

    const sameDay = isSameDay(creditDate, debitDate)
    const adjacent = daysApart === 1
    const confidence = sameDay ? 0.95 : adjacent ? 0.85 : 0.7
    const matchType: TransferCandidate['matchType'] = sameDay
      ? 'EXACT_SAME_DAY'
      : adjacent
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
      confidence,
      matchType,
      daysApart,
    })
  }

  // Ordena: confidence desc → valor desc
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.debit.amount - a.debit.amount
  })

  return candidates
}

/**
 * Aplica match: marca par via transferGroupId compartilhado, status RECONCILED,
 * type=TRANSFER. Atomic (prisma.$transaction).
 *
 * NÃO checa idempotência aqui — caller é responsável por não chamar 2x
 * pro mesmo par. Update tolera no-op (se já está TRANSFER).
 */
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
