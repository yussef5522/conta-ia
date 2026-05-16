// Query builders multi-tenant pra fluxo de caixa.
// Sprint 0.5 Dia 3.
//
// ⚠️ ISOLAMENTO MULTI-TENANT INVIOLÁVEL ⚠️
//
// Estas funções são o ÚNICO ponto de construção dos filtros `where` pras queries
// de fluxo de caixa. Toda rota DEVE usar elas, garantindo que NUNCA uma transação
// de outra empresa vaze pro cálculo. Testar o contrato dessas funções é como
// blindamos o sistema.

import type { Prisma } from '@prisma/client'

export interface CashflowQueryPeriod {
  startDate: Date
  endDate: Date
}

// Fluxo CONSOLIDADO da empresa: todas as contas dela, EXCLUI TRANSFER (não infla)
// E EXCLUI também categoria "Transferências" (dreGroup=TRANSFERENCIA), pra
// quando o user marca uma transação manual como sendo movimentação interna.
export function buildConsolidatedCashflowWhere(
  companyId: string,
  period: CashflowQueryPeriod,
): Prisma.TransactionWhereInput {
  if (!companyId) {
    throw new Error(
      'companyId é obrigatório (isolamento multi-tenant inviolável)',
    )
  }
  if (period.startDate.getTime() > period.endDate.getTime()) {
    throw new Error('startDate não pode ser maior que endDate')
  }

  return {
    bankAccount: { companyId },
    type: { not: 'TRANSFER' },
    date: { gte: period.startDate, lte: period.endDate },
    // Exclui também transações categorizadas como "Transferências"
    // (categoria criada pelo backfill com dreGroup=TRANSFERENCIA).
    NOT: { category: { dreGroup: 'TRANSFERENCIA' } },
  }
}

// Fluxo POR CONTA: uma bankAccount específica, INCLUI TRANSFER (visibilidade total).
export function buildByAccountCashflowWhere(
  bankAccountId: string,
  period: CashflowQueryPeriod,
): Prisma.TransactionWhereInput {
  if (!bankAccountId) {
    throw new Error('bankAccountId é obrigatório')
  }
  if (period.startDate.getTime() > period.endDate.getTime()) {
    throw new Error('startDate não pode ser maior que endDate')
  }

  return {
    bankAccountId,
    date: { gte: period.startDate, lte: period.endDate },
  }
}
