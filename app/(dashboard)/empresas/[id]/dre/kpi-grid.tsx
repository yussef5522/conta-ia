'use client'

// Grid de 12 KPIs em 3 linhas temáticas (Sub-etapa 5.4.C).
// Cada card tem tooltip educativo + warning quando aplicável.

import { KPICard } from './kpi-card'
import type { DREKPIs } from '@/lib/dre/kpis'

interface KPIGridProps {
  kpis: DREKPIs
}

export function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <div className="space-y-4">
      {/* ========== LINHA 1 — Indicadores Primários ========== */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Indicadores Primários
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Receita Líquida"
            data={kpis.receitaLiquida}
            formatter="brl"
            trendType="revenue"
            tooltip="Receita Bruta menos as deduções (impostos sobre vendas, devoluções, abatimentos). É a base de cálculo das margens."
            size="large"
          />
          <KPICard
            label="Lucro Líquido"
            data={kpis.lucroLiquido}
            formatter="brl"
            trendType="revenue"
            tooltip="Lucro final do exercício, após dedução de todos os custos, despesas, resultado financeiro e impostos sobre o lucro (IRPJ/CSLL)."
            size="large"
          />
          <KPICard
            label="EBITDA (aprox.)"
            data={kpis.ebitda}
            formatter="brl"
            trendType="revenue"
            tooltip="Earnings Before Interest, Taxes, Depreciation and Amortization. Mede a performance operacional pura, antes de juros e impostos. ⚠️ Aproximação: usa Resultado Operacional como base (sem depreciação isolada nesta versão)."
            size="large"
          />
          <KPICard
            label="Margem Líquida"
            data={kpis.margemLiquida}
            formatter="percent_pp"
            trendType="margin"
            tooltip="Lucro Líquido dividido pela Receita Líquida. Indica quanto da receita se converte em lucro final. Saudável: ≥ 5%. Variação exibida em pontos percentuais (pp)."
            size="large"
          />
        </div>
      </div>

      {/* ========== LINHA 2 — Margens e Eficiência ========== */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Margens e Eficiência
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Margem Bruta"
            data={kpis.margemBruta}
            formatter="percent"
            trendType="margin"
            tooltip="Lucro Bruto dividido pela Receita Líquida. Mede a eficiência da operação principal antes das despesas operacionais. Saudável: ≥ 30%."
          />
          <KPICard
            label="Margem Operacional"
            data={kpis.margemOperacional}
            formatter="percent"
            trendType="margin"
            tooltip="Resultado Operacional dividido pela Receita Líquida. Indica eficiência operacional global, antes de financeiro e impostos."
          />
          <KPICard
            label="Crescimento Receita"
            data={kpis.crescimentoReceita}
            formatter="percent"
            trendType="percentage"
            tooltip="Variação percentual da Receita Líquida vs período de comparação selecionado. — quando não há comparação configurada."
          />
          <KPICard
            label="Carga Tributária"
            data={kpis.cargaTributaria}
            formatter="percent"
            trendType="expense"
            tooltip="Total de tributos (deduções sobre vendas + IRPJ/CSLL) dividido pela Receita Bruta. Atenção quando ultrapassa 25% — pode indicar regime tributário inadequado."
          />
        </div>
      </div>

      {/* ========== LINHA 3 — Indicadores Operacionais ========== */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Indicadores Operacionais
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Despesa Pessoal"
            data={kpis.despesaPessoal}
            formatter="brl"
            trendType="expense"
            tooltip="Total de gastos com folha: salários, encargos, benefícios e terceirizados. Crítico para serviços (academia, restaurante, salão, clínica)."
          />
          <KPICard
            label="% Pessoal s/ Receita"
            data={kpis.despesaPessoalPct}
            formatter="percent"
            trendType="expense"
            tooltip="Despesa Pessoal dividida pela Receita Líquida. Para serviços, atenção quando > 45% (folha alta consome margem operacional)."
          />
          <KPICard
            label="Resultado Financeiro"
            data={kpis.resultadoFinanceiro}
            formatter="brl"
            trendType="revenue"
            tooltip="Receitas Financeiras menos Despesas Financeiras. Se negativo, indica que juros pagos superam rendimentos recebidos."
          />
          <KPICard
            label="Despesas Operacionais"
            data={kpis.despesasOperacionaisTotal}
            formatter="brl"
            trendType="expense"
            tooltip="Soma de Despesas Pessoal + Comerciais + Administrativas + Outras. Total de gastos para manter a operação rodando."
          />
        </div>
      </div>
    </div>
  )
}
