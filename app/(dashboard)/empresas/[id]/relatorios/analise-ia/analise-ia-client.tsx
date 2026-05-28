'use client'

// Hotfix 5.0.4.0c1-fix — Client orquestrador da Análise IA.
// PeriodSelector + AnalysisDisplay + loading/error states.

import { useState } from 'react'
import { Loader2, AlertCircle, Bot, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  PeriodSelector,
  type AnalysisParams,
} from '@/components/relatorios/PeriodSelector'
import { AnalysisDisplay } from '@/components/relatorios/AnalysisDisplay'
import type { InsightOutput } from '@/lib/ai/insights-types'
import type { InsightMode } from '@/lib/dates/period-presets'

interface InitialAnalysis {
  insights: InsightOutput
  mode: InsightMode
  periodLabel: string
  compareLabel?: string
  generatedAt: string // ISO
  lastParams: AnalysisParams
}

interface Props {
  empresaId: string
  /** Última análise carregada do DB (se houver) — Server Component injeta */
  initialAnalysis: InitialAnalysis | null
}

export function AnaliseIAClient({ empresaId, initialAnalysis }: Props) {
  const [analysis, setAnalysis] = useState<InsightOutput | null>(
    initialAnalysis?.insights ?? null,
  )
  const [metadata, setMetadata] = useState<{
    mode: InsightMode
    periodLabel: string
    compareLabel?: string
    generatedAt: Date | null
    elapsedMs: number | null
  } | null>(
    initialAnalysis
      ? {
          mode: initialAnalysis.mode,
          periodLabel: initialAnalysis.periodLabel,
          compareLabel: initialAnalysis.compareLabel,
          generatedAt: new Date(initialAnalysis.generatedAt),
          elapsedMs: null,
        }
      : null,
  )
  const [lastParams, setLastParams] = useState<AnalysisParams | null>(
    initialAnalysis?.lastParams ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateAnalysis(params: AnalysisParams, force = false) {
    setLoading(true)
    setError(null)
    setLastParams(params)

    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ empresaId, ...params, force }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Erro ${res.status}`)
      }

      const data = (await res.json()) as {
        insights: InsightOutput
        mode: InsightMode
        period: { start: string; end: string }
        comparePeriod: { start: string; end: string } | null
        cacheHit: boolean
        cachedAt?: string
        elapsedMs?: number
      }

      setAnalysis(data.insights)
      setMetadata({
        mode: data.mode,
        periodLabel: formatPeriodLabel(data.period.start, data.period.end),
        compareLabel: data.comparePeriod
          ? formatPeriodLabel(data.comparePeriod.start, data.comparePeriod.end)
          : undefined,
        generatedAt: data.cachedAt ? new Date(data.cachedAt) : new Date(),
        elapsedMs: data.elapsedMs ?? null,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PeriodSelector onAnalyze={(p) => generateAnalysis(p, false)} loading={loading} />

      {error && (
        <Card className="border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20">
          <CardContent className="py-4 px-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Não foi possível gerar a análise
                </p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                  {error}
                </p>
                {lastParams && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateAnalysis(lastParams, true)}
                    className="mt-2"
                  >
                    Tentar novamente
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !analysis && <LoadingPlaceholder />}

      {!loading && analysis && metadata && (
        <AnalysisDisplay
          insights={analysis}
          metadata={metadata}
          onRegenerate={
            lastParams
              ? () => generateAnalysis(lastParams, true)
              : undefined
          }
          regenerating={loading}
        />
      )}

      {!loading && !analysis && !error && (
        <EmptyState />
      )}
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <Card>
      <CardContent className="py-8 px-6">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-semibold">Gerando análise…</p>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
          <li>• Coletando dados financeiros do período</li>
          <li>• Detectando variâncias e padrões</li>
          <li>• Gerando insights em português</li>
        </ul>
        <div className="space-y-2">
          <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Pronto pra gerar sua primeira análise
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
          Escolha um dos presets acima ou defina um período personalizado, e a
          IA vai analisar seus dados financeiros e te dar insights práticos.
        </p>
      </CardContent>
    </Card>
  )
}

const MES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function formatPeriodLabel(start: string, end: string): string {
  // "2026-05-01" → "1 de Maio de 2026"
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  if (sy === ey && sm === em) {
    return `${sd} a ${ed} de ${MES_FULL[sm - 1]} de ${sy}`
  }
  if (sy === ey) {
    return `${sd} de ${MES_FULL[sm - 1]} a ${ed} de ${MES_FULL[em - 1]} de ${sy}`
  }
  return `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`
}
