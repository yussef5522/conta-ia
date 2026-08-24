// ESTOQUE — entrada manual (compra sem nota). GET lista · POST registra.
// Nasce com requireStock: view pra listar, operate pra registrar (mexe no ledger).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { registrarEntradaManual, listarEntradasManuais, EntradaManualError } from '@/lib/stock/entrada-manual'
import { getAuthContext } from '@/lib/auth/rbac'
import { enviarEntradaManual } from '@/lib/stock/ponte-contas-pagar'

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

    // PONTE 1 — a parcela marcada em "gera parcela?" vira conta a pagar de verdade.
    // Mesma fronteira da nota: só quem tem stock.manage cria obrigação financeira.
    let ponte: Awaited<ReturnType<typeof enviarEntradaManual>> | null = null
    if (parsed.data.payable) {
      const ctx = await getAuthContext(request, companyId)
      if (ctx.hasPermission('stock.manage')) {
        ponte = await enviarEntradaManual({ companyId, entradaId: r.entradaId, cadastrarFornecedor: true, ctx, userId: auth.userId }, prisma)
      }
    }
    return NextResponse.json({ ok: true, ...r, ponte })
  } catch (e) {
    if (e instanceof EntradaManualError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
