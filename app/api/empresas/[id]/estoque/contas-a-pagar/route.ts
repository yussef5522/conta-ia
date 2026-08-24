// ESTOQUE ↔ FINANCEIRO — PONTE 1. GET lista as parcelas esperando · POST envia.
//
// ⚠️ FRONTEIRA DE PAPEL: enviar boleto pro Contas a Pagar é criar OBRIGAÇÃO FINANCEIRA —
// é `stock.manage`, não `stock.operate`. O OPERADOR_ESTOQUE confere a nota e o estoque
// entra normal; as parcelas ficam esperando o dono aprovar. Ninguém da loja cria conta
// a pagar sem querer.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { listarPendentes, enviarParaContasPagar, PonteError } from '@/lib/stock/ponte-contas-pagar'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  return NextResponse.json({ pendentes: await listarPendentes(companyId, prisma) })
}

const schema = z.object({
  suggestionIds: z.array(z.string().min(1)).min(1).max(200),
  cadastrarFornecedores: z.boolean().default(true),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha ao menos uma parcela.' }, { status: 400 })
  try {
    const ctx = await getAuthContext(request, companyId)
    const r = await enviarParaContasPagar({ companyId, ...parsed.data, ctx, userId: auth.userId }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof PonteError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
