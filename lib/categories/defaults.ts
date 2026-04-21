export interface DefaultCategory {
  name: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  color: string
  icon?: string
}

const COMUNS: DefaultCategory[] = [
  { name: 'Transferência', type: 'TRANSFER', color: '#8b5cf6', icon: 'arrow-left-right' },
  { name: 'Outros recebimentos', type: 'INCOME', color: '#10b981', icon: 'plus-circle' },
  { name: 'Outras despesas', type: 'EXPENSE', color: '#6b7280', icon: 'minus-circle' },
  { name: 'Impostos e taxas', type: 'EXPENSE', color: '#ef4444', icon: 'receipt' },
  { name: 'Tarifas bancárias', type: 'EXPENSE', color: '#f97316', icon: 'landmark' },
  { name: 'Salários e pró-labore', type: 'EXPENSE', color: '#3b82f6', icon: 'users' },
  { name: 'Aluguel', type: 'EXPENSE', color: '#a855f7', icon: 'building' },
  { name: 'Água, luz e internet', type: 'EXPENSE', color: '#06b6d4', icon: 'zap' },
]

const POR_SETOR: Record<string, DefaultCategory[]> = {
  SERVICE: [
    { name: 'Mensalidades recebidas', type: 'INCOME', color: '#10b981', icon: 'repeat' },
    { name: 'Serviços prestados', type: 'INCOME', color: '#22c55e', icon: 'briefcase' },
    { name: 'Consultas e avaliações', type: 'INCOME', color: '#84cc16', icon: 'clipboard' },
    { name: 'ISS recolhido', type: 'EXPENSE', color: '#ef4444', icon: 'receipt' },
    { name: 'Material de consumo', type: 'EXPENSE', color: '#f59e0b', icon: 'package' },
    { name: 'Equipamentos e manutenção', type: 'EXPENSE', color: '#6b7280', icon: 'tool' },
    { name: 'Marketing e publicidade', type: 'EXPENSE', color: '#ec4899', icon: 'megaphone' },
  ],
  RETAIL: [
    { name: 'Vendas à vista', type: 'INCOME', color: '#10b981', icon: 'shopping-bag' },
    { name: 'Vendas a prazo / parcelado', type: 'INCOME', color: '#22c55e', icon: 'credit-card' },
    { name: 'Devolução de vendas', type: 'EXPENSE', color: '#ef4444', icon: 'corner-down-left' },
    { name: 'Compra de mercadorias', type: 'EXPENSE', color: '#f59e0b', icon: 'shopping-cart' },
    { name: 'Frete e logística', type: 'EXPENSE', color: '#6b7280', icon: 'truck' },
    { name: 'ICMS recolhido', type: 'EXPENSE', color: '#ef4444', icon: 'receipt' },
    { name: 'Embalagens', type: 'EXPENSE', color: '#a3a3a3', icon: 'package' },
  ],
  RESTAURANT: [
    { name: 'Vendas balcão / salão', type: 'INCOME', color: '#10b981', icon: 'utensils' },
    { name: 'Delivery', type: 'INCOME', color: '#22c55e', icon: 'bike' },
    { name: 'Eventos e buffet', type: 'INCOME', color: '#84cc16', icon: 'calendar' },
    { name: 'Insumos e ingredientes', type: 'EXPENSE', color: '#f59e0b', icon: 'shopping-cart' },
    { name: 'Descartáveis e embalagens', type: 'EXPENSE', color: '#a3a3a3', icon: 'package' },
    { name: 'Gás e combustível', type: 'EXPENSE', color: '#f97316', icon: 'flame' },
    { name: 'Manutenção de equipamentos', type: 'EXPENSE', color: '#6b7280', icon: 'tool' },
  ],
  INDUSTRY: [
    { name: 'Venda de produtos', type: 'INCOME', color: '#10b981', icon: 'factory' },
    { name: 'Serviços industriais', type: 'INCOME', color: '#22c55e', icon: 'settings' },
    { name: 'Matéria-prima', type: 'EXPENSE', color: '#f59e0b', icon: 'layers' },
    { name: 'Frete e logística', type: 'EXPENSE', color: '#6b7280', icon: 'truck' },
    { name: 'IPI recolhido', type: 'EXPENSE', color: '#ef4444', icon: 'receipt' },
    { name: 'Manutenção industrial', type: 'EXPENSE', color: '#a3a3a3', icon: 'tool' },
    { name: 'Energia elétrica industrial', type: 'EXPENSE', color: '#06b6d4', icon: 'zap' },
  ],
  MIXED: [],
  OTHER: [],
}

export function getDefaultCategories(companyType: string): DefaultCategory[] {
  const especificas = POR_SETOR[companyType] ?? []
  return [...especificas, ...COMUNS]
}
