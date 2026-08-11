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
import { isUnifiedTransferEnabled } from '@/lib/transfers/unified-transfer-flag'
import { classifyTransferPair, type UnifiedTx } from '@/lib/transfers/unified-transfer-engine'
import { loadOwnEntityRefs } from '@/lib/transfers/load-own-entity-refs'

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

    // ── FASE 4 (11/08): MOTOR ÚNICO atrás de flag. 7º site (modal Vincular em
    // Pendentes). MESMA regra do banner/parear/revisar → concordam DENTRO da
    // mesma tela. Drop do "PENDING" (candidato pode estar RECONCILED) e do
    // scoring inline: classifyTransferPair decide; só camadas 1+2 aparecem.
    if (isUnifiedTransferEnabled()) {
      const companyId = base.bankAccount!.companyId
      const [refs, cands, vc] = await Promise.all([
        loadOwnEntityRefs(prisma, companyId),
        prisma.transaction.findMany({
          where: {
            id: { not: base.id },
            transferGroupId: null,
            transferDismissedAt: null,
            isInternalTransfer: false,
            lifecycle: 'EFFECTED',
            type: oppositeType,
            bankAccountId: { not: base.bankAccount!.id },
            bankAccount: { companyId },
            date: { gte: dateMin, lte: dateMax },
          },
          include: { bankAccount: { select: { id: true, name: true, bankName: true } } },
          take: 60,
        }),
        prisma.transaction.groupBy({
          by: ['amount'],
          where: { bankAccount: { companyId }, date: { gte: new Date(Date.now() - 60 * MS_PER_DAY) } },
          _count: { _all: true },
        }),
      ])
      const valorComum = new Set(vc.filter((v) => v._count._all >= 3).map((v) => Math.round(v.amount * 100) / 100))
      const baseTx: UnifiedTx = { id: base.id, bankAccountId: base.bankAccount!.id, date: base.date, type: base.type, amount: base.amount, description: base.description }
      const classified = cands
        .map((c) => {
          const cTx: UnifiedTx = { id: c.id, bankAccountId: c.bankAccountId ?? '', date: c.date, type: c.type, amount: c.amount, description: c.description }
          const debit = base.type === 'DEBIT' ? baseTx : cTx
          const credit = base.type === 'DEBIT' ? cTx : baseTx
          const cls = classifyTransferPair(debit, credit, { refs, valorComum })
          if (!cls || !cls.autoSuggest) return null
          return { id: c.id, description: c.description, amount: c.amount, type: c.type, date: c.date, bankAccount: c.bankAccount, layer: cls.layer, confidence: cls.confidence, evidences: cls.evidences }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, RESULT_LIMIT)
      return NextResponse.json({
        engine: 'unified',
        base: { id: base.id, description: base.description, amount: base.amount, type: base.type, date: base.date },
        candidatas: classified,
      })
    }

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
