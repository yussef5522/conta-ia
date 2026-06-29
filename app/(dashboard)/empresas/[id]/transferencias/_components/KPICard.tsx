// Sprint Transferências Redesign (28/06/2026) — KPI card clicável.
// Cada card vira link pra subtela do detalhe. Design Mercury/Ramp: card
// branco, radius-lg, borda 0.5px, sentence case, tipografia 2 pesos.

'use client'

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'

interface Props {
  href: string
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone: 'emerald' | 'blue' | 'amber' | 'slate'
}

const TONE_CLASSES: Record<Props['tone'], { icon: string; valueText: string; ring: string }> = {
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
    valueText: 'text-slate-900 dark:text-slate-100',
    ring: 'hover:ring-emerald-300/60',
  },
  blue: {
    icon: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
    valueText: 'text-slate-900 dark:text-slate-100',
    ring: 'hover:ring-blue-300/60',
  },
  amber: {
    icon: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    valueText: 'text-slate-900 dark:text-slate-100',
    ring: 'hover:ring-amber-300/60',
  },
  slate: {
    icon: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40',
    valueText: 'text-slate-900 dark:text-slate-100',
    ring: 'hover:ring-slate-300/60',
  },
}

export function KPICard({ href, label, value, hint, icon: Icon, tone }: Props) {
  const cls = TONE_CLASSES[tone]
  return (
    <Link
      href={href}
      className={`group block rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-card p-4 transition-all hover:ring-2 ${cls.ring} hover:border-transparent`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${cls.icon}`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          abrir →
        </span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-[22px] font-medium tabular-nums ${cls.valueText}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
    </Link>
  )
}
