// RELATÓRIO POR PESSOA — só stock.manage. ⛔ Comparativo entre pessoas não é tela de cozinha.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { relatorioPorPessoa } from '@/lib/stock/producao/relatorio-por-pessoa'
import { tarefasAbertasDemais } from '@/lib/stock/producao/minhas-tarefas'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  // ⚠️ `manage` e não `view`: o ranking comparativo entre pessoas é do dono, e a decisão foi
  // explícita — nunca na janela do funcionário, nunca em tela compartilhada.
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const sp = request.nextUrl.searchParams
  const hoje = diaEmSaoPaulo()
  const de = sp.get('de') || `${hoje.slice(0, 8)}01`
  const ate = sp.get('ate') || hoje
  const [relatorio, abertas] = await Promise.all([
    relatorioPorPessoa({ companyId, de, ate, detalharColaboradorId: sp.get('colaborador') }, prisma),
    tarefasAbertasDemais(companyId, new Date(), prisma),
  ])
  return NextResponse.json({ relatorio, abertas })
}
