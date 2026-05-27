// Sprint 5.0.2.q — Indicador visual de confiança (QuickBooks 2026 Review Signals).
//
// 🟢 ≥85% — alta confiança
// 🟡 70-84% — revisar
// 🔴 <70% — atenção
//
// PURO/visual — sem effects, sem state. Testável trivialmente.

export type ConfidenceTier = 'high' | 'mid' | 'low'

export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.85) return 'high'
  if (confidence >= 0.7) return 'mid'
  return 'low'
}

interface Props {
  confidence: number
  /** Quando true, omite o % numérico (só mostra dot). */
  compact?: boolean
}

const TIER_CONFIG: Record<
  ConfidenceTier,
  { dotClass: string; textClass: string; label: string }
> = {
  high: {
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    label: 'Alta confiança',
  },
  mid: {
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    label: 'Revisar',
  },
  low: {
    dotClass: 'bg-red-500',
    textClass: 'text-red-700 dark:text-red-400',
    label: 'Baixa',
  },
}

export function ConfidenceSignal({ confidence, compact = false }: Props) {
  const tier = confidenceTier(confidence)
  const cfg = TIER_CONFIG[tier]

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${cfg.label} · ${Math.round(confidence * 100)}%`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`}
      />
      {!compact && (
        <span className={`text-xs font-medium tabular-nums ${cfg.textClass}`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  )
}
