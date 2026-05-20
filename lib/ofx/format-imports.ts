// Helpers PUROS de UI pro histórico de imports OFX — Sprint 2.3.

export type ImportStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERTED'

export function importStatusLabel(s: string): string {
  switch (s) {
    case 'PROCESSING': return 'Processando'
    case 'SUCCESS': return 'Concluído'
    case 'FAILED': return 'Falhou'
    case 'REVERTED': return 'Revertido'
    default: return s
  }
}

export function importStatusColor(s: string): { bg: string; text: string } {
  switch (s) {
    case 'PROCESSING':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' }
    case 'SUCCESS':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' }
    case 'FAILED':
      return { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' }
    case 'REVERTED':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' }
    default:
      return { bg: 'bg-zinc-500/10', text: 'text-zinc-500' }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatPeriod(
  start: Date | string | null,
  end: Date | string | null,
): string {
  if (!start || !end) return '—'
  const s = new Date(start).toLocaleDateString('pt-BR')
  const e = new Date(end).toLocaleDateString('pt-BR')
  if (s === e) return s
  return `${s} → ${e}`
}

// Quantos dias se passaram desde o último import bem-sucedido.
// null = nunca importou. ≥0 = N dias.
export function daysSince(date: Date | string | null): number | null {
  if (!date) return null
  const d = new Date(date).getTime()
  const now = Date.now()
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

// Tier visual pro badge "atualizado há X dias".
export type FreshnessTier = 'fresh' | 'stale' | 'old' | 'never'

export function freshnessTier(daysSinceLastImport: number | null): FreshnessTier {
  if (daysSinceLastImport === null) return 'never'
  if (daysSinceLastImport <= 7) return 'fresh'
  if (daysSinceLastImport <= 30) return 'stale'
  return 'old'
}

export function freshnessLabel(t: FreshnessTier, days: number | null): string {
  if (t === 'never') return 'Sem extratos'
  if (days === null) return '—'
  if (days === 0) return 'Atualizado hoje'
  if (days === 1) return 'Atualizado ontem'
  if (t === 'old') return `Atualize · ${days} dias`
  return `Atualizado há ${days} dias`
}

export function freshnessColor(t: FreshnessTier): { bg: string; text: string; dot: string } {
  switch (t) {
    case 'fresh':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
      }
    case 'stale':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
      }
    case 'old':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-700 dark:text-rose-400',
        dot: 'bg-rose-500',
      }
    case 'never':
      return {
        bg: 'bg-zinc-500/10',
        text: 'text-zinc-600 dark:text-zinc-400',
        dot: 'bg-zinc-400',
      }
  }
}
