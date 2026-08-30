// ⭐ A TORNEIRA — produtos etiquetáveis (GET) · imprimir (POST) · validade por estado (PUT).
//
// ⚠️ IMPRIMIR é `stock.operate`: é o gesto do dia da cozinha, não configuração.
// DEFINIR VALIDADE é `stock.manage` — quantos dias uma carne dura é decisão de segurança
// alimentar do dono, não do operador.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { produtosEtiquetaveis, imprimirEtiqueta, definirValidade, EtiquetaError } from '@/lib/stock/etiquetas/etiquetar'
import { ImpressaoError } from '@/lib/stock/impressao/fila'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const [produtos, colaboradores] = await Promise.all([
    produtosEtiquetaveis(companyId, prisma),
    prisma.stockColaborador.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])
  return NextResponse.json({ produtos, colaboradores })
}

const imprimirSchema = z.object({
  itemId: z.string().min(1),
  estado: z.enum(['CONGELADO', 'RESFRIADO', 'AMBIENTE']),
  copias: z.number().int().positive().max(200),
  dias: z.number().int().positive().max(3650).nullish(),
  quantidade: z.number().nonnegative().nullish(),
  colaborador: z.string().max(80).nullish(),
  lote: z.string().max(40).nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = imprimirSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha o produto, o estado e quantas etiquetas.' }, { status: 400 })
  try {
    const r = await imprimirEtiqueta({ companyId, ...parsed.data, userId: a.user?.sub ?? null }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof EtiquetaError || e instanceof ImpressaoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const validadeSchema = z.object({
  itemId: z.string().min(1),
  estado: z.enum(['CONGELADO', 'RESFRIADO', 'AMBIENTE']),
  dias: z.number().int().positive().max(3650),
})

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = validadeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o produto, o estado e os dias.' }, { status: 400 })
  try {
    await definirValidade({ companyId, ...parsed.data, userId: a.user?.sub ?? null }, prisma)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof EtiquetaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
