// Formatadores de audit log pra UI e CSV (Sub-sub-etapa 5.3.C1).
// Mapas de tradução PT-BR + ícones + cores.

export interface ActionLabel {
  verb: string
  icon: string
  color: 'green' | 'blue' | 'red' | 'orange' | 'purple' | 'gray'
}

export const ACTION_LABELS: Record<string, ActionLabel> = {
  CREATE: { verb: 'Criou', icon: '➕', color: 'green' },
  UPDATE: { verb: 'Atualizou', icon: '✏️', color: 'blue' },
  DELETE: { verb: 'Excluiu', icon: '🗑️', color: 'red' },
  ACTIVATE: { verb: 'Ativou', icon: '✅', color: 'green' },
  DEACTIVATE: { verb: 'Desativou', icon: '🔇', color: 'orange' },
  RESTORE_TEMPLATE: { verb: 'Restaurou template', icon: '🔄', color: 'purple' },
  REORDER: { verb: 'Reordenou', icon: '↕️', color: 'gray' },
  IMPORT: { verb: 'Importou', icon: '📥', color: 'blue' },
  EXPORT: { verb: 'Exportou', icon: '📤', color: 'gray' },
}

export const ENTITY_LABELS: Record<string, string> = {
  Category: 'Categoria',
  Transaction: 'Transação',
  Company: 'Empresa',
  BankAccount: 'Conta Bancária',
  Role: 'Role',
  UserCompanyRole: 'Permissão de Usuário',
  User: 'Usuário',
}

export const FIELD_LABELS: Record<string, string> = {
  // Category
  name: 'Nome',
  dreGroup: 'Grupo DRE',
  parentId: 'Categoria pai',
  icon: 'Ícone',
  color: 'Cor',
  isActive: 'Ativo',
  visibleInRegimes: 'Regimes visíveis',
  description: 'Descrição',
  code: 'Código',
  type: 'Tipo',
  order: 'Ordem',

  // Transaction
  amount: 'Valor',
  date: 'Data',
  competenceDate: 'Data competência',
  paymentDate: 'Data pagamento',
  categoryId: 'Categoria',
  bankAccountId: 'Conta bancária',
  status: 'Status',
  notes: 'Notas',

  // Company
  tradeName: 'Nome fantasia',
  taxRegime: 'Regime tributário',
  email: 'E-mail',
  phone: 'Telefone',
  address: 'Endereço',
  city: 'Cidade',
  state: 'UF',
  zipCode: 'CEP',
  cnpj: 'CNPJ',

  // BankAccount
  bankName: 'Banco',
  bankCode: 'Código do banco',
  agency: 'Agência',
  accountNumber: 'Conta',
  accountType: 'Tipo de conta',
}

export function formatActionLabel(action: string): ActionLabel {
  return ACTION_LABELS[action] ?? { verb: action, icon: '📝', color: 'gray' }
}

export function formatEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType
}

export function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(vazio)'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
