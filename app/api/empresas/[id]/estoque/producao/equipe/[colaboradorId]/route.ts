// ⭐ EQUIPE — uma conta (lei R21/R23, 13/11/2026).
// GET    → a prévia do excluir (destino + números que a confirmação diz)
// PATCH  → { pin } troca o PIN · { papel } troca o papel. ⛔ o PIN nunca volta na resposta.
// DELETE → exclui: sem história apaga de vez; com história some de tudo (o servidor decide na hora).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previaDaExclusao, excluirConta, trocarPin, EquipeError } from '@/lib/stock/producao/contas-da-equipe'
import { definirPapel } from '@/lib/stock/producao/papel-da-conta'

interface Params { params: Promise<{ id: string; colaboradorId: string }> }

const erro = (e: unknown) => {
  if (e instanceof EquipeError) return NextResponse.json({ erro: e.message }, { status: 422 })
  throw e
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, colaboradorId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try { return NextResponse.json(await previaDaExclusao(companyId, colaboradorId, prisma)) } catch (e) { return erro(e) }
}

const patchSchema = z.union([
  z.object({ pin: z.string().regex(/^\d{4}$/) }),
  z.object({ papel: z.enum(['cozinha', 'escritorio', 'aparelho']) }),
])

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, colaboradorId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const p = patchSchema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'O PIN tem 4 dígitos, só números.' }, { status: 400 })
  try {
    if ('pin' in p.data) await trocarPin({ companyId, colaboradorId, pin: p.data.pin, userId: a.user.sub }, prisma)
    else {
      const c = await prisma.stockColaborador.findFirst({ where: { id: colaboradorId, companyId, ativo: true }, select: { id: true } })
      if (!c) throw new EquipeError('Essa conta não existe nesta empresa.')
      await definirPapel({ companyId, colaboradorId, papel: p.data.papel, userId: a.user.sub }, prisma)
    }
    return NextResponse.json({ ok: true })
  } catch (e) { return erro(e) }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, colaboradorId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try { return NextResponse.json({ ok: true, ...(await excluirConta(companyId, colaboradorId, prisma)) }) } catch (e) { return erro(e) }
}
