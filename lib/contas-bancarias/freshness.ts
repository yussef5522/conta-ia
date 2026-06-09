// Sprint Unificar-Contas (08/06/2026) — extraído de /bancos page.tsx pra
// reuso na tela unificada /empresas/[id]/contas. Calcula "Importado há X
// dias" baseado no createdAt da última tx OFX/PLUGGY da conta.
//
// Tons: green ≤7d, amber 8-30d, red >30d ou nunca.

export type FreshnessTone = 'green' | 'amber' | 'red' | 'zinc'

export interface FreshnessLabel {
  label: string
  tone: FreshnessTone
}

export function freshnessLabel(lastImport: Date | null): FreshnessLabel {
  if (!lastImport) return { label: 'Nunca importado', tone: 'red' }
  const days = Math.floor(
    (Date.now() - lastImport.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (days === 0) return { label: 'Importado hoje', tone: 'green' }
  if (days === 1) return { label: 'Importado ontem', tone: 'green' }
  if (days <= 7) return { label: `Importado há ${days} dias`, tone: 'green' }
  if (days <= 30) return { label: `Importado há ${days} dias`, tone: 'amber' }
  return { label: `Importado há ${days} dias`, tone: 'red' }
}

/** Classes Tailwind por tone — safelist explícito. */
export const FRESHNESS_TONE_CLASSES: Record<FreshnessTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800',
}
