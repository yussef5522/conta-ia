// ESTOQUE — entrada manual (compra sem nota). GET lista · POST registra.
// Nasce com requireStock: view pra listar, operate pra registrar (mexe no ledger).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { registrarEntradaManual, listarEntradasManuais, EntradaManualError } from '@/lib/stock/entrada-manual'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  return NextResponse.json({ entradas: await listarEntradasManuais(companyId, prisma) })
}

const schema = z.object({
  fornecedor: z.object({
    supplierId: z.string().optional(),
    nome: z.string().max(200).optional(),
    cnpj: z.string().max(20).nullable().optional(),
  }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: z.string().max(300).nullable().optional(),
  itens: z.array(z.object({
    itemId: z.string().optional(),
    novo: z.object({
      nome: z.string().min(1).max(120),
      unidadeControle: z.enum(['KG', 'UN', 'LT']),
      categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']),
    }).optional(),
    quantidade: z.number().positive(),
    custoUnitario: z.number().min(0),
  })).min(1).max(200),
  payable: z.object({
    vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    valor: z.number().positive(),
  }).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe fornecedor, data e ao menos um item.' }, { status: 400 })
  try {
    const r = await registrarEntradaManual({ companyId, userId: auth.userId, userName: auth.userName, ...parsed.data }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof EntradaManualError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
