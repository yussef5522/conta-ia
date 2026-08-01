// Sprint FASE 4 (01/08/2026) — construtor PURO de sugestão por contraparte.
// SEMPRE sugestão com selo + motivo. NUNCA auto-aplica. Ordem de prioridade:
//   1) regra do usuário (contraparte → categoria) — a mais confiável
//   2) intra-grupo (outra empresa cadastrada) → sugere transferência
//   3) própria empresa (razão social) → recebimento próprio (não é cliente externo)
// Retorna null quando a tx não tem contraparte OU nada casou → fluxo atual intacto.

import { matchCounterpartyRule, type CpRule } from './rules'
import { detectCounterpartyCompany, type CompanyRef } from './detect-company'

export interface SuggestTx {
  counterpartyName: string | null
  counterpartyDocument: string | null
}

export interface SuggestContext {
  rules: CpRule[] // regras CONTRAPARTE da EMPRESA (já filtradas)
  ownCompany: CompanyRef
  otherCompanies: CompanyRef[] // outras empresas do mesmo usuário
}

export interface CounterpartySuggestion {
  kind: 'RULE' | 'INTRA_GROUP' | 'OWN'
  /** categoryId só no kind RULE (o que o usuário confirma). Outros são informativos. */
  categoryId: string | null
  /** motivo legível pro selo ("regra: RECEITA FEDERAL", "transferência ↔ PRO FIT ONE"). */
  reason: string
  /** empresa destino quando INTRA_GROUP. */
  intraGroupCompanyId?: string
  /** origem do sinal pra selo de IA. */
  source: 'RULE' | 'CADASTRO'
}

export function buildCounterpartySuggestion(
  tx: SuggestTx,
  ctx: SuggestContext,
): CounterpartySuggestion | null {
  if (!tx.counterpartyName) return null

  const rule = matchCounterpartyRule(tx.counterpartyName, ctx.rules)
  if (rule?.categoryId) {
    return { kind: 'RULE', categoryId: rule.categoryId, reason: `regra: ${tx.counterpartyName}`, source: 'RULE' }
  }

  const comp = detectCounterpartyCompany(tx.counterpartyName, tx.counterpartyDocument, ctx.ownCompany, ctx.otherCompanies)
  if (comp?.kind === 'INTRA_GROUP') {
    return { kind: 'INTRA_GROUP', categoryId: null, reason: `transferência entre empresas ↔ ${comp.company.name}`, intraGroupCompanyId: comp.company.id, source: 'CADASTRO' }
  }
  if (comp?.kind === 'OWN') {
    return { kind: 'OWN', categoryId: null, reason: 'recebimento próprio (sua empresa — maquininha/QR)', source: 'CADASTRO' }
  }
  return null
}
