// Mandar imprimir de novo um job que estourou as tentativas (30/08/2026).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { reenfileirar, ImpressaoError } from '@/lib/stock/impressao/fila'

interface Params { params: Promise<{ id: string; jobId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, jobId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  try {
    await reenfileirar(companyId, jobId, prisma)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ImpressaoError) return NextResponse.json({ erro: e.message }, { status: 404 })
    throw e
  }
}
