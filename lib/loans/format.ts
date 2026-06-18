// Sprint Fix-Arredondamento UI Empréstimos (17/06/2026).
//
// Helpers de formatação pra exibição. NÃO mexem no cálculo.
// O artefato de float ("0.35000000000000003") vinha de `.toString()` direto
// num número resultado de `0.0035 * 100`.

/**
 * Formata taxa mensal DECIMAL (ex: 0.0035) como "0,35% a.m." em PT-BR.
 * Default 2 casas + vírgula decimal.
 */
export function fmtRateMonthly(decimal: number, fractionDigits = 2): string {
  if (!Number.isFinite(decimal)) return '—'
  const pct = decimal * 100
  return (
    pct.toLocaleString('pt-BR', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }) + '% a.m.'
  )
}

/**
 * Formata um valor PERCENTUAL (já em %, ex: 0.35 → "0,35%"). Aceita number
 * ou string (do input do form). Quando inválido, retorna "—".
 */
export function fmtPercentValue(value: number | string, fractionDigits = 2): string {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/**
 * Arredonda número eliminando lixo de float (ex: 0.35000000000000003 → 0.35).
 * Útil pra setar valor inicial no input quando vem de cálculo.
 */
export function cleanFloat(n: number, decimals = 6): number {
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(decimals))
}
