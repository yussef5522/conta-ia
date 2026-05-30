// Sprint CSV Import (30/05/2026) — Parser de data formato BR (DD/MM/YYYY).
//
// Entrada típica: "30/05/2026", "-", "" (vazio).
// Saída: Date em UTC midnight (consistente com convenção do projeto)
// ou null.
//
// Regras:
//  - "-" → null (CACULA usa "-" pra paymentDate quando não pago)
//  - "" → null
//  - whitespace puro → null
//  - DD/MM/YYYY → Date UTC midnight
//  - DD/MM/YY → null (ambíguo, recusamos)
//  - dia inválido (32, 0), mês inválido (13, 0) → null
//  - validação rigorosa: 31/02 → null (Feb não tem 31)

export function parseDataBR(raw: string | null | undefined): Date | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (s === '' || s === '-') return null

  // Regex estrita: DD/MM/YYYY com 4 dígitos no ano
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  // Bounds básicos
  if (day < 1 || day > 31) return null
  if (month < 1 || month > 12) return null
  if (year < 1900 || year > 2999) return null

  // Constrói UTC midnight
  const d = new Date(Date.UTC(year, month - 1, day))

  // Validação rigorosa: round-trip pra detectar overflow (31/02 → 03/03)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null
  }

  return d
}
