// Sprint 5.0.3.0c (c3) — Helpers de formatação BR pro Edit Inline de valor.
//
// Aceita input "1234,56" OU "1234.56" OU "1.234,56" — normaliza pra number.
// Funções PURAS testáveis.

/** Converte string BR pra número. Retorna NaN se inválido. */
export function parseBRAmount(input: string): number {
  if (!input) return NaN
  // Remove R$, espaços; mantém dígitos, vírgula, ponto, sinal
  const cleaned = input
    .replace(/[R$\s]/gi, '')
    .replace(/[^\d,.\-]/g, '')
    .trim()
  if (!cleaned) return NaN

  // Se tem vírgula E ponto: ponto = milhar, vírgula = decimal (BR)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    return parseFloat(normalized)
  }
  // Só vírgula: assume decimal BR
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  // Só ponto OU só dígitos: parseFloat direto (pode ser US 1234.56)
  return parseFloat(cleaned)
}

/** Formata número pra string BR com 2 casas. */
export function formatBRAmount(n: number): string {
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Validação simples — true se o input parseia pra número positivo válido. */
export function isValidBRAmount(input: string): boolean {
  const n = parseBRAmount(input)
  return Number.isFinite(n) && n > 0
}
