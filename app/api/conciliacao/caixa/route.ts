// ⭐⭐ A CAIXA DE ENTRADA DO BANCO — a lista das duas abas (15/09/2026).
//
// ⛔ **UMA LINHA, UMA ESTAÇÃO:** o payload devolve os contadores das TRÊS (saídas, entradas,
// arquivo) e o total, porque o invariante `saídas + entradas + arquivo == total` só é
// verificável se ele estiver **na tela**. Número que fecha por fora é promessa.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { contarEstacoes, estacaoDaLinha, comoFoiResolvida, sentidoDaLinha, acoesDoSentido, type LinhaParaEstacao } from '@/lib/conciliacao/caixa-de-entrada'

const SELECT = {
  id: true, type: true, amount: true, date: true, description: true, counterpartyName: true,
  categoryId: true, reconciledWithId: true, isCardPayment: true, transferGroupId: true,
  isInternalTransfer: true, pendingTransfer: true, ignoredAt: true, bankAccountId: true,
  reconciledFrom: { select: { id: true } },
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true } },
} as const

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const empresaId = url.searchParams.get('empresaId') ?? ''
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  if (!ctx.permissions.some((k) => k === '*' || k === 'transaction.view')) {
    return NextResponse.json({ erro: 'Sem permissão.', permission: 'transaction.view' }, { status: 403 })
  }

  const contas = await prisma.bankAccount.findMany({ where: { companyId: empresaId }, select: { id: true, name: true } })
  const nomeConta = new Map(contas.map((c) => [c.id, c.name]))
  /**
   * ⚠️ O CORTE DE ÉPOCA VALE AQUI (decisão do dono, 15/09): *"os créditos históricos já
   * categorizados nascem em PAZ no arquivo, não como pendência retroativa"*. Sem ele, a
   * caixa abriria com anos de extrato pedindo decisão que o dono já tomou.
   */
  const empresa = await prisma.company.findUnique({ where: { id: empresaId }, select: { conciliarAPartirDe: true } })
  const corte = empresa?.conciliarAPartirDe ?? null

  const rows = await prisma.transaction.findMany({
    where: {
      bankAccountId: { in: contas.map((c) => c.id) },
      origin: 'OFX', lifecycle: 'EFFECTED',
      ...(corte ? { date: { gte: corte } } : {}),
    },
    select: SELECT,
    orderBy: { date: 'desc' },
    take: 400,
  })

  const paraLei = (r: (typeof rows)[number]): LinhaParaEstacao => ({
    categoryId: r.categoryId, reconciledWithId: r.reconciledWithId,
    temReconciledFrom: r.reconciledFrom.length > 0, isCardPayment: r.isCardPayment,
    temParcelaVinculada: !!r.loanInstallmentPaid || r.loanInstallmentPayments.length > 0,
    transferGroupId: r.transferGroupId, isInternalTransfer: r.isInternalTransfer,
    pendingTransfer: r.pendingTransfer, ignoredAt: r.ignoredAt, tipo: r.type,
  })

  const linhas = rows.map((r) => {
    const l = paraLei(r)
    return {
      id: r.id, tipo: r.type, valor: r.amount, data: r.date.toISOString().slice(0, 10),
      descricao: r.description ?? '', contraparte: r.counterpartyName,
      conta: nomeConta.get(r.bankAccountId ?? '') ?? null,
      sentido: sentidoDaLinha(r.type),
      estacao: estacaoDaLinha(l),
      // ⭐ o selo do ARQUIVO diz COMO foi resolvida — nunca um "ok" genérico
      resolvidaComo: comoFoiResolvida(l),
      acoes: estacaoDaLinha(l) === 'CAIXA' ? acoesDoSentido(sentidoDaLinha(r.type)) : [],
    }
  })

  const contadores = contarEstacoes(rows.map(paraLei))
  return NextResponse.json({
    contadores,
    // ⚠️ a tela desenha SÓ a caixa; o arquivo tem casa própria (Movimentações)
    linhas: linhas.filter((l) => l.estacao === 'CAIXA'),
  })
}
