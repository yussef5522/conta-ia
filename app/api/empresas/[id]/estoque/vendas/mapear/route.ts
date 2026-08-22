// ESTOQUE FASE 3 — POST mapear um nome do Suitable a uma ficha ou item de revenda (aprende).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { upsertVendaMap, removerVendaMap } from '@/lib/stock/vendas/venda-map'

interface Params { params: Promise<{ id: string }> }

const schema = z.discriminatedUnion('alvoTipo', [
  z.object({ nomeSuitable: z.string().min(1), alvoTipo: z.literal('FICHA'), fichaId: z.string().min(1) }),
  z.object({ nomeSuitable: z.string().min(1), alvoTipo: z.literal('REVENDA'), itemId: z.string().min(1) }),
  z.object({ nomeSuitable: z.string().min(1), alvoTipo: z.literal('REMOVER') }),
])

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Mapeamento inválido.' }, { status: 400 })
  const d = parsed.data
  if (d.alvoTipo === 'REMOVER') { await removerVendaMap(companyId, d.nomeSuitable, prisma); return NextResponse.json({ ok: true }) }
  const alvo = d.alvoTipo === 'FICHA' ? { tipo: 'FICHA' as const, fichaId: d.fichaId } : { tipo: 'REVENDA' as const, itemId: d.itemId }
  await upsertVendaMap(companyId, d.nomeSuitable, alvo, user.sub, prisma)
  return NextResponse.json({ ok: true })
}
