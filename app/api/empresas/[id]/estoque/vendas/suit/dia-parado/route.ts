// ⭐⭐ O DIA PARADO NA TRAVA (16/11/2026) — GET: os dias esperando o dono (a faixa lê). POST: a resposta
// "confirmo" do dono, que materializa o dia INTEIRO (produtos + sabores). ⛔ A máquina nunca chama o POST.
// Mesma trava de arquivo do laço e do "fechar o dia": dois escritores no mesmo dia nunca correm juntos.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { diasParados, responderDiaParado, DiaNaoEstaParadoError, DiaMeioGravadoError } from '@/lib/suit/dia-parado'
import { tentarTravar, soltar } from '@/lib/suit/trava-arquivo'

interface Params { params: Promise<{ id: string }> }
const TRAVA = `${process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'}/suit.lock`

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ dias: await diasParados(prisma, companyId) })
}

const schema = z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Diga qual dia.' }, { status: 400 })
  if (!tentarTravar(TRAVA)) return NextResponse.json({ erro: 'As vendas estão sendo gravadas agora — tente de novo em 1 minuto.', code: 'FECHANDO' }, { status: 409 })
  try {
    const r = await responderDiaParado(prisma, companyId, parsed.data.dia, new Date())
    if (r.produtos.status === 'AGUARDANDO_DONO') return NextResponse.json({ erro: r.produtos.motivo, code: 'SEGUE_PARADO' }, { status: 409 })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof DiaNaoEstaParadoError || e instanceof DiaMeioGravadoError) return NextResponse.json({ erro: e.message }, { status: 409 })
    // ⛔ mensagem crua do Prisma vaza a URI do banco — só o nome
    console.error('[vendas/suit/dia-parado] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui gravar o dia agora. Nada mudou — tente de novo em 1 minuto.' }, { status: 500 })
  } finally {
    soltar(TRAVA)
  }
}
