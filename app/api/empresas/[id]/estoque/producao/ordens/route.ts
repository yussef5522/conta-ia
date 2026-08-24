// ESTOQUE FASE 2 item 2.1 — ordens de produção (GET lista, POST cria).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listOrdens, criarOrdem, OrdemError } from '@/lib/stock/producao/ordens'
import { sugestoesDeProducao } from '@/lib/stock/producao/sugestao-cardapio'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const [ordens, sugestoes] = await Promise.all([listOrdens(companyId), sugestoesDeProducao(companyId, prisma)])
  return NextResponse.json({ ordens, sugestoes })
}

const criarSchema = z.object({
  fichaId: z.string().min(1),
  escalaReceitas: z.number().positive(),
  dataProducao: z.string().min(1),
  setorId: z.string().nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da ordem inválidos.' }, { status: 400 })
  try {
    const r = await criarOrdem({ companyId, userId: a.user!.sub, ...parsed.data, dataProducao: new Date(`${parsed.data.dataProducao}T12:00:00`) })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
