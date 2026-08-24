// ESTOQUE FASE 1 item 4 — "deixar pra depois" (toggle). Adia/reativa uma nota da fila:
// a nota FICA na fila, mas o badge "aguardando há X dias" silencia (decisão do dono).
// Reversível. Só escreve stock_nfe_adiada (isolado).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'

interface Params { params: Promise<{ id: string; nfeId: string }> }

const bodySchema = z.object({ adiar: z.boolean(), motivo: z.string().max(200).optional() })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Payload inválido' }, { status: 400 })

  const nfe = await prisma.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { id: true, chave: true, status: true } })
  if (!nfe) return NextResponse.json({ erro: 'Nota não encontrada' }, { status: 404 })
  if (nfe.status !== 'AGUARDANDO_MERCADORIA') return NextResponse.json({ erro: 'Só dá pra adiar nota que está na fila.' }, { status: 400 })

  if (parsed.data.adiar) {
    await prisma.stockNfeAdiada.upsert({
      where: { companyId_nfeId: { companyId, nfeId } },
      create: { companyId, nfeId, chave: nfe.chave, motivo: parsed.data.motivo ?? null, adiadaPorId: user.sub },
      update: { motivo: parsed.data.motivo ?? null },
    })
  } else {
    await prisma.stockNfeAdiada.deleteMany({ where: { companyId, nfeId } })
  }
  return NextResponse.json({ ok: true, adiada: parsed.data.adiar })
}
