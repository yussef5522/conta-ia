// Sprint 5.0.4.0b Fase 5 — Função pura Folha de Pagamento.
//
// Agrupa por employeeId + breakdown por tipo + evolução mensal.

export interface PayrollAggInput {
  employeeId: string
  amount: number
  count: number
}

export interface EmployeeMeta {
  id: string
  nome: string
  tipo: string
  ativo: boolean
}

export interface PayrollRow {
  employeeId: string
  nome: string
  tipo: string
  ativo: boolean
  amount: number
  count: number
  percentDoTotal: number
}

export interface PayrollTypeBucket {
  tipo: string
  count: number
  amount: number
  percent: number
}

export interface PayrollResult {
  rows: PayrollRow[]
  byType: PayrollTypeBucket[]
  totals: {
    funcionariosPagos: number
    funcionariosAtivos: number
    valorTotal: number
    transacoesCount: number
    mediaPorFuncionario: number
  }
}

export interface ComputePayrollInput {
  aggregated: PayrollAggInput[]
  employees: EmployeeMeta[]
  /** Total de funcionários ativos (count separado pra mostrar mesmo se 0 transações) */
  totalFuncionariosAtivos: number
}

export function computePayroll(input: ComputePayrollInput): PayrollResult {
  const { aggregated, employees, totalFuncionariosAtivos } = input

  const empById = new Map(employees.map((e) => [e.id, e]))

  const valorTotal = aggregated.reduce((s, a) => s + a.amount, 0)
  const transacoesCount = aggregated.reduce((s, a) => s + a.count, 0)

  // Rows ordenadas por valor desc
  const rows: PayrollRow[] = aggregated
    .map((a) => {
      const meta = empById.get(a.employeeId)
      return {
        employeeId: a.employeeId,
        nome: meta?.nome ?? 'Funcionário sem nome',
        tipo: meta?.tipo ?? 'OUTRO',
        ativo: meta?.ativo ?? false,
        amount: a.amount,
        count: a.count,
        percentDoTotal: valorTotal > 0 ? (a.amount / valorTotal) * 100 : 0,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  // Breakdown por tipo
  const typeMap = new Map<string, { count: number; amount: number }>()
  for (const r of rows) {
    const existing = typeMap.get(r.tipo) ?? { count: 0, amount: 0 }
    existing.count++
    existing.amount += r.amount
    typeMap.set(r.tipo, existing)
  }
  const byType: PayrollTypeBucket[] = Array.from(typeMap.entries())
    .map(([tipo, v]) => ({
      tipo,
      count: v.count,
      amount: v.amount,
      percent: valorTotal > 0 ? (v.amount / valorTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const funcionariosPagos = rows.length
  const mediaPorFuncionario = funcionariosPagos > 0 ? valorTotal / funcionariosPagos : 0

  return {
    rows,
    byType,
    totals: {
      funcionariosPagos,
      funcionariosAtivos: totalFuncionariosAtivos,
      valorTotal,
      transacoesCount,
      mediaPorFuncionario,
    },
  }
}
