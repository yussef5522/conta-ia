// PIN do colaborador — define/revoga. ⛔ NUNCA devolve o PIN, só quem TEM um.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { definirPin, revogarPin, colaboradoresComPin, PinError } from '@/lib/stock/producao/pin'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ comPin: [...await colaboradoresComPin(companyId, prisma)] })
}

const schema = z.object({
  colaboradorId: z.string().min(1),
  // ⚠️ pin ausente = revogar
  pin: z.string().regex(/^\d{4}$/).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  // ⭐ escolher o PIN de alguém é decidir de quem vai ser a assinatura do trabalho → GERÊNCIA
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'O PIN tem 4 dígitos, só números.' }, { status: 400 })
  try {
    if (!parsed.data.pin) {
      await revogarPin(companyId, parsed.data.colaboradorId, prisma)
      return NextResponse.json({ ok: true, revogado: true })
    }
    const r = await definirPin({ companyId, colaboradorId: parsed.data.colaboradorId, pin: parsed.data.pin, userId: a.user.sub }, prisma)
    return NextResponse.json({ ok: true, trocou: r.trocou })
  } catch (e) {
    if (e instanceof PinError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
