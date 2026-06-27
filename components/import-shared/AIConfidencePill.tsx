// Sprint OFX V3 — selo de confianca da IA (reusavel cartao+OFX+futuros).

'use client'

import type { AiSuggestionConfidence } from '@/lib/ofx-v3/types'
import { confidencePillVisual } from '@/lib/ofx-v3/suggest-line-kind'
import { CheckCircle2, AlertCircle, Link2, HelpCircle } from 'lucide-react'

export function AIConfidencePill({
  confidence,
  size = 'sm',
}: {
  confidence: AiSuggestionConfidence
  size?: 'xs' | 'sm'
}) {
  const { label, tone } = confidencePillVisual(confidence)
  const Icon =
    tone === 'emerald' ? CheckCircle2
    : tone === 'amber' ? AlertCircle
    : tone === 'blue' ? Link2
    : HelpCircle
  const toneClass = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300',
    amber:   'bg-amber-50 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900/60 text-amber-700 dark:text-amber-300',
    blue:    'bg-blue-50 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-900/60 text-blue-700 dark:text-blue-300',
    slate:   'bg-slate-50 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800/60 text-slate-600 dark:text-slate-300',
  }[tone]
  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0' : 'text-[10px] px-2 py-0.5'
  const iconSize = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium flex-shrink-0 ${toneClass} ${sizeClass}`}
    >
      <Icon className={iconSize} />
      {label}
    </span>
  )
}
