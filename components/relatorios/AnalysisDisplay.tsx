// Hotfix 5.0.4.0c1-fix — Display reusável do resultado da Análise IA.
//
// Usado em /relatorios/analise-ia (página dedicada, depois de Gerar).
//
// Renderiza: header com periodLabel + modo · Resumo · Destaques agrupados ·
// Recomendações · disclaimer "IA pode errar".

import {
  Sparkles,
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
import type { InsightMode } from '@/lib/dates/period-presets'

interface AnalysisMetadata {
  mode: InsightMode
  /** "1 a 31 de Maio de 2026" ou similar */
  periodLabel: string
  /** Só em comparative */
  compareLabel?: string
  /** Quando foi gerada (ou cached) */
  generatedAt: Date | null
  elapsedMs: number | null
}

interface Props {
  insights: InsightOutput
  metadata: AnalysisMetadata
  onRegenerate?: () => void
  regenerating?: boolean
}

const MODE_LABELS: Record<InsightMode, string> = {
  comparative: 'Comparativo',
  evolution: 'Evolução',
  single: 'Análise',
}

export function AnalysisDisplay({
  insights,
  metadata,
  onRegenerate,
  regenerating,
}: Props) {
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
                  Análise da IA
                  <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    {MODE_LABELS[metadata.mode]}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metadata.compareLabel
                    ? `${metadata.periodLabel} vs ${metadata.compareLabel}`
                    : metadata.periodLabel}
                </p>
                {metadata.generatedAt && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatRelative(metadata.generatedAt)}
                  </p>
                )}
              </div>
            </div>
            {onRegenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                disabled={regenerating}
                className="gap-1.5"
              >
                <RefreshCcw
                  className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`}
                />
                Gerar novamente
              </Button>
            )}
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

      {/* Destaques */}
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
        <DestaqueSection title="🚨 Alertas" destaques={alertas} tone="red" />
      )}
      {atencoes.length > 0 && (
        <DestaqueSection title="⚠️ Atenção" destaques={atencoes} tone="amber" />
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
    tone === 'red'
      ? AlertCircle
      : tone === 'amber'
        ? AlertTriangle
        : CheckCircle2
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
