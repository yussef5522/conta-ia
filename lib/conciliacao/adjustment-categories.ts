// Sprint A-effected Fase B.4.1 — Templates das 4 categorias de ajuste.
//
// Quando o user concilia com ajuste (boleto pago atrasado com juros, etc),
// a tx de ajuste precisa de uma categoria adequada pra o DRE separar do
// fornecedor original.
//
// Estas 4 categorias são pré-definidas e podem ser criadas opt-in por
// empresa via POST /api/conciliacao/adjustment-categories/create-defaults.

export type AdjustmentCategoryKey =
  | 'JUROS_MULTAS_BANCARIAS'
  | 'TARIFAS_BANCARIAS'
  | 'DESCONTOS_OBTIDOS'
  | 'AJUSTES_ARREDONDAMENTO'

export interface AdjustmentCategoryTemplate {
  key: AdjustmentCategoryKey
  name: string
  type: 'INCOME' | 'EXPENSE'
  dreGroup: string
  color: string
  icon: string
  description: string
  // Quando user adiciona ajuste, qual categoria recomendamos?
  suggestWhen: 'PAID_MORE' | 'PAID_LESS' | 'ROUNDING'
}

export const ADJUSTMENT_CATEGORY_TEMPLATES: AdjustmentCategoryTemplate[] = [
  {
    key: 'JUROS_MULTAS_BANCARIAS',
    name: 'Juros e Multas Bancárias',
    type: 'EXPENSE',
    dreGroup: 'DESPESAS_FINANCEIRAS',
    color: '#dc2626', // red-600
    icon: 'AlertCircle',
    description:
      'Juros e multas pagos por atraso em boletos, faturas e demais obrigações financeiras.',
    suggestWhen: 'PAID_MORE',
  },
  {
    key: 'TARIFAS_BANCARIAS',
    name: 'Tarifas Bancárias',
    type: 'EXPENSE',
    dreGroup: 'DESPESAS_FINANCEIRAS',
    color: '#f59e0b', // amber-500
    icon: 'Landmark',
    description:
      'Tarifas PIX, TED, DOC, IOF, manutenção de conta e demais cobranças do banco.',
    suggestWhen: 'PAID_MORE',
  },
  {
    key: 'DESCONTOS_OBTIDOS',
    name: 'Descontos Obtidos',
    type: 'INCOME',
    dreGroup: 'RECEITAS_FINANCEIRAS',
    color: '#10b981', // emerald-500
    icon: 'TrendingDown',
    description:
      'Descontos obtidos por pagamento antecipado de boletos e fornecedores.',
    suggestWhen: 'PAID_LESS',
  },
  {
    key: 'AJUSTES_ARREDONDAMENTO',
    name: 'Ajustes de Arredondamento',
    type: 'EXPENSE',
    dreGroup: 'OUTRAS_DESPESAS',
    color: '#6b7280', // gray-500
    icon: 'Sigma',
    description:
      'Pequenas diferenças de centavos entre valor do banco e valor do sistema (rounding).',
    suggestWhen: 'ROUNDING',
  },
]

/**
 * Sugere a key da categoria apropriada baseado no Diff (banco − selected).
 *
 * - diff > 0 + |diff| <= 1.00 → ARREDONDAMENTO
 * - diff > 0 + |diff| > 1.00 → JUROS_MULTAS (default; user pode mudar pra TARIFAS)
 * - diff < 0 → DESCONTOS_OBTIDOS
 * - diff == 0 → null (não precisa ajuste)
 */
export function suggestCategoryKeyForDiff(
  diff: number,
  roundingThreshold = 1.0,
): AdjustmentCategoryKey | null {
  if (Math.abs(diff) < 0.01) return null
  if (Math.abs(diff) <= roundingThreshold) return 'AJUSTES_ARREDONDAMENTO'
  if (diff > 0) return 'JUROS_MULTAS_BANCARIAS'
  return 'DESCONTOS_OBTIDOS'
}

/**
 * Filtra templates aplicáveis pra um determinado Diff.
 *
 * - diff > 0: Juros + Tarifas + (Arredondamento se ≤1) + Outro
 * - diff < 0: Descontos + (Arredondamento se ≤1) + Outro
 * - diff == 0: nada
 */
export function applicableTemplates(
  diff: number,
  roundingThreshold = 1.0,
): AdjustmentCategoryTemplate[] {
  if (Math.abs(diff) < 0.01) return []
  const out: AdjustmentCategoryTemplate[] = []
  if (diff > 0) {
    out.push(
      ADJUSTMENT_CATEGORY_TEMPLATES.find(
        (t) => t.key === 'JUROS_MULTAS_BANCARIAS',
      )!,
    )
    out.push(
      ADJUSTMENT_CATEGORY_TEMPLATES.find((t) => t.key === 'TARIFAS_BANCARIAS')!,
    )
  } else {
    out.push(
      ADJUSTMENT_CATEGORY_TEMPLATES.find((t) => t.key === 'DESCONTOS_OBTIDOS')!,
    )
  }
  if (Math.abs(diff) <= roundingThreshold) {
    out.push(
      ADJUSTMENT_CATEGORY_TEMPLATES.find(
        (t) => t.key === 'AJUSTES_ARREDONDAMENTO',
      )!,
    )
  }
  return out
}
