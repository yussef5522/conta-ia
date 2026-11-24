// GET  /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos
//      → a prévia do "marcar paga": o grupo do dia (conta garantida inclusa), o split e o bloqueio
// POST /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos  { transactionIds }
//      → a mesma prévia com a seleção do dono (os toggles do diálogo)
//
// ⭐ R54 (25/11/2026) — a prévia é `previaDoVinculo`, a MESMA régua e o MESMO split que a porta
// única grava. Antes esta rota tinha tolerâncias e um split próprios (installment-match).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { MutuoSemContaError } from '@/lib/loans/exige-conta'
import { JanelaBancariaNoFlexivelError, ehJanelaBancaria } from '@/lib/loans/janela-bancaria'
import { previaDoVinculo, PreviaDoVinculoError } from '@/lib/loans/previa-do-vinculo'

interface Params {
  params: Promise<{ id: string; loanId: string; number: string }>
}

const bodySchema = z.object({ transactionIds: z.array(z.string().cuid()).max(40) })

async function responder(request: NextRequest, { params }: Params, transactionIds?: string[]) {
  const { id: empresaId, loanId, number: numberStr } = await params
  const number = parseInt(numberStr, 10)
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ erro: 'number inválido' }, { status: 400 })
  }
  const ctx = await getAuthContext(request, empresaId)
  ctx.requirePermission('transaction.view')

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, companyId: empresaId },
    select: { scheduleSource: true },
  })
  if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
  if (!ehJanelaBancaria(loan.scheduleSource)) {
    const e = new JanelaBancariaNoFlexivelError()
    return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
  }
  try {
    const previa = await previaDoVinculo(prisma, {
      companyId: empresaId, loanId, installmentNumber: number, transactionIds,
    })
    return NextResponse.json(previa)
  } catch (e) {
    if (e instanceof PreviaDoVinculoError) {
      return NextResponse.json({ erro: e.message, code: e.code }, { status: e.code === 'LOAN_NOT_FOUND' ? 404 : 400 })
    }
    if (e instanceof MutuoSemContaError) {
      return NextResponse.json({ erro: e.message }, { status: 422 })
    }
    throw e
  }
}

export async function GET(request: NextRequest, ctx: Params) {
  try {
    return await responder(request, ctx)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, ctx: Params) {
  try {
    const { transactionIds } = bodySchema.parse(await request.json())
    return await responder(request, ctx, transactionIds)
  } catch (error) {
    return handleApiError(error)
  }
}
