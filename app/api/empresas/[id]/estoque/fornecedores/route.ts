// ESTOQUE — GET fornecedores pra escolher (entrada manual / nota manual).
//
// ⛔ ANTES LIA SÓ `stock_supplier` e isso ERA O BUG (04/09): a tabela do estoque só enche
// quando uma nota é CONFERIDA, então **27 apareciam contra 85 cadastrados** — 63 invisíveis.
// O dono não achou a RM2 (que nunca passou por conferência) e criou uma segunda.
//
// ⭐ Agora lê os DOIS mundos e unifica pelos guards de `fornecedores-unificados.ts`.
// ⚠️ LEITURA do `Supplier` do financeiro é permitida (a ponte já faz); ESCRITA lá, nunca.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { listarFornecedoresUnificados } from '@/lib/stock/fornecedores-unificados'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const unificados = await listarFornecedoresUnificados(companyId, prisma)
  return NextResponse.json({
    // ⚠️ `id` continua sendo o do ESTOQUE quando existe (compat com quem já consome);
    // quem só existe no financeiro vai com `id: null` + `financeiroId` — a tela escolhe por
    // um dos dois e o `stock_supplier` nasce no gesto.
    fornecedores: unificados.map((f) => ({
      id: f.stockId, financeiroId: f.financeiroId, razaoSocial: f.razaoSocial, cnpj: f.cnpj, origem: f.origem,
    })),
  })
}
