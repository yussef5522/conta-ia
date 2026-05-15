// Drill-down + linhas conectoras do Cashflow Waterfall — Sprint 2 Dia 2.
// Funções PURAS — testáveis sem DB nem React.

import type { WaterfallBar } from './compute-waterfall'

// ============================================================
// Drill-down: URL de destino ao clicar numa barra
// ============================================================
//
// Nível 1 (Sprint 2 Dia 2): leva pra /transacoes filtrado por tipo + período.
// Barras-âncora (saldo inicial/final) → null (sem ação — saldo não tem
// transação única pra listar).
//
// TODO (FASE 3+4): quando a IA Contadora classificar as transações PENDING,
// adicionar drill-down por dreGroup-específico (ex: clicar "Folha" → só
// DESPESAS_PESSOAL). Exige `dreGroup` na API /api/transacoes + filtro na page.

export interface WaterfallDrillPeriod {
  startDate: Date
  endDate: Date
}

export function buildWaterfallDrillDownUrl(
  bar: Pick<WaterfallBar, 'kind'>,
  period: WaterfallDrillPeriod,
): string | null {
  // Âncoras não têm drill-down
  if (bar.kind === 'start' || bar.kind === 'end') return null

  const tipo = bar.kind === 'income' ? 'CREDIT' : 'DEBIT'
  const inicio = period.startDate.toISOString().slice(0, 10)
  const fim = period.endDate.toISOString().slice(0, 10)

  const qs = new URLSearchParams({ tipo, inicio, fim })
  return `/transacoes?${qs.toString()}`
}

// ============================================================
// Linhas conectoras: segmentos que ligam barras consecutivas
// ============================================================
//
// No waterfall, cada barra "termina" num nível de running total. A linha
// conectora horizontal liga esse nível ao começo da próxima barra.
//
// `exitLevel` = onde o running total fica APÓS a barra (em data-space, R$):
//   start/end  → rawValue (o próprio saldo)
//   income     → displayBase + displayValue (subiu)
//   expense    → displayBase (desceu; a barra vai de displayBase pra cima)

export interface ConnectorSegment {
  fromIndex: number
  toIndex: number
  // Nível Y (em R$, data-space) onde a linha horizontal fica.
  // O componente <Customized> traduz pra pixel via a escala do Recharts.
  y: number
}

export function exitLevel(bar: WaterfallBar): number {
  switch (bar.kind) {
    case 'start':
    case 'end':
      return bar.rawValue
    case 'income':
      return round2(bar.displayBase + bar.displayValue)
    case 'expense':
      return bar.displayBase
    default:
      return bar.displayBase
  }
}

export function computeConnectorSegments(bars: WaterfallBar[]): ConnectorSegment[] {
  const segments: ConnectorSegment[] = []
  for (let i = 0; i < bars.length - 1; i++) {
    segments.push({
      fromIndex: i,
      toIndex: i + 1,
      y: exitLevel(bars[i]),
    })
  }
  return segments
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
