// Sprint Regras-Cadastro (22/06/2026) — detecta regras com PADRÃO AMPLO
// que podem classificar transações demais (falsos positivos).
//
// Critérios (qualquer um dispara o badge):
//   - tipoMatch in (CONTAINS, NORMALIZED) com padrão de 1 palavra única
//     (sem espaço/separador), comprimento <= 12 chars
//   - padrão é uma palavra GENÉRICA do domínio bancário
//   - lista das tóxicas confirmadas no diagnóstico
//
// Função PURA — testável sem DB.

const PALAVRAS_GENERICAS = new Set<string>([
  'PAGAMENTO',
  'PAGAMENTOS',
  'TRANSFERENCIA',
  'TRANSFERENCIAS',
  'TRANSFER',
  'PIX',
  'TED',
  'DOC',
  'DEBITO',
  'CREDITO',
  'BANRI',
  'STONE',
  'CREDITO',
  'JUROS',
  'TARIFA',
  'BOLETO',
  'CARTAO',
])

export interface ToxicCheckInput {
  tipoMatch: string
  padrao: string
}

export interface ToxicCheckResult {
  isToxic: boolean
  reason?: string
}

/**
 * Avalia se uma regra tem padrão ampliado demais (badge "Regra ampla").
 */
export function detectToxicPattern(input: ToxicCheckInput): ToxicCheckResult {
  const { tipoMatch, padrao } = input
  const padraoNormalizado = padrao
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '') // strip pontuação pra normalizar

  // Só CONTAINS e NORMALIZED são candidatas (EXACT é sempre específico)
  if (tipoMatch !== 'CONTAINS' && tipoMatch !== 'NORMALIZED') {
    return { isToxic: false }
  }

  // (1) padrão é palavra do dicionário bancário genérico
  if (PALAVRAS_GENERICAS.has(padraoNormalizado)) {
    return {
      isToxic: true,
      reason: `Palavra genérica "${padraoNormalizado}" aparece em quase toda transação bancária — pode classificar transações demais.`,
    }
  }

  // (2) 1 palavra única curta (sem espaço/separador) — limite 10 chars
  // (BANRI=5, STONE=5, CRISTIAN=8, PAGAMENTO=9, MERCADOLIVRE=12 já é específico)
  const isSinglePalavraCurta =
    !/\s/.test(padraoNormalizado) &&
    padraoNormalizado.length > 0 &&
    padraoNormalizado.length <= 10
  if (isSinglePalavraCurta) {
    return {
      isToxic: true,
      reason: `Padrão de 1 palavra curta ("${padraoNormalizado}") — alto risco de falso positivo.`,
    }
  }

  return { isToxic: false }
}
