'use client'

// Card de Insight — Sprint 2 Dia 5 (polish).
//
// Mudanças vs Dia 3:
//   - Tooltip "Como detectei?" via Popover (touch-friendly)
//   - Dismiss com toast Undo 5s antes de persistir em sessionStorage
//   - Hover refinado (eleva sutil + sombra cresce)
//   - Focus visível (acessibilidade)
//   - Estado dismissed gerenciado externamente pelo InsightsClient
//     (pra AnimatePresence funcionar — não pode ser local).

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Lightbulb,
  Info,
  PartyPopper,
  ArrowRight,
  HelpCircle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'
import { getDetectorTooltip } from '@/lib/insights/tooltip-copy'
import type { Insight, InsightSeverity } from '@/lib/insights/types'

const DISMISSED_KEY = 'dismissed-insights'
const UNDO_TIMEOUT_MS = 5000

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
  onDismissed?: (id: string) => void
  onRestore?: (insight: Insight) => void
}

export function InsightCard({
  insight,
  onDismissed,
  onRestore,
}: InsightCardProps) {
  const { toast } = useToast()
  // Estado puramente local: se este insight foi dispensado em sessões ANTERIORES
  // (lê sessionStorage). Em sessões atuais, o InsightsClient remove o item da
  // lista (parent state).
  const [persistedDismissed, setPersistedDismissed] = useState(false)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lê dismissed-insights do sessionStorage no mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(DISMISSED_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        if (ids.includes(insight.id)) setPersistedDismissed(true)
      }
    } catch {
      // ignora
    }
  }, [insight.id])

  // Cleanup do timer caso o componente desmonte antes do persist
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [])

  const persistDismiss = useCallback(() => {
    try {
      const raw = window.sessionStorage.getItem(DISMISSED_KEY)
      const ids: string[] = raw ? JSON.parse(raw) : []
      if (!ids.includes(insight.id)) ids.push(insight.id)
      window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
    } catch {
      // ignora
    }
  }, [insight.id])

  function handleUndo() {
    // Cancela persist agendado e devolve o card ao state do parent
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    onRestore?.(insight)
  }

  function handleDismiss() {
    // 1. Remove imediatamente do DOM (AnimatePresence anima saída no parent)
    onDismissed?.(insight.id)
    // 2. Agenda persist após 5s — Undo cancela isso
    persistTimerRef.current = setTimeout(() => {
      persistDismiss()
      persistTimerRef.current = null
    }, UNDO_TIMEOUT_MS)
    // 3. Toast verde com Undo
    toast({
      variant: 'success',
      title: 'Insight dispensado',
      description: 'Não vai mais aparecer nesta sessão.',
      action: (
        <ToastAction altText="Desfazer dispensa do insight" onClick={handleUndo}>
          Desfazer
        </ToastAction>
      ),
      duration: UNDO_TIMEOUT_MS,
    })
  }

  if (persistedDismissed) return null

  const styles = SEVERITY_STYLES[insight.severity]
  const Icon = styles.icon
  const tooltipCopy = getDetectorTooltip(insight.id)

  return (
    <div
      className={`group relative h-full rounded-lg border p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/40 ${styles.container}`}
      role="article"
      aria-label={insight.title}
    >
      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Como detectei isso?"
              className="rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="text-xs leading-relaxed"
          >
            <p className="font-semibold mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Como detectei?
            </p>
            <p>{tooltipCopy}</p>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar insight"
          className="rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-3 pr-12">
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
