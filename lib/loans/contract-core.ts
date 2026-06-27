// Sprint Contract Suffix Fix (27/06/2026) — helper PURO pra matchear
// número de contrato bancário ignorando o sufixo dígito-verificador.
//
// PROBLEMA REAL CACULA:
// Os 4 contratos Sicredi têm sufixo "-N" (ex: C41033828-8). A descrição
// OFX vem SEM o sufixo: "LIQUIDACAO DE PARCELA-C41033828". Normalizando
// ambos (lowercase + remove non-alphanum):
//   contractKey  = "c410338288"  (9 chars — C + 8 dígitos do número + 1 do sufixo)
//   descricaoNorm = "...c41033828" (sem o 9º "8" extra)
//   includes() → FALSE
// Mesma falha afeta C41022227-1, C41022570-0, C41033828-8, C61021346-2.
//
// SOLUÇÃO:
// Extrair o "core" do contrato (parte ANTES do último hífen+sufixo) e usar
// ESSE core na comparação. Banrisul BNDES (002100057538834, sem sufixo)
// continua funcionando — não tem hífen.
//
// Tamanho mínimo do core: 7 chars (após o C ou prefix) pra evitar match
// frouxo tipo "C123" casar com tudo.
//
// Esta lib é a ÚNICA fonte de verdade para essa lógica. Reusada por:
//   - lib/loans/match-contract-in-description.ts (preview V3)
//   - lib/loans/auto-conciliacao.ts (pós-import)

/**
 * Normaliza string pra comparação substring de contrato:
 * lowercase + remove tudo que não é alfanumérico.
 * "LIQUIDACAO DE PARCELA-C41033828" → "liquidacaodeparcelac41033828"
 * "C41033828-8" → "c410338288"
 * "002100057538834" → "002100057538834"
 */
export function normalizeForContractMatch(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Extrai o "core" do contrato — parte ANTES do último hífen+sufixo.
 *
 * Regra: se o contrato tem o padrão `<base>-<N>` onde N é dígito único OU
 * dígito+letra curta (1-2 chars), retorna apenas `<base>`. Caso contrário,
 * retorna o contrato inteiro.
 *
 * Exemplos:
 *   "C41033828-8"        → "C41033828"
 *   "C41022227-1"        → "C41022227"
 *   "C61021346-2"        → "C61021346"
 *   "C41033828"          → "C41033828"     (sem sufixo, devolve igual)
 *   "002100057538834"    → "002100057538834" (BNDES sem hífen — inalterado)
 *   "12345"              → "12345"         (curto demais pra ter sufixo)
 *   ""                   → ""
 *
 * IMPORTANTE: o "core" é retornado em CASE ORIGINAL (sem normalizar).
 * Caller deve normalizar via `normalizeForContractMatch` se precisar.
 */
export function extractContractCore(contractNumber: string | null): string {
  if (!contractNumber) return ''
  // Procura último hífen seguido de 1-2 chars alfanuméricos no final
  // (sufixo dígito-verificador típico de Sicredi/Bradesco/Itaú).
  const m = contractNumber.match(/^(.+?)-([0-9A-Za-z]{1,2})$/)
  if (m && m[1].length >= 5) {
    // Base tem que ter pelo menos 5 chars pra ser plausível como contrato real.
    return m[1]
  }
  return contractNumber
}

/**
 * Verifica se a descrição (já normalizada via `normalizeForContractMatch`)
 * "contém" o contrato — usando o CORE (sem sufixo).
 *
 * Tamanho mínimo do core para evitar falso-positivo: 7 chars.
 * (Ex: "C12345" tem 6 chars normalizado — não tenta match.)
 *
 * Retorna true se descrição normalizada contém o core normalizado e o
 * core tem ≥ minCoreLength chars (default 7).
 */
export function descriptionMatchesContract(
  descriptionRaw: string,
  contractNumberRaw: string | null,
  options: { minCoreLength?: number } = {},
): boolean {
  const { minCoreLength = 7 } = options
  if (!contractNumberRaw) return false

  const core = extractContractCore(contractNumberRaw)
  const coreKey = normalizeForContractMatch(core)
  if (coreKey.length < minCoreLength) return false

  const descKey = normalizeForContractMatch(descriptionRaw)
  if (!descKey) return false

  return descKey.includes(coreKey)
}
