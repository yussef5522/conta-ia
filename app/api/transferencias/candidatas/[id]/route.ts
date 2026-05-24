// GET /api/transferencias/candidatas/[id]
// Lista até 5 transações PENDING que podem ser pareadas com a tx [id].
// Sprint 1.7.
//
// Critérios:
//   - bankAccount.companyId === base.companyId (multi-tenant)
//   - bankAccountId !== base.bankAccountId (conta diferente)
//   - type oposto (CREDIT ↔ DEBIT)
//   - |amount - base.amount| <= 0.01
//   - |date - base.date| <= 3 dias
//   - status === 'PENDING' E transferGroupId IS NULL
//
// Ordenação: |deltaDate| ASC → |deltaAmount| ASC → date DESC. Limit 5.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_DATE_DELTA_DAYS = 3
const CENT_TOLERANCE = 0.01
const RESULT_LIMIT = 5

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const base = await prisma.transaction.findUnique({
      where: { id },
      include: {
        bankAccount: { select: { id: true, companyId: true } },
      },
    })
    if (!base) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(_request, base.bankAccount!.companyId)
    ctx.requirePermission('transaction.view')

    const baseDateMs = base.date.getTime()
    const dateMin = new Date(baseDateMs - MAX_DATE_DELTA_DAYS * MS_PER_DAY)
    const dateMax = new Date(baseDateMs + MAX_DATE_DELTA_DAYS * MS_PER_DAY)

    // Tipo oposto: CREDIT ↔ DEBIT
    const oppositeType = base.type === 'CREDIT' ? 'DEBIT' : 'CREDIT'

    // Pre-filtro no SQL (date/empresa/status/contas/tipo/transferGroupId).
    // Amount tolerance ±1¢ é refinada em memória (Prisma não tem ABS facil).
    const candidatasRaw = await prisma.transaction.findMany({
      where: {
        id: { not: base.id },
        status: 'PENDING',
        transferGroupId: null,
        type: oppositeType,
        bankAccountId: { not: base.bankAccount!.id },
        bankAccount: { companyId: base.bankAccount!.companyId },
        date: { gte: dateMin, lte: dateMax },
      },
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true } },
      },
      // Pega mais que o limit pra filtrar amount em memória
      take: 50,
    })

    const ranked = candidatasRaw
      .filter((c) => Math.abs(c.amount - base.amount) <= CENT_TOLERANCE)
      .map((c) => ({
        c,
        deltaDate: Math.abs(c.date.getTime() - baseDateMs),
        deltaAmount: Math.abs(c.amount - base.amount),
      }))
      .sort((a, b) => {
        if (a.deltaDate !== b.deltaDate) return a.deltaDate - b.deltaDate
        if (a.deltaAmount !== b.deltaAmount) return a.deltaAmount - b.deltaAmount
        return b.c.date.getTime() - a.c.date.getTime()
      })
      .slice(0, RESULT_LIMIT)

    const candidatas = ranked.map(({ c }) => ({
      id: c.id,
      description: c.description,
      amount: c.amount,
      type: c.type,
      date: c.date,
      bankAccount: c.bankAccount,
    }))

    return NextResponse.json({
      base: {
        id: base.id,
        description: base.description,
        amount: base.amount,
        type: base.type,
        date: base.date,
      },
      candidatas,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
