// ESTOQUE FASE 2 item 2.0 — ficha (GET detalhe + versões, PATCH edita com versionamento).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFicha, atualizarFicha, FichaError } from '@/lib/stock/producao/fichas'

interface Params { params: Promise<{ id: string; fichaId: string }> }

async function auth(request: NextRequest, companyId: string) {
  const user = await getAuthUser(request)
  if (!user) return { erro: NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 }) }
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) return { erro: NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 }) }
  return { user }
}

const componenteSchema = z.object({ itemId: z.string().min(1), qtdPlanejada: z.number().positive(), unidade: z.string().min(1).max(6), posicao: z.number().int().optional() })
const patchSchema = z.object({
  nomeProduzido: z.string().min(1).max(120).optional(),
  setorId: z.string().nullable().optional(),
  valorVenda: z.number().positive().nullable().optional(),
  ativo: z.boolean().optional(),
  loteBase: z.number().positive().optional(),
  unidadeLoteBase: z.enum(['KG', 'UN', 'LT']).optional(),
  modoPreparo: z.string().max(4000).nullable().optional(),
  tempoPreparoMin: z.number().int().positive().nullable().optional(),
  validadeDias: z.number().int().positive().nullable().optional(),
  componentes: z.array(componenteSchema).min(1).optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const r = await getFicha(companyId, fichaId)
  if (!r) return NextResponse.json({ erro: 'Ficha não encontrada' }, { status: 404 })
  return NextResponse.json(r)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ erro: 'Nada pra atualizar' }, { status: 400 })
  try {
    const r = await atualizarFicha(companyId, fichaId, { ...parsed.data, userId: a.user!.sub })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
