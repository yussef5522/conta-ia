const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(value: number): string {
  return BRL.format(value)
}

export function formatBRLCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}K`
  return formatBRL(value)
}

export function parseBRL(raw: string): number {
  const clean = raw.replace(/[R$\s.]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? 0 : n
}
