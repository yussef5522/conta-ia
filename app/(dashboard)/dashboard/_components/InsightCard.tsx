'use client'

// Card de Insight — Sprint 2 Dia 3.
// Client: gerencia "Dispensar" via sessionStorage + render por severity.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Lightbulb,
  Info,
  PartyPopper,
  ArrowRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Insight, InsightSeverity } from '@/lib/insights/types'

const DISMISSED_KEY = 'dismissed-insights'

const SEVERITY_STYLES: Record<
  InsightSeverity,
  { icon: typeof AlertTriangle; container: string; iconColor: string; title: string }
> = {
  alerta: {
    icon: AlertTriangle,
    container:
      'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    title: 'text-rose-900 dark:text-rose-100',
  },
  oportunidade: {
    icon: Lightbulb,
    container:
      'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-900 dark:text-emerald-100',
  },
  sugestao: {
    icon: Info,
    container: 'border-muted bg-muted/30',
    iconColor: 'text-muted-foreground',
    title: 'text-foreground',
  },
  parabens: {
    icon: PartyPopper,
    container:
      'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-900 dark:text-emerald-100',
  },
}

interface InsightCardProps {
  insight: Insight
}

export function InsightCard({ insight }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  // Lê dismissed-insights do sessionStorage no mount (client-side)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(DISMISSED_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        if (ids.includes(insight.id)) setDismissed(true)
      }
    } catch {
      // sessionStorage indisponível ou JSON corrompido — ignora silenciosamente
    }
  }, [insight.id])

  function handleDismiss() {
    setDismissed(true)
    try {
      const raw = window.sessionStorage.getItem(DISMISSED_KEY)
      const ids: string[] = raw ? JSON.parse(raw) : []
      if (!ids.includes(insight.id)) ids.push(insight.id)
      window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
    } catch {
      // ignora
    }
  }

  if (dismissed) return null

  const styles = SEVERITY_STYLES[insight.severity]
  const Icon = styles.icon

  return (
    <div
      className={`relative rounded-lg border p-4 ${styles.container}`}
      role="article"
      aria-label={insight.title}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dispensar insight"
        className="absolute top-2 right-2 rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${styles.iconColor}`} />
        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-semibold leading-tight ${styles.title}`}>
            {insight.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-line">
            {insight.description}
          </p>
          {insight.action && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={insight.action.url}>
                {insight.action.label}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
