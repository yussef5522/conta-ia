// Sprint A-effected Fase B.2 — GET /api/conciliacao/find-and-match
//
// Busca AP/AR pendentes + EFFECTED órfão pra escolha manual do user.
// Resolve caso real CIA DA FRUTA (Cacula Mix): auto-match falhou, mas
// o user sabe que pagou — busca o nome do fornecedor, marca a nota
// certa, reconcilia.
//
// Query params:
//   - empresaId: string (cuid)
//   - ofxTransactionId: string (cuid) — pra direcionar match (DEBIT vs CREDIT)
//   - busca: string opcional (description, supplier, cnpj, amount exato)
//   - excluirIds: string CSV opcional (candidatos já selecionados na UI
//     que devem sumir da próxima busca)
//   - limit: int default 50, max 200
//
// Universo de candidatos (igual find-candidates mas SEM janela de data
// — user busca manualmente, então tolerância pode ser muito maior):
//   RAMO 1 — PAYABLE/RECEIVABLE pendentes
//   RAMO 2 — EFFECTED órfão (origin IN IMPORT_EXCEL/MANUAL, sem link,
//            sem ignoredAt, sem cashCoded)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import type { Prisma } from '@prisma/client'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  ofxTransactionId: z.string().cuid(),
  busca: z.string().trim().optional(),
  excluirIds: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

function tryParseAmount(raw: string): number | null {
  // Aceita "1234.56", "1234,56", "1.234,56", "R$ 1.234,56"
  const cleaned = raw
    .replace(/r\$/i, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '') // remove . como separador de milhar
    .replace(',', '.')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    // 1) Resolve OFX pra saber direção (DEBIT/CREDIT)
    const ofx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      select: {
        id: true,
        type: true,
        amount: true,
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!ofx || !ofx.bankAccount) {
      return NextResponse.json({ erro: 'Tx OFX não encontrada' }, { status: 404 })
    }
    if (ofx.bankAccount.companyId !== data.empresaId) {
      return NextResponse.json({ erro: 'OFX não pertence à empresa' }, { status: 403 })
    }

    const targetLifecycle = ofx.type === 'DEBIT' ? 'PAYABLE' : 'RECEIVABLE'
    const orphanType = ofx.type

    const excluirIds = data.excluirIds
      ? data.excluirIds.split(',').filter((s) => s.length > 0)
      : []

    // 2) Monta filtro de busca textual (description ILIKE + supplier ILIKE/CNPJ)
    //    + amount exato se busca for numérica
    let buscaWhere: Prisma.TransactionWhereInput = {}
    if (data.busca && data.busca.length > 0) {
      // `mode: 'insensitive'` é Postgres-only. SQLite (dev) usa case-sensitive
      // por padrão — TS strict da schema sqlite reclama. Cast pra contornar.
      const insensitive = { mode: 'insensitive' as const } as {
        mode: 'insensitive'
      }
      const orFilters: Prisma.TransactionWhereInput[] = [
        { description: { contains: data.busca, ...insensitive } as Prisma.StringFilter },
        {
          supplier: {
            razaoSocial: {
              contains: data.busca,
              ...insensitive,
            } as Prisma.StringFilter,
          },
        },
        {
          supplier: {
            nomeFantasia: {
              contains: data.busca,
              ...insensitive,
            } as Prisma.StringNullableFilter,
          },
        },
      ]
      // CNPJ search (só dígitos)
      const cnpjDigits = data.busca.replace(/\D/g, '')
      if (cnpjDigits.length >= 8) {
        orFilters.push({ supplier: { cnpj: { contains: cnpjDigits } } })
      }
      // Amount exato (tolerância R$ 0.01)
      const possibleAmount = tryParseAmount(data.busca)
      if (possibleAmount !== null) {
        orFilters.push({
          amount: {
            gte: possibleAmount - 0.01,
            lte: possibleAmount + 0.01,
          },
        })
      }
      // externalId / reference
      orFilters.push({
        externalId: {
          contains: data.busca,
          ...insensitive,
        } as Prisma.StringNullableFilter,
      })

      buscaWhere = { OR: orFilters }
    }

    // 3) Multi-tenant scope
    const companyScope: Prisma.TransactionWhereInput = {
      OR: [
        { bankAccount: { companyId: data.empresaId } },
        { supplier: { companyId: data.empresaId } },
        { customer: { companyId: data.empresaId } },
        { category: { companyId: data.empresaId } },
      ],
    }

    // 4) RAMO 1 (PAYABLE/RECEIVABLE pendentes) + RAMO 2 (EFFECTED órfão)
    const universoRamos: Prisma.TransactionWhereInput = {
      OR: [
        {
          lifecycle: targetLifecycle,
          status: 'PENDING',
          reconciledWithId: null,
          reconciledFrom: { none: {} },
        },
        {
          lifecycle: 'EFFECTED',
          origin: { in: ['IMPORT_EXCEL', 'MANUAL'] },
          type: orphanType,
          reconciledWithId: null,
          reconciledFrom: { none: {} },
          ignoredAt: null,
          cashCoded: false,
        },
      ],
    }

    const where: Prisma.TransactionWhereInput = {
      AND: [
        companyScope,
        universoRamos,
        ...(Object.keys(buscaWhere).length > 0 ? [buscaWhere] : []),
        ...(excluirIds.length > 0 ? [{ id: { notIn: excluirIds } }] : []),
        { id: { not: data.ofxTransactionId } }, // garante OFX não vira candidata
      ],
    }

    const total = await prisma.transaction.count({ where })
    const candidates = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        dueDate: true,
        paymentDate: true,
        lifecycle: true,
        origin: true,
        externalId: true,
        supplier: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            cnpj: true,
          },
        },
      },
      orderBy: [
        // Mais relevantes primeiro: PAYABLE/RECEIVABLE pendentes, depois EFFECTED órfão.
        // Postgres ordena nulls last por default — usar a regra mais simples e
        // deixar o cliente ordenar mais se precisar.
        { dueDate: 'desc' },
        { date: 'desc' },
      ],
      take: data.limit,
    })

    return NextResponse.json({
      total,
      ofx: {
        id: ofx.id,
        amount: ofx.amount,
        type: ofx.type,
      },
      candidates: candidates.map((c) => ({
        id: c.id,
        description: c.description,
        amount: c.amount,
        date: c.date.toISOString(),
        dueDate: c.dueDate?.toISOString() ?? null,
        paymentDate: c.paymentDate?.toISOString() ?? null,
        lifecycle: c.lifecycle,
        origin: c.origin,
        externalId: c.externalId,
        supplier: c.supplier
          ? {
              id: c.supplier.id,
              razaoSocial: c.supplier.razaoSocial,
              nomeFantasia: c.supplier.nomeFantasia,
              cnpj: c.supplier.cnpj,
            }
          : null,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
