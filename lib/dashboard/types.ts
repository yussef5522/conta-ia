// Tipos do Dashboard Mundial — Sprint 1 Dia 1.

export interface SparkPoint {
  // Label legível (não usado no chart, mas útil pra tooltip futuro)
  label: string
  value: number
}

export interface KPIDelta {
  // Variação absoluta vs período de comparação (R$)
  absolute: number
  // Variação percentual (null quando comparação é zero — evita divisão por zero)
  percent: number | null
  // 'up' = melhor (alta na receita = up, queda na despesa = up — sinal semântico)
  // 'down' = pior
  // 'flat' = sem mudança ou sem comparação
  direction: 'up' | 'down' | 'flat'
}

export interface KPIValue {
  // Valor numérico bruto (sem formatação)
  value: number
  // Delta vs período de comparação (mês anterior, ou YoY conforme decidido)
  delta: KPIDelta
  // Pontos pra sparkline (até 30 ou 12 dependendo do KPI)
  spark: SparkPoint[]
}

export interface HeroKPIsResult {
  // Snapshot dos 4 KPIs principais (Hero Strip)
  saldoAtual: KPIValue          // Soma de balance das contas ativas
  receitaMes: KPIValue          // Receita Bruta do mês corrente
  despesasMes: KPIValue         // Custos + Despesas Operacionais
  resultadoMes: KPIValue        // Lucro Líquido + margem (extra info)
  // Margem líquida em pp (percentage points), só pro card Resultado
  margemLiquida: number
  // Metadata
  companyId: string
  referenceDate: Date
}
