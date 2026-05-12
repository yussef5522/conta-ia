// Mini-DRE compacta pra Dashboard Mundial — Sprint 1 Dia 2.
// Função PURA: extrai 5 linhas do `totals` do engine DRE + calcula deltas vs mês anterior.

import type { DRETotals } from '@/lib/dre/types'

export interface MiniDRELine {
  // Identificador estável (usar como `key` no React)
  id: 'receita-bruta' | 'deducoes' | 'lucro-bruto' | 'resultado-operacional' | 'lucro-liquido'
  label: string
  value: number
  // Delta absoluto vs mês anterior (current - previous)
  deltaAbsolute: number
  // Variação percentual (null quando previous é 0 — evita divisão por zero)
  deltaPercent: number | null
  // Semântica do delta: 'up' = bom; 'down' = ruim
  deltaDirection: 'up' | 'down' | 'flat'
  // Linha de destaque (Lucro Líquido) tem visual diferenciado
  highlighted: boolean
  // Linha de redução (Deduções) é exibida como negativo
  isReduction: boolean
}

export interface MiniDREResult {
  lines: MiniDRELine[]
  companyId: string
  // Margem líquida (pp) — usado em texto adicional opcional
  margemLiquida: number
}

type DeltaSemantic = 'higher-is-better' | 'lower-is-better'

export function computeMiniDRE(
  current: DRETotals,
  previous: DRETotals,
  companyId: string,
): MiniDREResult {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  // Cada linha tem semântica própria pro delta:
  //   Receita ↑ é bom (higher-is-better)
  //   Deduções ↑ é ruim (lower-is-better)
  //   Lucros e resultado ↑ são bons
  const lines: MiniDRELine[] = [
    makeLine('receita-bruta', 'Receita Bruta', current.receitaBruta, previous.receitaBruta, 'higher-is-better', false, false),
    makeLine('deducoes', '(-) Deduções', current.totalDeducoes, previous.totalDeducoes, 'lower-is-better', false, true),
    makeLine('lucro-bruto', 'Lucro Bruto', current.lucroBruto, previous.lucroBruto, 'higher-is-better', false, false),
    // EBITDA proxy → renomeado pra "Resultado Operacional" (honestidade técnica: sem D&A não é EBITDA real)
    makeLine('resultado-operacional', 'Resultado Operacional', current.resultadoOperacional, previous.resultadoOperacional, 'higher-is-better', false, false),
    makeLine('lucro-liquido', 'Lucro Líquido', current.lucroLiquido, previous.lucroLiquido, 'higher-is-better', true, false),
  ]

  return {
    lines,
    companyId,
    margemLiquida: current.margemLiquida,
  }
}

function makeLine(
  id: MiniDRELine['id'],
  label: string,
  value: number,
  previous: number,
  semantic: DeltaSemantic,
  highlighted: boolean,
  isReduction: boolean,
): MiniDRELine {
  const deltaAbsolute = value - previous
  const deltaPercent = previous !== 0 ? (deltaAbsolute / Math.abs(previous)) * 100 : null

  let deltaDirection: MiniDRELine['deltaDirection'] = 'flat'
  if (deltaAbsolute !== 0) {
    const upRaw = deltaAbsolute > 0
    deltaDirection = semantic === 'higher-is-better'
      ? (upRaw ? 'up' : 'down')
      : (upRaw ? 'down' : 'up')
  }

  return { id, label, value, deltaAbsolute, deltaPercent, deltaDirection, highlighted, isReduction }
}
