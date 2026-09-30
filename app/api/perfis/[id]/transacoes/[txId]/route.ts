// Sprint PF FATIA 1 — Transação PF (PATCH + DELETE).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { reAncorarContasPF } from '@/lib/balance/recalcular'
import { getAuthUser } from '@/lib/auth'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    const status = err.code === 'NO_ACCESS' ? 404 : 403
    return NextResponse.json({ erro: err.message, code: err.code }, { status })
  }
  throw err
}

async function getTxInProfile(profileId: string, txId: string) {
  const tx = await prisma.personalTransaction.findUnique({
    where: { id: txId },
  })
  if (!tx || tx.profileId !== profileId) {
    throw new ProfileAccessError('Transação não encontrada', 'NOT_FOUND')
  }
  return tx
}

const patchSchema = z.object({
  date: z.string().datetime().optional(),
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  bankAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, txId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    const tx = await getTxInProfile(id, txId)

    // Validar bankAccountId/categoryId pertencem ao perfil (anti-leak)
    if (parsed.data.bankAccountId) {
      const acc = await prisma.personalBankAccount.findUnique({
        where: { id: parsed.data.bankAccountId },
        select: { profileId: true },
      })
      if (!acc || acc.profileId !== id) {
        return NextResponse.json({ erro: 'bankAccountId inválido' }, { status: 400 })
      }
    }
    if (parsed.data.categoryId) {
      const cat = await prisma.personalCategory.findUnique({
        where: { id: parsed.data.categoryId },
        select: { profileId: true },
      })
      if (!cat || cat.profileId !== id) {
        return NextResponse.json({ erro: 'categoryId inválido' }, { status: 400 })
      }
    }

    /**
     * ⭐ item 4 (30/09) — o PF sofre do MESMO drift, e aqui em dose tripla (revertia a
     * conta antiga, gravava, aplicava na nova). A conta PF tem `ledgerBal`/`ledgerBalDate`
     * desde a FASE 1 (13/09), então lançamento retroativo soma por cima do que o banco
     * declarou, igualzinho ao PJ.
     *
     * ⚠️ E aqui a edição JÁ trocava de conta (`bankAccountId` no body) — então este era o
     * único lugar da casa que movia linha entre contas, e movia somando dois deltas.
     */
    const updated = await prisma.$transaction(async (trx) => {
      const newAccountId =
        parsed.data.bankAccountId !== undefined
          ? parsed.data.bankAccountId
          : tx.bankAccountId

      const updatedTx = await trx.personalTransaction.update({
        where: { id: txId },
        data: {
          ...(parsed.data.date !== undefined && { date: new Date(parsed.data.date) }),
          ...(parsed.data.description !== undefined && { description: parsed.data.description }),
          ...(parsed.data.amount !== undefined && { amount: Math.abs(parsed.data.amount) }),
          ...(parsed.data.type !== undefined && { type: parsed.data.type }),
          ...(parsed.data.bankAccountId !== undefined && { bankAccountId: parsed.data.bankAccountId }),
          ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
          ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        },
      })

      // ⭐ as DUAS contas (a de onde saiu e a pra onde foi) se re-ancoram
      await reAncorarContasPF(trx, [tx.bankAccountId, newAccountId])
      return updatedTx
    })

    return NextResponse.json({ transaction: updated })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, txId } = await params
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    const tx = await getTxInProfile(id, txId)
    await prisma.$transaction(async (trx) => {
      // ⭐ item 4: apaga e DEPOIS deriva — derivação precisa do ledger no estado final.
      await trx.personalTransaction.delete({ where: { id: txId } })
      await reAncorarContasPF(trx, [tx.bankAccountId])
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
