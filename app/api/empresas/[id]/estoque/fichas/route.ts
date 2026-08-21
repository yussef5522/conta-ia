// ESTOQUE FASE 2 item 2.0 — fichas técnicas (GET lista, POST cria com versão + ciclo).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listFichas, criarFicha, FichaError } from '@/lib/stock/producao/fichas'

interface Params { params: Promise<{ id: string }> }

async function auth(request: NextRequest, companyId: string) {
  const user = await getAuthUser(request)
  if (!user) return { erro: NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 }) }
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) return { erro: NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 }) }
  return { user }
}

const componenteSchema = z.object({ itemId: z.string().min(1), qtdPlanejada: z.number().positive(), unidade: z.string().min(1).max(6), posicao: z.number().int().optional() })
const criarSchema = z.object({
  nomeProduzido: z.string().min(1).max(120),
  unidadeProduzido: z.enum(['KG', 'UN', 'LT']),
  tipoProduto: z.enum(['INTERMEDIARIO', 'PRODUTO_FINAL']),
  setorId: z.string().nullable().optional(),
  valorVenda: z.number().positive().nullable().optional(),
  loteBase: z.number().positive(),
  unidadeLoteBase: z.enum(['KG', 'UN', 'LT']),
  modoPreparo: z.string().max(4000).nullable().optional(),
  tempoPreparoMin: z.number().int().positive().nullable().optional(),
  validadeDias: z.number().int().positive().nullable().optional(),
  componentes: z.array(componenteSchema).min(1),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  return NextResponse.json({ fichas: await listFichas(companyId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da ficha inválidos.', detalhe: parsed.error.issues[0]?.message }, { status: 400 })
  try {
    const r = await criarFicha({ companyId, userId: a.user!.sub, ...parsed.data })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
