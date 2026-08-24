// ESTOQUE FASE 2 item 2.0 — colaboradores (GET lista, POST cria). Só nome, lista simples.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listColaboradores, criarColaborador } from '@/lib/stock/producao/cadastros'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ colaboradores: await listColaboradores(companyId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = z.object({ nome: z.string().min(1).max(80) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o nome do colaborador.' }, { status: 400 })
  return NextResponse.json({ colaborador: await criarColaborador(companyId, parsed.data.nome) })
}
