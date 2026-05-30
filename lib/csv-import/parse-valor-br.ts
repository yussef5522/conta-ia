// Sprint CSV Import (30/05/2026) — Parser de valor monetário formato BR.
//
// Entrada típica do CSV CACULA: "-5.312,80" (despesa), "-153,00", "-".
// Saída: number em float (sem ajuste de sinal — caller decide se aplica
// Math.abs ou não).
//
// Regras:
//  - "-"  → null
//  - ""   → null
//  - whitespace puro → null
//  - separador milhar é "." e decimal é "," (formato BR)
//  - sinal opcional (- ou +) no começo
//  - retorna null em qualquer formato inválido (não joga)

export function parseValorBR(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (s === '' || s === '-') return null

  // Aceita opcional R$ prefix (defensivo — alguns sistemas BR exportam com R$)
  let cleaned = s.replace(/^R\$\s*/i, '').trim()
  if (cleaned === '' || cleaned === '-') return null

  // Sinal explícito
  let sign = 1
  if (cleaned.startsWith('-')) {
    sign = -1
    cleaned = cleaned.slice(1).trim()
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1).trim()
  }

  // Validação formato: só dígitos, pontos (milhar) e UMA vírgula (decimal)
  // - "5.312,80"   ✓
  // - "153,00"     ✓
  // - "5312"       ✓ (sem decimal)
  // - "5,312.80"   ✗ (US format)
  // - "abc"        ✗
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(cleaned)) {
    return null
  }

  // Remove pontos milhar, troca vírgula por ponto
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  if (!Number.isFinite(n)) return null

  // Arredonda pra 2 casas pra evitar float dirt (igual ao Excel parser)
  return Math.round(sign * n * 100) / 100
}
