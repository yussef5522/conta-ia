// Saúde Financeira — Sprint 1 Dia 4.
// 4 indicadores: Burn Rate, Runway, Variação 30 dias, Margem.
// Função PURA — testável sem DB.

export interface HealthAccountInput {
  balance: number
  creditLimit: number
  allowNegativeBalance: boolean
}

export interface BurnMonthBucket {
  monthKey: string // ex: "2026-02"
  expense: number  // soma de DEBIT não-TRANSFER do mês
  income: number   // soma de CREDIT não-TRANSFER do mês
}

export interface ComputeHealthInput {
  companyId: string
  referenceDate: Date
  // Contas bancárias ativas pra cálculo de disponibilidade (saldo + cheque especial)
  accounts: HealthAccountInput[]
  // Histórico dos 3 meses anteriores (não inclui o atual). Pode vir com menos
  // de 3 meses se a empresa for muito nova — função reflete isso no status.
  burnHistory: BurnMonthBucket[]
  // Net dos últimos 30 dias (income - expense, já excluído TRANSFER)
  net30d: number
  // Mês atual (do DRE)
  currentMonthRevenue: number
  currentMonthNetIncome: number
}

export type HealthStatus = 'green' | 'yellow' | 'red' | 'gray'

export interface HealthIndicator {
  id: 'burn-rate' | 'runway' | 'variation-30d' | 'margin'
  label: string
  // Valor numérico bruto (null quando não calculável)
  value: number | null
  // String formatada pra UI (ex: "R$ 28.000", "7,4 meses", "Mais de 2 anos", "N/A")
  display: string
  status: HealthStatus
  statusLabel: string
  // Progress bar (0-100). null quando indicador não usa barra.
  progressPercent: number | null
  // Sub-info opcional (ex: "65% da receita", "+3,2% vs há 30 dias")
  subtext: string | null
}

export interface HealthCheckResult {
  companyId: string
  indicators: HealthIndicator[]
}

const RUNWAY_CAP_MONTHS = 24
const REQUIRED_MONTHS_FOR_BURN = 3

export function computeHealthCheck(input: ComputeHealthInput): HealthCheckResult {
  if (!input.companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  return {
    companyId: input.companyId,
    indicators: [
      computeBurnRate(input),
      computeRunway(input),
      computeVariation30d(input),
      computeMargin(input),
    ],
  }
}

// ============================================================
// Burn Rate
// ============================================================

function computeBurnRate(input: ComputeHealthInput): HealthIndicator {
  const monthsCount = input.burnHistory.length

  // Empty state: dados insuficientes
  if (monthsCount < REQUIRED_MONTHS_FOR_BURN) {
    return {
      id: 'burn-rate',
      label: 'Burn Rate',
      value: null,
      display: '—',
      status: 'gray',
      statusLabel: `Acumulando dados... (${monthsCount}/${REQUIRED_MONTHS_FOR_BURN} meses)`,
      progressPercent: null,
      subtext: null,
    }
  }

  const totalExpense = input.burnHistory.reduce((s, m) => s + m.expense, 0)
  const totalIncome = input.burnHistory.reduce((s, m) => s + m.income, 0)
  const avgExpense = totalExpense / monthsCount
  const avgIncome = totalIncome / monthsCount

  // Status vs receita média (margem zero = morte lenta)
  let status: HealthStatus
  let statusLabel: string
  let subtext: string

  if (avgIncome === 0) {
    // Sem receita média mas tem despesa → crítico (pura queima)
    status = avgExpense > 0 ? 'red' : 'gray'
    statusLabel = avgExpense > 0 ? 'Crítico' : 'Sem dados'
    subtext = avgExpense > 0 ? 'Despesas sem receita' : null!
  } else {
    const ratio = avgExpense / avgIncome
    const ratioPct = Math.round(ratio * 100)
    if (ratio <= 0.7) {
      status = 'green'
      statusLabel = 'Saudável'
    } else if (ratio <= 0.9) {
      status = 'yellow'
      statusLabel = 'Atenção'
    } else {
      status = 'red'
      statusLabel = 'Crítico'
    }
    subtext = `${ratioPct}% da receita`
  }

  const progressPercent =
    avgIncome > 0 ? Math.min(100, Math.round((avgExpense / avgIncome) * 100)) : 100

  return {
    id: 'burn-rate',
    label: 'Burn Rate',
    value: avgExpense,
    display: formatBRLCompact(avgExpense),
    status,
    statusLabel,
    progressPercent,
    subtext: subtext ?? null,
  }
}

// ============================================================
// Runway
// ============================================================

function computeRunway(input: ComputeHealthInput): HealthIndicator {
  // Disponibilidade total: saldo + cheque especial (onde permitido)
  const availableTotal = input.accounts.reduce((sum, acc) => {
    if (acc.allowNegativeBalance) {
      return sum + acc.balance + acc.creditLimit
    }
    return sum + Math.max(0, acc.balance)
  }, 0)

  const monthsCount = input.burnHistory.length

  // Empty state: sem dados pra burn
  if (monthsCount < REQUIRED_MONTHS_FOR_BURN) {
    return {
      id: 'runway',
      label: 'Runway',
      value: null,
      display: '—',
      status: 'gray',
      statusLabel: `Acumulando dados... (${monthsCount}/${REQUIRED_MONTHS_FOR_BURN} meses)`,
      progressPercent: null,
      subtext: null,
    }
  }

  const totalExpense = input.burnHistory.reduce((s, m) => s + m.expense, 0)
  const avgExpense = totalExpense / monthsCount

  // Burn zero → tempo infinito
  if (avgExpense <= 0) {
    return {
      id: 'runway',
      label: 'Runway',
      value: null,
      display: '∞',
      status: 'green',
      statusLabel: 'Sem queima',
      progressPercent: 100,
      subtext: null,
    }
  }

  // Sem disponibilidade → 0 meses
  if (availableTotal <= 0) {
    return {
      id: 'runway',
      label: 'Runway',
      value: 0,
      display: '0 meses',
      status: 'red',
      statusLabel: 'Esgotado',
      progressPercent: 0,
      subtext: 'Limite estourado',
    }
  }

  const monthsRaw = availableTotal / avgExpense

  // Cap pra display
  if (monthsRaw > RUNWAY_CAP_MONTHS) {
    return {
      id: 'runway',
      label: 'Runway',
      value: monthsRaw,
      display: 'Mais de 2 anos',
      status: 'green',
      statusLabel: 'Excelente',
      progressPercent: 100,
      subtext: 'Reserva confortável',
    }
  }

  let status: HealthStatus
  let statusLabel: string
  if (monthsRaw >= 12) {
    status = 'green'
    statusLabel = 'Saudável'
  } else if (monthsRaw >= 6) {
    status = 'yellow'
    statusLabel = 'Atenção'
  } else {
    status = 'red'
    statusLabel = 'Crítico'
  }

  // Inclui hint de cheque especial no subtext se ele compõe parte da disponibilidade
  const balanceOnly = input.accounts.reduce((s, a) => s + Math.max(0, a.balance), 0)
  const usingCreditLine = availableTotal - balanceOnly > 0.01
  const subtext = usingCreditLine ? 'Incluindo cheque especial' : null

  return {
    id: 'runway',
    label: 'Runway',
    value: monthsRaw,
    display: `${formatNumber(monthsRaw, 1)} meses`,
    status,
    statusLabel,
    progressPercent: Math.min(100, Math.round((monthsRaw / RUNWAY_CAP_MONTHS) * 100)),
    subtext,
  }
}

// ============================================================
// Variação 30 dias
// ============================================================

function computeVariation30d(input: ComputeHealthInput): HealthIndicator {
  const net = input.net30d

  let status: HealthStatus
  let statusLabel: string
  if (net > 0) {
    status = 'green'
    statusLabel = 'Subindo'
  } else if (net < 0) {
    status = 'red'
    statusLabel = 'Caindo'
  } else {
    status = 'gray'
    statusLabel = 'Estável'
  }

  const sign = net > 0 ? '+' : net < 0 ? '-' : ''
  const display = net === 0 ? formatBRLCompact(0) : `${sign}${formatBRLCompact(Math.abs(net))}`

  return {
    id: 'variation-30d',
    label: 'Variação 30 dias',
    value: net,
    display,
    status,
    statusLabel,
    progressPercent: null,
    subtext: 'Saldo líquido últimos 30 dias',
  }
}

// ============================================================
// Margem
// ============================================================

function computeMargin(input: ComputeHealthInput): HealthIndicator {
  const revenue = input.currentMonthRevenue
  const netIncome = input.currentMonthNetIncome

  if (revenue === 0) {
    return {
      id: 'margin',
      label: 'Margem',
      value: null,
      display: 'N/A',
      status: 'gray',
      statusLabel: 'Sem receita',
      progressPercent: null,
      subtext: 'Mês sem receita registrada',
    }
  }

  const marginPct = (netIncome / revenue) * 100

  let status: HealthStatus
  let statusLabel: string
  if (marginPct >= 20) {
    status = 'green'
    statusLabel = 'Saudável'
  } else if (marginPct >= 10) {
    status = 'yellow'
    statusLabel = 'OK'
  } else {
    status = 'red'
    statusLabel = marginPct < 0 ? 'Prejuízo' : 'Apertada'
  }

  const display = `${marginPct >= 0 ? '' : '-'}${Math.abs(marginPct).toFixed(1)}%`
  const progressPercent = Math.max(0, Math.min(100, Math.round(marginPct)))

  return {
    id: 'margin',
    label: 'Margem',
    value: marginPct,
    display,
    status,
    statusLabel,
    progressPercent,
    subtext: 'Lucro Líquido / Receita Bruta',
  }
}

// ============================================================
// Helpers de formatação compacta
// ============================================================

function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// "R$ 28k" / "R$ 1,2M" etc — formato compacto pra cards apertados.
function formatBRLCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    return `R$ ${formatNumber(n / 1_000_000, 1)}M`
  }
  if (abs >= 1_000) {
    return `R$ ${formatNumber(n / 1_000, 1)}k`
  }
  return `R$ ${formatNumber(n, 2)}`
}
