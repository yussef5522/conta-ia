// Engine de aprendizado: cria/atualiza regras a partir de confirmações do user.
// Fase 3 Etapa 1. Função PURA — sem Prisma.

import { normalizeDescription, normalizeExact } from './normalize'
import type { NewRule, RuleSnapshot, TipoMatch } from './types'

// Confiança inicial de uma regra criada pelo user via MANUAL_CONFIRMATION.
// Usamos 1.0 (alta) porque o user CONFIRMOU explicitamente.
// Auto-aplicação no import requer ≥0.95, então 1.0 garante que a próxima
// transação com mesma descrição vai entrar RECONCILED automático.
export const INITIAL_CONFIDENCE_MANUAL = 1.0

// Ajustes incrementais de aprendizado contínuo (Etapa 1 simples):
//   - User CONFIRMA classificação aplicada por regra → confiança sobe
//   - User MUDA classificação aplicada por regra (override) → confiança cai
//   - Quando cai abaixo desse threshold → regra é desativada automaticamente
export const CONFIDENCE_BUMP_ON_CONFIRM = 0.02
export const CONFIDENCE_DROP_ON_OVERRIDE = 0.1
export const AUTO_DEACTIVATE_BELOW = 0.5

// Constrói uma regra nova a partir de uma confirmação manual.
//
// tipoMatch:
//   - EXACT: pattern = descrição literal normalizada (lower+acentos+trim)
//     Casa só com descrições idênticas. Útil quando padrão NÃO tem nome
//     próprio variável (ex: "PAGAMENTO TITULO" sempre igual).
//   - NORMALIZED: pattern = descrição APÓS strip de prefixo nome próprio
//     + sufixos de data. Casa diferentes descrições com mesma "raiz".
//     Útil pro caso "FABIO UECKER - Pix | Maquininha" → padrão "pix | maquininha".
//
// Lógica:
//   - Se a descrição original NÃO tem " - " (sem prefixo de nome) E é igual
//     à normalizada → cria EXACT (menos ambíguo)
//   - Se a descrição TEM " - " (com prefixo nome próprio) → cria NORMALIZED
//     (queremos capturar TODAS as pessoas)
export function buildNewRule(
  companyId: string,
  rawDescription: string,
  categoryId: string | null,
  supplierId: string | null = null,
): NewRule {
  const hasPrefix = / - /.test(rawDescription)
  const tipoMatch: TipoMatch = hasPrefix ? 'NORMALIZED' : 'EXACT'
  const padrao =
    tipoMatch === 'NORMALIZED'
      ? normalizeDescription(rawDescription)
      : normalizeExact(rawDescription)

  return {
    companyId,
    tipoMatch,
    padrao,
    categoryId,
    supplierId,
    confianca: INITIAL_CONFIDENCE_MANUAL,
    fonte: 'MANUAL',
  }
}

// Resultado de updateRuleOnConfirm: novos valores pra persistir.
export interface RuleUpdate {
  confianca: number
  isActive: boolean
  vezesAplicada?: number
}

// User CONFIRMOU classificação RULE (ex: clicou ✓ numa sugestão sem mudar
// a categoria) → confidence sobe ligeiramente, conta como aplicação correta.
export function updateRuleOnConfirm(rule: RuleSnapshot): RuleUpdate {
  const novaConf = Math.min(rule.confianca + CONFIDENCE_BUMP_ON_CONFIRM, 1.0)
  return {
    confianca: novaConf,
    isActive: rule.isActive, // confirm nunca desativa
    vezesAplicada: rule.vezesAplicada + 1,
  }
}

// User MUDOU classificação aplicada por regra (override) → confidence cai.
// Se ficar < AUTO_DEACTIVATE_BELOW, regra é desativada automaticamente.
export function updateRuleOnOverride(rule: RuleSnapshot): RuleUpdate {
  const novaConf = Math.max(rule.confianca - CONFIDENCE_DROP_ON_OVERRIDE, 0)
  return {
    confianca: novaConf,
    isActive: rule.isActive && novaConf >= AUTO_DEACTIVATE_BELOW,
  }
}

// Quando aplicamos uma regra (no import OFX OU no bulk apply manual),
// só incrementamos vezesAplicada. Sem mexer em confianca (mexe só em
// CONFIRM/OVERRIDE explícito do user).
export function incrementApplied(rule: RuleSnapshot, by = 1): RuleUpdate {
  return {
    confianca: rule.confianca,
    isActive: rule.isActive,
    vezesAplicada: rule.vezesAplicada + by,
  }
}
