// Sprint Trava-Permanente (16/06/2026) — monitor de órfãos.
//
// Função reutilizável que conta tx no ESTADO PROIBIDO:
//   lifecycle = 'EFFECTED'
//   AND bankAccountId IS NULL
//   AND cashCoded = false
//   AND reconciledWithId IS NULL
//   AND type != 'TRANSFER'
//
// Esse universo SEMPRE deve ser 0. Usado em:
//   - Teste E2E pós-deploy (gate "monitor=0")
//   - Smoke periódico (cron futuro, alerta se !=0)
//   - Dashboard de saúde interno
//
// CHECK constraint do Postgres impede criação direta, mas script de migração
// ou bug futuro pode bypassar — função é a 2ª linha de defesa.

import type { PrismaClient } from '@prisma/client'

export interface OrphanRow {
  id: string
  description: string
  amount: number
  date: Date
  origin: string
  type: string
  status: string
  /** companyId resolvido via bankAccount/category/supplier (best-effort). */
  companyId: string | null
}

export interface OrphanCount {
  count: number
  totalAmount: number
}

/**
 * Conta tx em estado proibido (EFFECTED + bankNull + !cashCoded + !reconciled + !TRANSFER).
 *
 * Quando `companyId` é passado, restringe via OR (bankAccount/category/supplier).
 * Sem `companyId`, conta global.
 */
export async function countOrphanEffected(
  prisma: PrismaClient,
  companyId?: string,
): Promise<OrphanCount> {
  const baseWhere = {
    lifecycle: 'EFFECTED',
    bankAccountId: null,
    cashCoded: false,
    reconciledWithId: null,
    type: { not: 'TRANSFER' },
  } as const

  const where = companyId
    ? {
        ...baseWhere,
        OR: [
          { bankAccount: { companyId } },
          { category: { companyId } },
          { supplier: { companyId } },
        ],
      }
    : baseWhere

  const [count, sum] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    }),
  ])

  return {
    count,
    totalAmount: sum._sum.amount ?? 0,
  }
}

/**
 * Lista detalhada (até `limit`) das tx em estado proibido. Pra debugging.
 */
export async function listOrphanEffected(
  prisma: PrismaClient,
  options: { companyId?: string; limit?: number } = {},
): Promise<OrphanRow[]> {
  const { companyId, limit = 50 } = options
  const baseWhere = {
    lifecycle: 'EFFECTED',
    bankAccountId: null,
    cashCoded: false,
    reconciledWithId: null,
    type: { not: 'TRANSFER' },
  } as const

  const where = companyId
    ? {
        ...baseWhere,
        OR: [
          { bankAccount: { companyId } },
          { category: { companyId } },
          { supplier: { companyId } },
        ],
      }
    : baseWhere

  const rows = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      origin: true,
      type: true,
      status: true,
      bankAccount: { select: { companyId: true } },
      category: { select: { companyId: true } },
      supplier: { select: { companyId: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount: r.amount,
    date: r.date,
    origin: r.origin,
    type: r.type,
    status: r.status,
    companyId:
      r.bankAccount?.companyId ?? r.category?.companyId ?? r.supplier?.companyId ?? null,
  }))
}
