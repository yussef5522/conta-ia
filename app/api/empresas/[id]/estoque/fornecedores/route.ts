// ESTOQUE — GET fornecedores do estoque (pra escolher na entrada manual).
// Lê SÓ `stock_supplier` (a tabela isolada do módulo); o `Supplier` do financeiro é
// leitura de outro módulo e não entra aqui.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const fornecedores = await prisma.stockSupplier.findMany({
    where: { companyId }, orderBy: { razaoSocial: 'asc' },
    select: { id: true, razaoSocial: true, cnpj: true },
  })
  return NextResponse.json({ fornecedores })
}
