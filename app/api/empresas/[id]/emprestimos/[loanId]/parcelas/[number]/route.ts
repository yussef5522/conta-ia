// POST   /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]
//        → "marcar paga" do detalhe: grava pela PORTA ÚNICA (pedaços N:1 + encargos apurados)
// DELETE /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]
//        → desfaz: devolve TUDO (status, data, vínculos, encargos) — a agenda não é tocada
// GET    /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos
//        → mostra os débitos candidatos
//
// ⛔⛔ R54 — UMA PORTA SÓ PRA PAGAR PARCELA (25/11/2026, lei docs/emprestimos-referencia.html).
// Esta rota tinha caminho PRÓPRIO: gravava o vínculo 1:1 (`reconciledTransactionId`) e
// SOBRESCREVIA `payment`/`interest`/`correcao`/`closingBalance` da agenda com o split — e o
// desfazer devolvia só o status, deixando a agenda alterada pra sempre (R55). Agora ela é um
// fio fino em volta das MESMAS duas funções que a caixa de entrada e o import OFX usam.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { JanelaBancariaNoFlexivelError, ehJanelaBancaria } from '@/lib/loans/janela-bancaria'
import { vincularPagamentoDeParcela, VinculoDeParcelaError } from '@/lib/loans/vincular-pagamento'
import { desfazerVinculoDeParcela, DesfazerVinculoError } from '@/lib/loans/desfazer-vinculo'

interface Params {
  params: Promise<{ id: string; loanId: string; number: string }>
}

// um débito (o gesto clássico) ou o grupo do dia (os pedaços)
const confirmSchema = z.union([
  z.object({ transactionId: z.string().cuid() }),
  z.object({ transactionIds: z.array(z.string().cuid()).min(1).max(20) }),
])

function numeroDaParcela(s: string): number | null {
  const n = parseInt(s, 10)
  return Number.isInteger(n) && n >= 1 ? n : null
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId, number: numberStr } = await params
    const number = numeroDaParcela(numberStr)
    if (number == null) return NextResponse.json({ erro: 'number inválido' }, { status: 400 })
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = confirmSchema.parse(await request.json())
    const transactionIds = 'transactionIds' in body ? body.transactionIds : [body.transactionId]

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, companyId: empresaId },
      select: { scheduleSource: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    if (!ehJanelaBancaria(loan.scheduleSource)) {
      const e = new JanelaBancariaNoFlexivelError()
      return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
    }

    const r = await prisma.$transaction((db) =>
      vincularPagamentoDeParcela({ db, companyId: empresaId, loanId, installmentNumber: number, transactionIds }),
    )
    return NextResponse.json({
      ok: true,
      status: r.status,
      paidTotal: r.paidTotal,
      encargoApurado: r.splitInjected,
    })
  } catch (error) {
    if (error instanceof VinculoDeParcelaError) {
      return NextResponse.json({ erro: error.message, code: error.code }, { status: 422 })
    }
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId, number: numberStr } = await params
    const number = numeroDaParcela(numberStr)
    if (number == null) return NextResponse.json({ erro: 'number inválido' }, { status: 400 })
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const r = await prisma.$transaction((db) =>
      desfazerVinculoDeParcela({ db, companyId: empresaId, loanId, installmentNumber: number }),
    )
    return NextResponse.json({ ok: true, soltos: r.soltos })
  } catch (error) {
    if (error instanceof DesfazerVinculoError) {
      const status = error.code === 'LOAN_NOT_FOUND' || error.code === 'INSTALLMENT_NOT_FOUND' ? 404 : 422
      return NextResponse.json({ erro: error.message, code: error.code }, { status })
    }
    return handleApiError(error)
  }
}
