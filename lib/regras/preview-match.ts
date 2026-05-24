// Sprint 3.0.4 C3 — preview do que uma regra MATCH-aria.
//
// Função pura aplica o tipoMatch da regra em descrições de transações
// e retorna as que bateriam. Usada pelo endpoint POST /api/empresas/[id]/regras/preview
// pra mostrar ao user, ao vivo, quantas pendentes a regra pegaria.
//
// Estratégia espelha lib/ai-categorizer/predict.ts:
//   - EXACT: descrição normalizada (lower/sem acento) EXATAMENTE igual ao padrão
//   - NORMALIZED: descrição com strip de prefixo nome + data, igual ao padrão
//   - CONTAINS: descrição contém o padrão (case-insensitive)
//   - CNPJ: descrição contém o CNPJ (qualquer formatação)

import { normalizeDescription, normalizeExact } from '@/lib/ai-categorizer/normalize'

export interface PreviewMatchTx {
  id: string
  description: string
}

export interface PreviewMatchInput {
  padrao: string
  tipoMatch: 'EXACT' | 'CONTAINS' | 'CNPJ' | 'NORMALIZED'
}

export function txMatchesRegra(
  tx: { description: string },
  input: PreviewMatchInput,
): boolean {
  if (!input.padrao || !input.padrao.trim()) return false
  const padrao = input.padrao.trim()

  switch (input.tipoMatch) {
    case 'EXACT':
      return normalizeExact(tx.description) === normalizeExact(padrao)
    case 'NORMALIZED':
      return normalizeDescription(tx.description) === normalizeDescription(padrao)
    case 'CONTAINS':
      return normalizeExact(tx.description).includes(normalizeExact(padrao))
    case 'CNPJ': {
      // Compara só dígitos do CNPJ — ignora pontos, barras, traços
      const cnpjDigits = padrao.replace(/\D/g, '')
      if (cnpjDigits.length < 11) return false // mín 11 (CPF) ou 14 (CNPJ)
      const txDigits = tx.description.replace(/\D/g, '')
      return txDigits.includes(cnpjDigits)
    }
    default:
      return false
  }
}

export function filterTransacoesByRegra<T extends { description: string }>(
  transacoes: T[],
  input: PreviewMatchInput,
): T[] {
  return transacoes.filter((t) => txMatchesRegra(t, input))
}
