'use client'

// Sprint 5.0.4.0c1 Fase 5 — Card "Gerar análise da IA" em /relatorios.
//
// 4 estados:
// - idle: convite (botão "Gerar")
// - loading: spinner + skeleton
// - success: exibe insights estruturados (resumo + destaques + recomendações)
// - error: mensagem amigável + botão retry
//
// Cache 1h é tratado server-side. Botão "Gerar novamente" força bypass (force=true).

import { useState } from 'react'
import {
  Sparkles,
  Loader2,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Bot,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type {
  InsightOutput,
  InsightDestaque,
} from '@/lib/ai/insights-types'

interface Props {
  empresaId: string
  /** YYYY-MM. Default mês atual */
  currentPeriod: string
  /** YYYY-MM. Default mês anterior */
  basePeriod: string
  /** Labels pra UI */
  currentLabel: string
  baseLabel: string
}

type State = 'idle' | 'loading' | 'success' | 'error'

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

function shortMonth(label: string): string {
  // "Maio/2026" → "Mai/26"
  const [m, y] = label.split('/')
  const idx = MES_FULL.indexOf(m)
  const short = idx >= 0 ? MES_FULL[idx].slice(0, 3) : m
  return `${short}/${String(y).slice(-2)}`
}

export function AIInsightsCard({
  empresaId,
  currentPeriod,
  basePeriod,
  currentLabel,
  baseLabel,
}: Props) {
  const [state, setState] = useState<State>('idle')
  const [insights, setInsights] = useState<InsightOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)

  async function handleGenerate(force = false) {
    setState('loading')
    setError(null)

    const startTime = Date.now()

    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ empresaId, currentPeriod, basePeriod, force }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Erro ${res.status}`)
      }

      const data = (await res.json()) as {
        insights: InsightOutput
        cacheHit?: boolean
        cachedAt?: string
        elapsedMs?: number
      }

      setInsights(data.insights)
      setCachedAt(data.cachedAt ? new Date(data.cachedAt) : null)
      setElapsedMs(data.elapsedMs ?? Date.now() - startTime)
      setState('success')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <IdleCard
        currentLabel={currentLabel}
        baseLabel={baseLabel}
        onGenerate={() => handleGenerate(false)}
      />
    )
  }

  if (state === 'loading') {
    return <LoadingCard currentLabel={currentLabel} baseLabel={baseLabel} />
  }

  if (state === 'error') {
    return (
      <ErrorCard
        message={error ?? 'Erro desconhecido'}
        onRetry={() => handleGenerate(true)}
      />
    )
  }

  return (
    <SuccessCard
      insights={insights!}
      cachedAt={cachedAt}
      elapsedMs={elapsedMs}
      currentLabel={currentLabel}
      baseLabel={baseLabel}
      onRegenerate={() => handleGenerate(true)}
    />
  )
}

// ============================================================
// Estados
// ============================================================

function IdleCard({
  currentLabel,
  baseLabel,
  onGenerate,
}: {
  currentLabel: string
  baseLabel: string
  onGenerate: () => void
}) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-purple-500/5">
      <CardContent className="py-6 px-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold flex items-center gap-2">
              Análise da IA
              <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-purple-700 dark:text-purple-300">
                <Sparkles className="h-3 w-3" />
                Novo
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              A IA compara <strong>{shortMonth(currentLabel)}</strong> com{' '}
              <strong>{shortMonth(baseLabel)}</strong> e te diz o que mudou, o
              que merece atenção e o que pode ajustar.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={onGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Gerar análise da IA
              </Button>
              <span className="text-xs text-muted-foreground">
                ~ 30 segundos
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingCard({
  currentLabel,
  baseLabel,
}: {
  currentLabel: string
  baseLabel: string
}) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-purple-500/5">
      <CardContent className="py-6 px-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold">Gerando análise…</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <LoadingStep label={`Analisando ${shortMonth(currentLabel)}`} />
              <LoadingStep label={`Comparando com ${shortMonth(baseLabel)}`} />
              <LoadingStep label="Identificando padrões" />
            </ul>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingStep({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
      {label}
    </li>
  )
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20">
      <CardContent className="py-5 px-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
              Não foi possível gerar a análise
            </h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
              {message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3 gap-1.5"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SuccessCard({
  insights,
  cachedAt,
  elapsedMs,
  currentLabel,
  baseLabel,
  onRegenerate,
}: {
  insights: InsightOutput
  cachedAt: Date | null
  elapsedMs: number | null
  currentLabel: string
  baseLabel: string
  onRegenerate: () => void
}) {
  const sinceText = cachedAt
    ? `Gerada ${formatRelative(cachedAt)}`
    : elapsedMs != null
      ? `Gerada agora (${(elapsedMs / 1000).toFixed(1)}s)`
      : 'Gerada agora'

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-purple-500/5">
        <CardContent className="py-4 px-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Análise da IA — {shortMonth(currentLabel)} vs{' '}
                  {shortMonth(baseLabel)}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sinceText}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              className="gap-1.5"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Gerar novamente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardContent className="py-4 px-6">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Resumo executivo
          </p>
          <p className="text-base text-foreground leading-relaxed">
            {insights.resumoExecutivo}
          </p>
        </CardContent>
      </Card>

      {/* Destaques agrupados por tipo */}
      <DestaquesSections destaques={insights.destaques} />

      {/* Recomendações */}
      {insights.recomendacoes.length > 0 && (
        <Card>
          <CardContent className="py-4 px-6">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              💡 Recomendações
            </p>
            <ul className="space-y-2">
              {insights.recomendacoes.map((r, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center italic">
        ⚠️ Análise gerada por IA. Sempre verifique os dados originais antes de
        tomar decisões.
      </p>
    </div>
  )
}

function DestaquesSections({ destaques }: { destaques: InsightDestaque[] }) {
  const alertas = destaques.filter((d) => d.tipo === 'alerta')
  const atencoes = destaques.filter((d) => d.tipo === 'atencao')
  const positivos = destaques.filter((d) => d.tipo === 'positivo')

  return (
    <div className="space-y-4">
      {alertas.length > 0 && (
        <DestaqueSection
          title="🚨 Alertas"
          destaques={alertas}
          tone="red"
        />
      )}
      {atencoes.length > 0 && (
        <DestaqueSection
          title="⚠️ Atenção"
          destaques={atencoes}
          tone="amber"
        />
      )}
      {positivos.length > 0 && (
        <DestaqueSection
          title="✅ Pontos positivos"
          destaques={positivos}
          tone="emerald"
        />
      )}
    </div>
  )
}

function DestaqueSection({
  title,
  destaques,
  tone,
}: {
  title: string
  destaques: InsightDestaque[]
  tone: 'red' | 'amber' | 'emerald'
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {destaques.map((d, i) => (
          <DestaqueCard key={`${d.tipo}-${i}`} destaque={d} tone={tone} />
        ))}
      </div>
    </div>
  )
}

function DestaqueCard({
  destaque,
  tone,
}: {
  destaque: InsightDestaque
  tone: 'red' | 'amber' | 'emerald'
}) {
  const toneClasses = {
    red: 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20',
    amber:
      'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20',
    emerald:
      'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20',
  }
  const Icon =
    tone === 'red' ? AlertCircle : tone === 'amber' ? AlertTriangle : CheckCircle2

  const iconColor = {
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div
      className={`rounded-xl border p-4 ${toneClasses[tone]}`}
      data-testid={`destaque-${destaque.tipo}-${destaque.categoria ?? 'sem-cat'}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor[tone]}`} />
        <h5 className="text-sm font-semibold text-foreground flex-1">
          {destaque.titulo}
        </h5>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {destaque.descricao}
      </p>
      {(destaque.categoria || destaque.valor) && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          {destaque.categoria && (
            <span className="rounded-full bg-background border px-2 py-0.5">
              {destaque.categoria}
            </span>
          )}
          {destaque.valor && (
            <span className="tabular-nums font-medium">{destaque.valor}</span>
          )}
        </div>
      )}
      {destaque.perguntaSugerida && (
        <p className="mt-3 pt-3 border-t border-current/10 text-xs italic text-muted-foreground">
          💭 {destaque.perguntaSugerida}
        </p>
      )}
    </div>
  )
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH} ${diffH === 1 ? 'hora' : 'horas'}`
  return date.toLocaleDateString('pt-BR')
}
