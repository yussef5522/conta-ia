// Sprint PF FATIA 1 — Plano de contas PF padrão (15 categorias).
//
// Aplicadas automaticamente ao criar um PersonalProfile (igual o PJ
// aplica template ao criar Company). User pode customizar depois.
//
// FUNÇÃO PURA: sem deps de Prisma/fetch. Testável.

export interface PersonalCategoryTemplate {
  name: string
  type: 'INCOME' | 'EXPENSE'
  color: string
  icon: string
}

export const PF_DEFAULT_CATEGORIES: readonly PersonalCategoryTemplate[] = [
  // Receitas
  { name: 'Salário', type: 'INCOME', color: '#10b981', icon: 'Wallet' },
  // Pró-labore/Lucros é placeholder pra Fatia 4 (ponte PJ→PF).
  // Pré-criar agora deixa pronto pra quando a ponte for ativada.
  { name: 'Pró-labore / Lucros', type: 'INCOME', color: '#059669', icon: 'Briefcase' },
  { name: 'Outros recebimentos', type: 'INCOME', color: '#34d399', icon: 'PlusCircle' },

  // Despesas
  { name: 'Alimentação', type: 'EXPENSE', color: '#f59e0b', icon: 'Utensils' },
  { name: 'Transporte', type: 'EXPENSE', color: '#3b82f6', icon: 'Car' },
  { name: 'Moradia', type: 'EXPENSE', color: '#8b5cf6', icon: 'Home' },
  { name: 'Contas (luz, água, internet)', type: 'EXPENSE', color: '#ef4444', icon: 'Zap' },
  // Telefone/Celular separado de "Contas" — Sprint Retirada-Despesa-PF.
  { name: 'Telefone/Celular', type: 'EXPENSE', color: '#0891b2', icon: 'Phone' },
  { name: 'Saúde', type: 'EXPENSE', color: '#ec4899', icon: 'Heart' },
  { name: 'Educação', type: 'EXPENSE', color: '#06b6d4', icon: 'BookOpen' },
  { name: 'Lazer', type: 'EXPENSE', color: '#a855f7', icon: 'Music' },
  { name: 'Vestuário', type: 'EXPENSE', color: '#f97316', icon: 'Shirt' },
  { name: 'Investimentos', type: 'EXPENSE', color: '#0ea5e9', icon: 'TrendingUp' },
  // Cartão de crédito é placeholder pra Fatia 2.
  // Quando user importa fatura de cartão na F2, classifica aqui.
  { name: 'Cartão de crédito', type: 'EXPENSE', color: '#6366f1', icon: 'CreditCard' },
  { name: 'Empréstimos', type: 'EXPENSE', color: '#dc2626', icon: 'Landmark' },
  { name: 'Outros', type: 'EXPENSE', color: '#6b7280', icon: 'MoreHorizontal' },
]

export function getDefaultCategoriesForProfile(): readonly PersonalCategoryTemplate[] {
  return PF_DEFAULT_CATEGORIES
}
