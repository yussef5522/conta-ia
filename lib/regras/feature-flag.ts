// Sprint Regras-Cadastro (22/06/2026) — feature flag pra ligar/desligar
// geração automática de AiLearningRule a partir de classificações manuais.
//
// Decisão Yussef: DESLIGADO por default em prod, depois que o gerador
// criou regras com padrões muito genéricos ("PAGAMENTO" -> Contabilidade,
// "pagamento" -> Aluguel 45 hits) classificando errado.
//
// IMPORTANTE: esta flag afeta SÓ a CRIAÇÃO automática de regras.
// A APLICAÇÃO das regras existentes continua normal (autoClassifyTransactions
// no import, predictCategory, etc).
//
// Pra religar (futuro): AUTO_RULE_GENERATION=true no .env

/**
 * Retorna true se geração automática de regras está LIGADA.
 * Default: false (desligado).
 *
 * Habilitada APENAS quando AUTO_RULE_GENERATION=true explícito.
 */
export function isAutoRuleGenerationEnabled(): boolean {
  return process.env.AUTO_RULE_GENERATION === 'true'
}
