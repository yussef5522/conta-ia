// Sprint Tela Contraparte (31/07/2026) — POST /confirm.
// Grava counterpartyName SÓ nas transações confirmadas pelo usuário, DENTRO de
// prisma.$transaction. Respeita precedência (PDF nunca sobrescreve MANUAL/OFX).
// NUNCA toca amount, date, categoryId, status, lifecycle nem balance da conta.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canApplyCounterparty } from '@/lib/counterparty/precedence'

export const runtime = 'nodejs'

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({
  assignments: z
    .array(
      z.object({
        txId: z.string().min(1),
        counterpartyName: z.string().min(1).max(200),
        counterpartyDocument: z.string().max(30).nullable().optional(),
        // FASE 4 (13/08): por onde o nome veio. Default FITID (compat).
        matchKey: z.enum(['FITID', 'DATE_AMOUNT']).optional(),
      }),
    )
    .min(1)
    .max(1000),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
    select: { id: true },
  })
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
  }

  let written = 0
  let skippedPrecedence = 0
  let skippedNotFound = 0

  await prisma.$transaction(async (tx) => {
    // Só transações DESTA conta (multi-tenant + isolamento).
    const ids = body.assignments.map((a) => a.txId)
    const existentes = await tx.transaction.findMany({
      where: { id: { in: ids }, bankAccountId: contaId },
      select: { id: true, counterpartySource: true },
    })
    const byId = new Map(existentes.map((e) => [e.id, e]))

    for (const a of body.assignments) {
      const ex = byId.get(a.txId)
      if (!ex) { skippedNotFound++; continue }
      // Precedência: PDF não sobrescreve MANUAL nem OFX.
      if (!canApplyCounterparty(ex.counterpartySource, 'PDF_STATEMENT')) {
        skippedPrecedence++
        continue
      }
      await tx.transaction.update({
        where: { id: a.txId },
        // SÓ campos de contraparte. Nada de amount/date/categoryId/status/balance.
        data: {
          counterpartyName: a.counterpartyName.trim(),
          counterpartyDocument: a.counterpartyDocument?.trim() || null,
          counterpartySource: 'PDF_STATEMENT',
          counterpartyConfidence: 'EXACT',
          counterpartyMatchKey: a.matchKey ?? 'FITID',
        },
      })
      written++
    }
  })

  console.log('[enriquecer-contraparte/confirm]', { contaId, written, skippedPrecedence, skippedNotFound })
  return NextResponse.json({ written, skippedPrecedence, skippedNotFound })
}
