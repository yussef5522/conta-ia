// Sprint Export CSV+PDF (29/05/2026) — formatters BRL e data pro CSV.

/**
 * Formata número como valor BRL pra Excel BR.
 * "1234.56" → "1.234,56" (sem prefixo R$ — Excel formata como número).
 * Para custo zero, deixar Excel reconhecer como número (sem "R$" no campo).
 */
export function formatBRLForCsv(v: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Data ISO/Date → DD/MM/YYYY em horário São Paulo.
 * Replica o padrão das libs CSV existentes do projeto.
 */
export function formatDateForCsv(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Slug normalizado pra filename: remove acentos + lowercase + hífen.
 * "Profit São Borja" → "profit-sao-borja".
 * Útil pra montar `nomeArquivo-{slug}-{YYYY-MM-DD}.{ext}`.
 */
export function slugForFilename(s: string, maxLen = 40): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen) || 'export'
}

/**
 * Monta filename padrão: `<base>-<empresaSlug>-<YYYY-MM-DD>.<ext>`.
 * Usa UTC pra evitar TZ shift dev vs prod.
 */
export function exportFilename(
  base: string,
  empresaNome: string | null | undefined,
  ext: 'csv' | 'pdf',
  date: Date = new Date(),
): string {
  const slug = slugForFilename(empresaNome ?? '')
  const ymd = date.toISOString().slice(0, 10)
  const slugPart = slug ? `-${slug}` : ''
  return `${base}${slugPart}-${ymd}.${ext}`
}
