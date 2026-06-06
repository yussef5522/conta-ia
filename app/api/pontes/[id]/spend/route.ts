// Sprint Retirada-Despesa-PF — Endpoint do convite.
//
// POST /api/pontes/[id]/spend  → cria a despesa PF (atomic) + vincula à bridge
// PATCH /api/pontes/[id]/spend → set/unset spendAcknowledged (botão "Agora não")
//
// Privacidade: BridgeError BRIDGE_NOT_FOUND traduzido pra 404 sem revelar
// se o id existe pra outro user.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { createBridgeSpend, setBridgeSpendAcknowledged } from '@/lib/bridges/create-spend'
import { isBridgeError } from '@/lib/bridges/types'

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  if (isBridgeError(err)) {
    const map: Record<string, number> = {
      BRIDGE_NOT_FOUND: 404,
      PF_ACCOUNT_NOT_FOUND: 404,
      PF_CATEGORY_INVALID: 400,
      SPEND_ALREADY_LINKED: 409,
      SPEND_INVALID_TYPE: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

const createSchema = z.object({
  amount: z.number().positive(),
  date: z.string().datetime(),
  description: z.string().min(1).max(200),
  bankAccountId: z.string().min(1),
  categoryId: z.string().min(1),
  notes: z.string().nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    const result = await createBridgeSpend({
      userId: ctx.user.id,
      bridgeId: id,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      description: parsed.data.description,
      bankAccountId: parsed.data.bankAccountId,
      categoryId: parsed.data.categoryId,
      notes: parsed.data.notes ?? null,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}

const patchSchema = z.object({
  acknowledged: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'acknowledged inválido' }, { status: 400 })
    }
    await setBridgeSpendAcknowledged(ctx.user.id, id, parsed.data.acknowledged)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
