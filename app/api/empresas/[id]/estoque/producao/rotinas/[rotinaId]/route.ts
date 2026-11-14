// ⭐ ROTINA — editar · pausar/retomar · excluir (R29, irmã da R23/R24). O SERVIDOR decide o destino.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { editarRotina, excluirRotina, pausarRotina, previaExclusaoRotina, RotinaError } from '@/lib/stock/producao/rotinas-do-banco'
import { schemaDaRotina } from '@/lib/stock/producao/rotinas-schema'

interface Params { params: Promise<{ id: string; rotinaId: string }> }

function erro(e: unknown, oQue: string) {
  if (e instanceof RotinaError) return NextResponse.json({ erro: e.message }, { status: 422 })
  console.error(`[producao/rotinas] ${oQue} falhou:`, (e as Error)?.name)
  return NextResponse.json({ erro: `Não consegui ${oQue}. Nada mudou — dá pra tentar de novo.` }, { status: 500 })
}

/** a prévia do EXCLUIR — os números da confirmação */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, rotinaId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  try { return NextResponse.json(await previaExclusaoRotina(companyId, rotinaId, prisma)) } catch (e) { return erro(e, 'ler a rotina') }
}

const pausa = z.object({ pausar: z.boolean() })

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, rotinaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const body = await request.json().catch(() => null)
  const p = pausa.safeParse(body)
  if (p.success) {
    try { await pausarRotina({ companyId, rotinaId, userId: a.user.sub, pausar: p.data.pausar }, prisma); return NextResponse.json({ ok: true }) }
    catch (e) { return erro(e, p.data.pausar ? 'pausar' : 'retomar') }
  }
  const parsed = schemaDaRotina.safeParse(body)
  if (!parsed.success) return NextResponse.json({ erro: 'Diga o nome, quando repete, quem faz e pelo menos 1 item.' }, { status: 400 })
  try { return NextResponse.json(await editarRotina({ companyId, rotinaId, ...parsed.data, userId: a.user.sub }, prisma)) }
  catch (e) { return erro(e, 'editar a rotina') }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, rotinaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try { return NextResponse.json(await excluirRotina({ companyId, rotinaId, userId: a.user.sub }, prisma)) } catch (e) { return erro(e, 'excluir a rotina') }
}
