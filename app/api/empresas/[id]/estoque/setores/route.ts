// ESTOQUE FASE 2 item 2.0 — setores (GET lista, POST cria). Cadastro mínimo.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listSetores, criarSetor } from '@/lib/stock/producao/cadastros'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ setores: await listSetores(companyId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = z.object({ nome: z.string().min(1).max(60) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o nome do setor.' }, { status: 400 })
  return NextResponse.json({ setor: await criarSetor(companyId, parsed.data.nome) })
}
