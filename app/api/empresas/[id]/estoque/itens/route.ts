// ESTOQUE FASE 2 item 2.0 — GET itens (busca pro editor de ficha) + POST criar item mínimo
// (o dono adiciona molho/sal que nunca vieram em nota — nasce SEM custo/movimento; o custo
// chega quando a 1ª nota dele entrar). Sem isso a ficha fica incompleta e o custo errado.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { custoMedioPorItem } from '@/lib/stock/saldo'

interface Params { params: Promise<{ id: string }> }

async function auth(request: NextRequest, companyId: string) {
  const user = await getAuthUser(request)
  if (!user) return { erro: NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 }) }
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) return { erro: NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 }) }
  return { user }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const busca = request.nextUrl.searchParams.get('busca')?.trim() ?? ''
  const [itens, derivado] = await Promise.all([
    prisma.stockItem.findMany({
      where: { companyId, ativo: true, ...(busca ? { nome: { contains: busca } } : {}) },
      orderBy: { nome: 'asc' },
      take: 50,
      select: { id: true, nome: true, unidadeControle: true, categoria: true },
    }),
    // custoMedio DERIVADO dos movimentos (mesma fonte da Posição) — não o campo stale
    custoMedioPorItem(prisma, companyId),
  ])
  return NextResponse.json({ itens: itens.map((i) => ({ ...i, custoMedio: derivado.get(i.id) ?? null })) })
}

const criarSchema = z.object({
  nome: z.string().min(1).max(120),
  unidadeControle: z.enum(['KG', 'UN', 'LT']),
  categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']).default('MATERIA_PRIMA'),
  estoqueMin: z.number().nonnegative().nullable().optional(),
  estoqueMax: z.number().positive().nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe nome e unidade do item.' }, { status: 400 })
  const nome = parsed.data.nome.trim()
  const { estoqueMin, estoqueMax } = parsed.data
  if (estoqueMin != null && estoqueMax != null && estoqueMin >= estoqueMax) return NextResponse.json({ erro: 'O mínimo tem que ser menor que o máximo.' }, { status: 400 })
  // se já existe um item com o mesmo nome, devolve ele (não duplica)
  const existente = await prisma.stockItem.findFirst({ where: { companyId, nome }, select: { id: true, nome: true, unidadeControle: true, custoMedio: true, categoria: true } })
  if (existente) return NextResponse.json({ item: existente, jaExistia: true })
  // nasce SEM custo (custoMedio null → "a definir") e SEM movimento — o custo vem da 1ª nota
  const item = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: parsed.data.unidadeControle, categoria: parsed.data.categoria, estoqueMin: estoqueMin ?? null, estoqueMax: estoqueMax ?? null, criadoVia: 'MANUAL', criadoPorId: a.user!.sub },
    select: { id: true, nome: true, unidadeControle: true, custoMedio: true, categoria: true },
  })
  return NextResponse.json({ item })
}
