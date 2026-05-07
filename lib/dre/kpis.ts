// Engine de cálculo de KPIs derivados (Sub-etapa 5.4.C).
// Recebe DREResult e calcula KPIs estratégicos para visualização.
//
// Vocabulário alinhado ao DRETotals real (5.4.A): usa `impostosSobreLucro`
// e demais campos do schema oficial.

import type { DREResult, DRETotals } from './types'

// ============================================================
// Tipos
// ============================================================

export type FinancialHealth = 'HEALTHY' | 'ATTENTION' | 'ALERT'

export interface KPIWithVariation {
  value: number | null
  variation: number | null      // delta absoluto (vs comparison)
  variationPct: number | null   // delta % ou pp (depende do KPI; ver formatter)
  warning?: string              // alerta visual opcional
}

export interface FinancialHealthResult {
  status: FinancialHealth
  score: number               // 0-100 score interno
  positives: string[]         // pontos positivos detectados
  attentions: string[]        // pontos de atenção
}

export interface DREKPIs {
  // Linha 1 — Primários
  receitaLiquida: KPIWithVariation
  lucroLiquido: KPIWithVariation
  ebitda: KPIWithVariation       // aproximação = Resultado Operacional (v1)
  margemLiquida: KPIWithVariation

  // Linha 2 — Margens + Eficiência
  margemBruta: KPIWithVariation
  margemOperacional: KPIWithVariation
  crescimentoReceita: KPIWithVariation
  cargaTributaria: KPIWithVariation

  // Linha 3 — Operacionais
  despesaPessoal: KPIWithVariation
  despesaPessoalPct: KPIWithVariation
  resultadoFinanceiro: KPIWithVariation
  despesasOperacionaisTotal: KPIWithVariation

  // Saúde geral
  health: FinancialHealthResult
}

// ============================================================
// Cálculo principal
// ============================================================

// Aceita qualquer objeto com os shapes de totals + totalsComparison —
// inclui DREResult (engine, com Date) e DREResult serializado (client, com string).
type CalculateKPIsInput = Pick<DREResult, 'totals' | 'totalsComparison'>

export function calculateKPIs(dre: CalculateKPIsInput): DREKPIs {
  const t = dre.totals
  const comp = dre.totalsComparison

  const kpi = (
    value: number | null,
    variation: number | null,
    variationPct: number | null,
    warning?: string,
  ): KPIWithVariation => ({ value, variation, variationPct, warning })

  // ============================================================
  // LINHA 1 — Primários
  // ============================================================

  const receitaLiquida = kpi(
    t.receitaLiquida,
    comp.receitaLiquidaDelta,
    comp.receitaLiquidaPct,
  )

  const lucroLiquido = kpi(
    t.lucroLiquido,
    comp.lucroLiquidoDelta,
    comp.lucroLiquidoPct,
    t.lucroLiquido < 0 ? 'Prejuízo no período' : undefined,
  )

  // EBITDA aproximado = Resultado Operacional (v1, sem D&A separado).
  // Tooltip do card avisa que é aproximação.
  const ebitda = kpi(t.resultadoOperacional, null, null)

  // Margem Líquida: warning só pra margem positiva mas baixa (prejuízo já é
  // sinalizado em lucroLiquido).
  const margemLiquida = kpi(
    t.margemLiquida,
    null,
    comp.margemLiquidaDelta,  // delta em pp (percentage points)
    t.margemLiquida < 5 && t.margemLiquida >= 0
      ? 'Margem abaixo de 5%'
      : undefined,
  )

  // ============================================================
  // LINHA 2 — Margens + Eficiência
  // ============================================================

  // Margem bruta saudável >= 30% (referência genérica; setores variam).
  // Não emite warning quando é zero (caso vazio) ou negativa (já é prejuízo).
  const margemBruta = kpi(
    t.margemBruta,
    null,
    null,
    t.margemBruta < 30 && t.margemBruta > 0 ? 'Margem bruta baixa' : undefined,
  )

  const margemOperacional = kpi(t.margemOperacional, null, null)

  // Crescimento Receita = mesma % de variação da Receita Líquida vs comparison
  const crescimentoReceita = kpi(comp.receitaLiquidaPct, null, null)

  // Carga Tributária = (Deduções + IR/CSLL) / Receita Bruta * 100
  // Mede tributação total da operação (impostos s/ vendas + impostos s/ lucro).
  const cargaTribValor =
    t.receitaBruta !== 0
      ? ((t.totalDeducoes + t.impostosSobreLucro) / t.receitaBruta) * 100
      : null
  const cargaTributaria = kpi(
    cargaTribValor,
    null,
    null,
    cargaTribValor !== null && cargaTribValor > 25 ? 'Tributação alta' : undefined,
  )

  // ============================================================
  // LINHA 3 — Operacionais
  // ============================================================

  const despesaPessoal = kpi(t.totalDespesasPessoal, null, null)

  // % Pessoal sobre Receita Líquida — crítico em serviços (academia/salão/clínica).
  // Warning > 45% (folha consumindo margem).
  const pessoalPct =
    t.receitaLiquida !== 0
      ? (t.totalDespesasPessoal / t.receitaLiquida) * 100
      : null
  const despesaPessoalPct = kpi(
    pessoalPct,
    null,
    null,
    pessoalPct !== null && pessoalPct > 45 ? 'Folha alta (>45%)' : undefined,
  )

  const resultadoFinanceiro = kpi(
    t.resultadoFinanceiro,
    null,
    null,
    t.resultadoFinanceiro < 0 ? 'Resultado financeiro negativo' : undefined,
  )

  const despesasOperacionaisTotal = kpi(t.totalDespesasOperacionais, null, null)

  // ============================================================
  // SAÚDE FINANCEIRA
  // ============================================================

  const health = calculateFinancialHealth(t, comp)

  return {
    receitaLiquida,
    lucroLiquido,
    ebitda,
    margemLiquida,
    margemBruta,
    margemOperacional,
    crescimentoReceita,
    cargaTributaria,
    despesaPessoal,
    despesaPessoalPct,
    resultadoFinanceiro,
    despesasOperacionaisTotal,
    health,
  }
}

// ============================================================
// Cálculo de Saúde Financeira
// ============================================================

function calculateFinancialHealth(
  totals: DRETotals,
  comparison: DREResult['totalsComparison'],
): FinancialHealthResult {
  const positives: string[] = []
  const attentions: string[] = []

  const lucroPositivo = totals.lucroLiquido > 0
  const margemSaudavel = totals.margemLiquida >= 5
  const crescimentoPositivo =
    comparison.receitaLiquidaPct !== null && comparison.receitaLiquidaPct >= 0
  const margemBrutaSaudavel = totals.margemBruta >= 30
  const operacionalPositivo = totals.resultadoOperacional > 0

  // Pontos positivos
  if (lucroPositivo) positives.push('Lucro líquido positivo')
  if (margemSaudavel) {
    positives.push(
      `Margem líquida saudável (${totals.margemLiquida.toFixed(1).replace('.', ',')}%)`,
    )
  }
  if (crescimentoPositivo && comparison.receitaLiquidaPct !== null) {
    positives.push(
      `Receita crescendo (${comparison.receitaLiquidaPct >= 0 ? '+' : ''}${comparison.receitaLiquidaPct.toFixed(1).replace('.', ',')}%)`,
    )
  }
  if (margemBrutaSaudavel) {
    positives.push(
      `Margem bruta forte (${totals.margemBruta.toFixed(1).replace('.', ',')}%)`,
    )
  }
  if (operacionalPositivo && !lucroPositivo) {
    positives.push('Operação rentável (mas impactada por financeiro/IR)')
  }

  // Pontos de atenção
  if (!lucroPositivo) attentions.push('Prejuízo no período')
  if (lucroPositivo && !margemSaudavel) attentions.push('Margem líquida abaixo de 5%')
  if (comparison.receitaLiquidaPct !== null && comparison.receitaLiquidaPct < 0) {
    attentions.push(
      `Receita em queda (${comparison.receitaLiquidaPct.toFixed(1).replace('.', ',')}%)`,
    )
  }
  if (!margemBrutaSaudavel && totals.receitaLiquida > 0) {
    attentions.push(
      `Margem bruta baixa (${totals.margemBruta.toFixed(1).replace('.', ',')}%)`,
    )
  }
  if (
    totals.resultadoFinanceiro < 0 &&
    Math.abs(totals.resultadoFinanceiro) > Math.abs(totals.lucroLiquido) * 0.3
  ) {
    attentions.push('Resultado financeiro impactando lucro')
  }

  // Score 0-100 (multidimensional)
  let score = 50
  if (lucroPositivo) score += 25
  else score -= 25
  if (margemSaudavel) score += 15
  if (crescimentoPositivo) score += 10
  if (margemBrutaSaudavel) score += 5
  if (operacionalPositivo) score += 5
  if (totals.margemLiquida < 0) score -= 15

  score = Math.max(0, Math.min(100, score))

  // Status (ordem importa: prejuízo trumps everything)
  let status: FinancialHealth
  if (!lucroPositivo) {
    status = 'ALERT'
  } else if (margemSaudavel && crescimentoPositivo) {
    status = 'HEALTHY'
  } else {
    status = 'ATTENTION'
  }

  return { status, score, positives, attentions }
}

// ============================================================
// Helpers de classificação para UI
// ============================================================

export type KPITrendType = 'revenue' | 'expense' | 'margin' | 'percentage' | 'neutral'

// Determina cor semântica baseada no tipo de KPI e direção da variação:
//  - Receita/lucro/margem/percentage: ↑ é bom (positive)
//  - Despesa/carga: ↓ é bom (positive)
export function getVariationColor(
  type: KPITrendType,
  variationPct: number | null,
): 'positive' | 'negative' | 'neutral' {
  if (variationPct === null || variationPct === 0) return 'neutral'

  const isUp = variationPct > 0

  if (type === 'revenue' || type === 'margin' || type === 'percentage') {
    return isUp ? 'positive' : 'negative'
  }

  if (type === 'expense') {
    return isUp ? 'negative' : 'positive'
  }

  return 'neutral'
}
