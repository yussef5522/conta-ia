// Sprint A-effected Fase 1 — GET /api/conciliacao/balance-check
//
// Compara saldo do SISTEMA (DRE realizado) vs saldo do BANCO (só OFX) e
// identifica heurística de duplicatas potenciais como causa provável da
// divergência.
//
// Estratégia:
//   - saldoBanco   = soma sinalizada (CREDIT−DEBIT) das tx origin=OFX
//                    lifecycle=EFFECTED
//   - saldoSistema = soma sinalizada das tx lifecycle=EFFECTED com
//                    reconciledWithId IS NULL (mesmo filtro da DRE realizada)
//   - diferenca    = saldoSistema - saldoBanco
//
// Quando todos os pares Excel↔OFX estão conciliados: Excel é filtrada
// (tem reconciledWithId), OFX mantém. saldoSistema == saldoBanco.
//
// Quando há duplicatas sem link: Excel E OFX ambos contam no sistema mas
// só OFX no banco. Diferença = duplicações.
//
// Heurística de "causas prováveis": SQL bruto contando tx Excel/Manual
// EFFECTED órfãs que têm par OFX no mesmo valor + janela ±5d.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  bankAccountId: z.string().cuid().optional(), // opcional: filtrar por conta específica
})

const TOLERANCE_OK = 1
const TOLERANCE_INFO = 100
const TOLERANCE_WARN = 10_000

function classifyDifference(absDiff: number): 'OK' | 'INFO' | 'WARN' | 'ERROR' {
  if (absDiff < TOLERANCE_OK) return 'OK'
  if (absDiff <= TOLERANCE_INFO) return 'INFO'
  if (absDiff <= TOLERANCE_WARN) return 'WARN'
  return 'ERROR'
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    // Filtro empresa: via bank_account.companyId direto pra OFX (que sempre
    // tem bankAccount), e via 4 OR fallback pra contabilidade do sistema.
    const companyScope = {
      OR: [
        { bankAccount: { companyId: data.empresaId } },
        { supplier: { companyId: data.empresaId } },
        { customer: { companyId: data.empresaId } },
        { category: { companyId: data.empresaId } },
      ],
    }
    const bankFilter = data.bankAccountId
      ? { bankAccountId: data.bankAccountId }
      : {}

    const [bankCredits, bankDebits, systemCredits, systemDebits] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: {
            origin: 'OFX',
            lifecycle: 'EFFECTED',
            type: 'CREDIT',
            isInternalTransfer: false,
            bankAccount: { companyId: data.empresaId },
            ...bankFilter,
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            origin: 'OFX',
            lifecycle: 'EFFECTED',
            type: 'DEBIT',
            isInternalTransfer: false,
            bankAccount: { companyId: data.empresaId },
            ...bankFilter,
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            lifecycle: 'EFFECTED',
            reconciledWithId: null,
            type: 'CREDIT',
            isInternalTransfer: false,
            AND: [companyScope],
            ...bankFilter,
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            lifecycle: 'EFFECTED',
            reconciledWithId: null,
            type: 'DEBIT',
            isInternalTransfer: false,
            AND: [companyScope],
            ...bankFilter,
          },
          _sum: { amount: true },
        }),
      ])

    const saldoBanco = (bankCredits._sum.amount ?? 0) - (bankDebits._sum.amount ?? 0)
    const saldoSistema =
      (systemCredits._sum.amount ?? 0) - (systemDebits._sum.amount ?? 0)
    const diferenca = saldoSistema - saldoBanco
    const absDiff = Math.abs(diferenca)
    const status = classifyDifference(absDiff)

    // Heurística de causas: count + soma de Excel/Manual EFFECTED órfão DEBIT
    // que têm par OFX no mesmo valor + janela ±5d.
    type DupRow = { qtd: bigint; valor: number | null }
    const duplicatas = await prisma.$queryRaw<DupRow[]>`
      SELECT
        COUNT(DISTINCT e.id)::bigint AS qtd,
        SUM(e.amount)::float AS valor
      FROM transactions e
      JOIN transactions o
        ON o.amount = e.amount
        AND ABS(EXTRACT(EPOCH FROM (o.date - COALESCE(e."paymentDate", e."dueDate", e.date))) / 86400) <= 5
        AND o.id != e.id
        AND o.origin = 'OFX'
        AND o.type = e.type
        AND o."reconciledWithId" IS NULL
      WHERE e.origin IN ('IMPORT_EXCEL', 'MANUAL')
        AND e.lifecycle = 'EFFECTED'
        AND e."reconciledWithId" IS NULL
        AND e."isInternalTransfer" = false
        AND (
          e."bankAccountId" IN (SELECT id FROM bank_accounts WHERE "companyId" = ${data.empresaId})
          OR e."categoryId" IN (SELECT id FROM categories WHERE "companyId" = ${data.empresaId})
          OR e."supplierId" IN (SELECT id FROM suppliers WHERE "companyId" = ${data.empresaId})
        )
    `
    const dup = duplicatas[0]
    const qtd = dup ? Number(dup.qtd) : 0
    const causasProvaveis =
      qtd > 0
        ? {
            duplicatasPotenciais: qtd,
            valorDuplicado: dup?.valor ?? 0,
          }
        : null

    return NextResponse.json({
      saldoBanco,
      saldoSistema,
      diferenca,
      diferencaAbs: absDiff,
      status,
      causasProvaveis,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
