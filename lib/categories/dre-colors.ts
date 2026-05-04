// Paleta de cores por DRE Group — alinhada com Seção 10.2 do CONTA-IA-NORTE.md.
// Tailwind classes são pra `bg-` (bolinha colorida da árvore) e `text-` quando precisar.

export const DRE_COLOR_BG: Record<string, string> = {
  RECEITA_BRUTA: 'bg-emerald-500',
  RECEITAS_FINANCEIRAS: 'bg-emerald-300',
  OUTRAS_RECEITAS: 'bg-emerald-200',
  DEDUCOES: 'bg-red-500',
  CUSTO_PRODUTO_VENDIDO: 'bg-orange-500',
  DESPESAS_PESSOAL: 'bg-blue-500',
  DESPESAS_OPERACIONAIS: 'bg-orange-300',
  DESPESAS_ADMINISTRATIVAS: 'bg-orange-300',
  DESPESAS_COMERCIAIS: 'bg-orange-400',
  DESPESAS_FINANCEIRAS: 'bg-red-600',
  IMPOSTOS_SOBRE_LUCRO: 'bg-purple-700',
  DISTRIBUICAO_LUCROS: 'bg-amber-500',
  INVESTIMENTOS: 'bg-purple-400',
  TRANSFERENCIA: 'bg-slate-400',
}

export const DRE_GROUP_LABEL: Record<string, string> = {
  RECEITA_BRUTA: 'Receita Bruta',
  RECEITAS_FINANCEIRAS: 'Receitas Financeiras',
  OUTRAS_RECEITAS: 'Outras Receitas',
  DEDUCOES: 'Deduções',
  CUSTO_PRODUTO_VENDIDO: 'CPV/CMV',
  DESPESAS_PESSOAL: 'Despesas com Pessoal',
  DESPESAS_OPERACIONAIS: 'Despesas Operacionais',
  DESPESAS_ADMINISTRATIVAS: 'Despesas Administrativas',
  DESPESAS_COMERCIAIS: 'Despesas Comerciais',
  DESPESAS_FINANCEIRAS: 'Despesas Financeiras',
  IMPOSTOS_SOBRE_LUCRO: 'Impostos sobre Lucro',
  DISTRIBUICAO_LUCROS: 'Distribuição de Lucros',
  INVESTIMENTOS: 'Investimentos',
  TRANSFERENCIA: 'Transferência',
}

// Fallback pra dreGroup desconhecido ou null.
export const DRE_COLOR_FALLBACK = 'bg-slate-300'

export function getDreColorClass(dreGroup: string | null | undefined): string {
  if (!dreGroup) return DRE_COLOR_FALLBACK
  return DRE_COLOR_BG[dreGroup] ?? DRE_COLOR_FALLBACK
}

export function getDreLabel(dreGroup: string | null | undefined): string {
  if (!dreGroup) return 'Sem grupo'
  return DRE_GROUP_LABEL[dreGroup] ?? dreGroup
}
