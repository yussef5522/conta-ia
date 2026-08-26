// FLUXO DE CAIXA — API da tela (25/08). SÓ LEITURA: nenhum motor muda, nenhuma
// tabela nasce. Lê `transactions` já categorizadas + o saldo das contas.
//
// Uma query cobre os 6 meses do gráfico E o mês selecionado — assim o número do card
// e a barra do gráfico saem do MESMO conjunto de linhas e não têm como divergir.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  whereFluxoCaixa, SELECT_FLUXO, paraLinha, agruparFluxo, serieMensal, ultimosMeses,
} from '@/lib/fluxo-caixa/motor'

interface Params { params: Promise<{ id: string }> }

const MESES_GRAFICO = 6

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    await getAuthContext(request, companyId)

    const agora = new Date()
    const mesParam = request.nextUrl.searchParams.get('mes')
    const mes = /^\d{4}-\d{2}$/.test(mesParam ?? '')
      ? (mesParam as string)
      : `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`

    const [ano, m] = mes.split('-').map(Number)
    const inicioMes = new Date(Date.UTC(ano, m - 1, 1))
    const fimMes = new Date(Date.UTC(ano, m, 0, 23, 59, 59, 999))

    const meses = ultimosMeses(mes, MESES_GRAFICO)
    const inicioSerie = new Date(Date.UTC(Number(meses[0].slice(0, 4)), Number(meses[0].slice(5, 7)) - 1, 1))

    const [cruas, contas, transferencias] = await Promise.all([
      prisma.transaction.findMany({
        where: whereFluxoCaixa(companyId, { de: inicioSerie, ate: fimMes }),
        select: SELECT_FLUXO,
        take: 100_000,
      }),
      prisma.bankAccount.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, balance: true },
        orderBy: { name: 'asc' },
      }),
      // ⚠️ TRANSPARÊNCIA DA EXCLUSÃO: o dono vê QUANTO foi tirado por ser movimentação
      // entre contas próprias. Esconder a exclusão é tão ruim quanto não excluir — se o
      // número parecer errado, ele percebe (e o detector de par tem onde ser conferido).
      prisma.transaction.aggregate({
        where: {
          bankAccount: { companyId }, lifecycle: 'EFFECTED', date: { gte: inicioMes, lte: fimMes },
          OR: [{ type: 'TRANSFER' }, { isInternalTransfer: true }, { pendingTransfer: true }, { category: { dreGroup: 'TRANSFERENCIA' } }],
        },
        _sum: { amount: true }, _count: true,
      }),
    ])

    const linhas = cruas.map(paraLinha)
    const doMes = linhas.filter((l) => l.date >= inicioMes && l.date <= fimMes)

    const fluxo = agruparFluxo(doMes)
    const serie = serieMensal(linhas, meses, agora)
    const saldoContas = contas.reduce((s, c) => s + (c.balance ?? 0), 0)

    return NextResponse.json({
      mes,
      hoje: agora.toISOString().slice(0, 10),
      ...fluxo,
      saldoContas: Math.round((saldoContas + 1e-9) * 100) / 100,
      contas: contas.map((c) => ({ id: c.id, nome: c.name.trim(), saldo: c.balance ?? 0 })),
      serie,
      // as duas pernas de cada par entram na soma, então o valor é o movimentado bruto
      transferenciasExcluidas: { n: transferencias._count, total: Math.round(((transferencias._sum.amount ?? 0) + 1e-9) * 100) / 100 },
    })
  } catch (e) {
    return handleApiError(e)
  }
}
