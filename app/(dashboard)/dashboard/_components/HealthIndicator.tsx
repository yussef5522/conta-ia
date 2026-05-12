'use client'

// Mini-card de Saúde Financeira — Sprint 1 Dia 4.

import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import type { HealthIndicator as HealthIndicatorData } from '@/lib/dashboard/compute-health'

interface HealthIndicatorProps {
  indicator: HealthIndicatorData
  // delay pra stagger entrance
  delay?: number
}

const STATUS_STYLES: Record<HealthIndicatorData['status'], {
  dot: string
  label: string
  bar: string
  text: string
}> = {
  green: {
    dot: 'bg-emerald-500',
    label: 'text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  yellow: {
    dot: 'bg-amber-500',
    label: 'text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    dot: 'bg-rose-500',
    label: 'text-rose-700 dark:text-rose-400',
    bar: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  gray: {
    dot: 'bg-muted-foreground/50',
    label: 'text-muted-foreground',
    bar: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
  },
}

export function HealthIndicator({ indicator, delay = 0 }: HealthIndicatorProps) {
  const styles = STATUS_STYLES[indicator.status]
  const isVariation = indicator.id === 'variation-30d'

  // Ícone de tendência só pra variação
  const TrendIcon =
    isVariation
      ? (indicator.value ?? 0) > 0
        ? ArrowUpRight
        : (indicator.value ?? 0) < 0
          ? ArrowDownRight
          : Minus
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {indicator.label}
      </p>

      <div className="mt-2 flex items-baseline gap-2">
        {TrendIcon && (
          <TrendIcon className={`h-4 w-4 shrink-0 ${styles.text}`} />
        )}
        <p
          className={`text-2xl font-semibold tabular-nums tracking-tight ${
            indicator.status === 'gray' ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {indicator.display}
        </p>
      </div>

      {indicator.progressPercent !== null && (
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${styles.bar}`}
            style={{ width: `${indicator.progressPercent}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        <span className={`text-xs font-medium ${styles.label}`}>{indicator.statusLabel}</span>
      </div>

      {indicator.subtext && (
        <p className="mt-1 text-xs text-muted-foreground">{indicator.subtext}</p>
      )}
    </motion.div>
  )
}
