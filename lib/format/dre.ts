// Helpers de formatação específicos pra DRE (Sub-etapa 5.4.B).
// Reusa formatBRL/formatBRLCompact de lib/format/money.ts (fonte única).

export { formatBRL, formatBRLCompact } from './money'

// Percentual formatado em pt-BR. Aceita null/Infinity → "—".
export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !isFinite(value)) return '—'
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

// Variante com sinal explícito ("+10,0%" / "-5,0%"). Zero não recebe sinal.
export function formatPercentSigned(value: number | null, decimals = 1): string {
  if (value === null || !isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals).replace('.', ',')}%`
}

// Data BR (DD/MM/YYYY) — aceita string ISO ou Date.
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// Formato pra <input type="date"> (YYYY-MM-DD em local time).
export function formatDateInputBR(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
