// Sprint 5.0.4.0c1 — Helpers visuais pra variâncias.
// Cores semânticas, labels, ícones.

import type { VarianceLevel, VarianceSeverity } from './detect-variances'

export interface VarianceVisual {
  /** Símbolo curto pra badges (↑↑, ↑, ━, ↓, ↓↓, 🆕, ✕) */
  symbol: string
  /** Label longo legível ("Subida crítica", "Apareceu este mês"...) */
  label: string
  /** Tom semântico pra fundo/borda/badge */
  tone: 'red' | 'amber' | 'yellow' | 'sky' | 'purple' | 'slate'
}

export const VARIANCE_LEVEL_VISUAL: Record<VarianceLevel, VarianceVisual> = {
  CRITICAL_UP: { symbol: '↑↑', label: 'Subida crítica', tone: 'red' },
  HIGH_UP: { symbol: '↑', label: 'Subida alta', tone: 'amber' },
  MODERATE_UP: { symbol: '↑', label: 'Subida moderada', tone: 'yellow' },
  STABLE: { symbol: '━', label: 'Estável', tone: 'slate' },
  MODERATE_DOWN: { symbol: '↓', label: 'Queda moderada', tone: 'sky' },
  HIGH_DOWN: { symbol: '↓', label: 'Queda alta', tone: 'sky' },
  CRITICAL_DOWN: { symbol: '↓↓', label: 'Queda crítica', tone: 'sky' },
  NEW: { symbol: '🆕', label: 'Apareceu este mês', tone: 'purple' },
  DISAPPEARED: { symbol: '✕', label: 'Sumiu este mês', tone: 'slate' },
}

/**
 * Classes Tailwind por severidade (badge + card border + background).
 * Safelist via uso direto neste arquivo (Tailwind escaneia).
 */
export interface SeverityClasses {
  cardClass: string
  badgeClass: string
  iconClass: string
  textClass: string
}

export const SEVERITY_CLASSES: Record<VarianceSeverity, SeverityClasses> = {
  critical: {
    cardClass:
      'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20',
    badgeClass:
      'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-700 dark:text-red-300',
  },
  high: {
    cardClass:
      'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20',
    badgeClass:
      'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
  moderate: {
    cardClass:
      'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/40 dark:bg-yellow-950/20',
    badgeClass:
      'bg-yellow-500 text-slate-900 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
    textClass: 'text-yellow-700 dark:text-yellow-300',
  },
  low: {
    cardClass: 'border-slate-200 bg-slate-50/50 dark:border-slate-700',
    badgeClass: 'bg-slate-500 text-white hover:bg-slate-600',
    iconClass: 'text-slate-500 dark:text-slate-400',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
}

/**
 * Classes específicas para cards "NEW" (purple) e "DISAPPEARED" (slate-dashed).
 * Sobrescreve severity-based pra dar destaque visual a esses tipos.
 */
export function classesForLevel(level: VarianceLevel, severity: VarianceSeverity): SeverityClasses {
  if (level === 'NEW') {
    return {
      cardClass:
        'border-purple-200 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20',
      badgeClass:
        'bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800',
      iconClass: 'text-purple-600 dark:text-purple-400',
      textClass: 'text-purple-700 dark:text-purple-300',
    }
  }
  if (level === 'DISAPPEARED') {
    return {
      cardClass:
        'border-slate-300 border-dashed bg-slate-50/40 dark:border-slate-700 dark:bg-slate-900/20',
      badgeClass: 'bg-slate-400 text-white hover:bg-slate-500',
      iconClass: 'text-slate-500 dark:text-slate-400',
      textClass: 'text-slate-700 dark:text-slate-300',
    }
  }
  return SEVERITY_CLASSES[severity]
}

/**
 * Label localizada do dreGroup pra mostrar na UI.
 * Espelha lib/dre/types.ts mas em PT-BR curto.
 */
export const DRE_GROUP_LABEL: Record<string, string> = {
  RECEITA_BRUTA: 'Receita',
  DEDUCOES_RECEITA: 'Deduções',
  CUSTO_PRODUTO_VENDIDO: 'Custos',
  CUSTO_SERVICOS: 'Custos',
  DESPESAS_PESSOAL: 'Pessoal',
  DESPESAS_COMERCIAIS: 'Comerciais',
  DESPESAS_ADMINISTRATIVAS: 'Administrativas',
  OUTRAS_DESPESAS: 'Outras',
  OUTRAS_RECEITAS: 'Outras Receitas',
  RECEITAS_FINANCEIRAS: 'Financeiras',
  DESPESAS_FINANCEIRAS: 'Financeiras',
  IMPOSTOS: 'Impostos',
  DISTRIBUICAO_LUCROS: 'Distribuição',
  AJUSTE_SALDO: 'Ajuste',
  TRANSFERENCIA: 'Transferência',
}

export function dreGroupLabel(group: string | null): string {
  if (!group) return 'Sem grupo'
  return DRE_GROUP_LABEL[group] ?? group.replace(/_/g, ' ').toLowerCase()
}
