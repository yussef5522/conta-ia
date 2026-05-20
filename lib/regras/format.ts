// Helpers PUROS de UI pra regras (AiLearningRule) — Sprint 2.1.

export type RuleMatchType = 'EXACT' | 'CONTAINS' | 'CNPJ' | 'NORMALIZED'

export function matchTypeLabel(t: string): string {
  switch (t) {
    case 'EXACT': return 'Exato'
    case 'CONTAINS': return 'Contém'
    case 'CNPJ': return 'CNPJ'
    case 'NORMALIZED': return 'Normalizado'
    default: return t
  }
}

export function matchTypeColor(t: string): { bg: string; text: string } {
  switch (t) {
    case 'EXACT': return { bg: 'rgba(34,197,94,0.10)', text: '#86efac' }
    case 'CONTAINS': return { bg: 'rgba(99,102,241,0.10)', text: '#a5b4fc' }
    case 'CNPJ': return { bg: 'rgba(168,85,247,0.10)', text: '#d8b4fe' }
    case 'NORMALIZED': return { bg: 'rgba(239,159,39,0.10)', text: '#EF9F27' }
    default: return { bg: 'rgba(115,115,115,0.10)', text: '#a3a3a3' }
  }
}

export type ConfidenceTier = 'high' | 'medium' | 'low'

export function confidenceTier(c: number): ConfidenceTier {
  if (c >= 0.9) return 'high'
  if (c >= 0.7) return 'medium'
  return 'low'
}

export function confidenceLabel(c: number): string {
  const t = confidenceTier(c)
  return t === 'high' ? 'Alta' : t === 'medium' ? 'Média' : 'Baixa'
}

export function confidencePercent(c: number): string {
  return `${Math.round(c * 100)}%`
}

export function confidenceColors(c: number): { bg: string; text: string } {
  const t = confidenceTier(c)
  if (t === 'high') return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' }
  if (t === 'medium') return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' }
  return { bg: 'bg-zinc-500/10', text: 'text-zinc-600 dark:text-zinc-400' }
}

export function fonteLabel(f: string): string {
  return f === 'CLAUDE' ? 'IA' : 'Manual'
}
