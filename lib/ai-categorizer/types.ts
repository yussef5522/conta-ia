// Tipos do Engine de Aprendizado — Fase 3 Etapa 1.
// Compartilhados entre normalize/learn/predict/similar/apply.

// Sprint 5.0.2.m — CONTAINS adicionado pra Vendor Memory (anchor word).
export type TipoMatch = 'EXACT' | 'NORMALIZED' | 'CONTAINS'

// Fonte do trigger da regra: como o user criou
export type RuleFonte = 'MANUAL' | 'CLAUDE'

// Snapshot leve de uma regra (campos da AiLearningRule que o engine precisa).
// PURO: testável sem Prisma.
export interface RuleSnapshot {
  id: string
  companyId: string
  tipoMatch: TipoMatch
  padrao: string // já normalizado quando tipoMatch=NORMALIZED
  categoryId: string | null
  supplierId: string | null
  confianca: number // 0.0 - 1.0
  vezesAplicada: number
  isActive: boolean
  fonte: string
}

// Snapshot leve de uma transação (campos pro predict).
export interface TxSnapshot {
  id: string
  description: string
  amount: number
  type: string
  // Sprint 4.0.1.a — nullable pra suportar PAYABLE/RECEIVABLE sem conta.
  // AI categorizer só processa EFFECTED em produção, mas o tipo precisa refletir o schema.
  bankAccountId: string | null
  status: string // PENDING | RECONCILED | IGNORED
  categoryId: string | null
}

// Predição: qual categoria sugerir + confiança + qual regra disparou.
export interface Prediction {
  ruleId: string
  categoryId: string | null
  supplierId: string | null
  // Snapshot da confiança no momento da aplicação (pode divergir da rule atual).
  confidence: number
  tipoMatch: TipoMatch
}

// Tier de tratamento na aplicação automática:
export type PredictionTier = 'AUTO' | 'SUGESTAO' | 'IGNORAR'

export function tierFor(confidence: number): PredictionTier {
  if (confidence >= 0.95) return 'AUTO'
  if (confidence >= 0.75) return 'SUGESTAO'
  return 'IGNORAR'
}

// Shape pra criar uma regra nova (input do prisma.create)
export interface NewRule {
  companyId: string
  tipoMatch: TipoMatch
  padrao: string
  categoryId: string | null
  supplierId: string | null
  confianca: number
  fonte: RuleFonte
}
