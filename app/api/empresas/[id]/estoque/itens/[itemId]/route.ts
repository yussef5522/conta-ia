// ESTOQUE FASE 1 — GET ficha do produto (lê o ledger). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildFichaItem } from '@/lib/stock/ficha-item'

interface Params { params: Promise<{ id: string; itemId: string }> }

async function auth(request: NextRequest, companyId: string) {
  const user = await getAuthUser(request)
  if (!user) return { erro: NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 }) }
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return { erro: NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 }) }
  }
  return { user }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const ficha = await buildFichaItem(companyId, itemId)
  if (!ficha) return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 })
  return NextResponse.json({ ficha })
}

// PATCH — renomear/recategorizar o item. O NOME é do dono, não da nota (bug do prefixo).
const patchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']).optional(),
  unidadeControle: z.enum(['KG', 'UN', 'LT']).optional(),
  estoqueMin: z.number().nonnegative().nullable().optional(),
  estoqueMax: z.number().positive().nullable().optional(),
})
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ erro: 'Nada pra atualizar' }, { status: 400 })
  const existe = await prisma.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, estoqueMin: true, estoqueMax: true } })
  if (!existe) return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 })
  // validação min < max (app-level; stockItem já existe, não dá pra ALTER + CHECK sob o isolamento)
  const novoMin = parsed.data.estoqueMin !== undefined ? parsed.data.estoqueMin : existe.estoqueMin
  const novoMax = parsed.data.estoqueMax !== undefined ? parsed.data.estoqueMax : existe.estoqueMax
  if (novoMin != null && novoMax != null && novoMin >= novoMax) {
    return NextResponse.json({ erro: 'O mínimo tem que ser menor que o máximo.' }, { status: 400 })
  }
  const item = await prisma.stockItem.update({ where: { id: itemId }, data: parsed.data, select: { id: true, nome: true, categoria: true, unidadeControle: true, estoqueMin: true, estoqueMax: true } })
  return NextResponse.json({ ok: true, item })
}
