// 📥 O DETALHE DE UM DIA — abas Produtos | Sabores (08/10/2026). GET puro: ZERO escrita.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { lerDetalheDoDia } from '@/lib/stock/vendas/detalhe-do-dia'

interface Params { params: Promise<{ id: string; dia: string }> }

const DIA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, dia } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  if (!DIA.test(dia)) return NextResponse.json({ erro: 'dia inválido — esperado YYYY-MM-DD' }, { status: 400 })
  return NextResponse.json(await lerDetalheDoDia(companyId, dia, prisma))
}
