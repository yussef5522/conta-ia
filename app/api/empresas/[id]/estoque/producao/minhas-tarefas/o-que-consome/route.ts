// ⭐ O QUE VAI SER CONSUMIDO ao fechar o lote — a tela do tablet mostra ANTES de perguntar o
// número, porque quem finaliza precisa saber que **tudo que foi separado vai ser consumido**.
// Se sobrou material, a pessoa NÃO finaliza: chama o encarregado, que conclui pela tela
// ajustando o consumo.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { oQueVaiSerConsumido } from '@/lib/stock/producao/concluir-do-tablet'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ pin: z.string().regex(/^\d{4}$/), etapaId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, ['stock.executar', 'stock.operate'])
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  if (!(await quemEstaComOPin(companyId, parsed.data.pin, prisma))) {
    return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  }
  const etapa = await prisma.stockOrdemEtapa.findFirst({
    where: { id: parsed.data.etapaId, companyId }, select: { ordemId: true },
  })
  if (!etapa) return NextResponse.json({ erro: 'Tarefa não encontrada.' }, { status: 404 })
  return NextResponse.json({ consumo: await oQueVaiSerConsumido(companyId, etapa.ordemId, prisma) })
}
