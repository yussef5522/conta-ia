// Hotfix 5.0.4.0c1-fix — Card de preview "Análise da IA" no grid /relatorios.
// Substitui o render inline antigo. Mostra última análise (se houver) ou estado vazio.

import Link from 'next/link'
import { Sparkles, ChevronRight, Bot } from 'lucide-react'
import type { InsightMode } from '@/lib/dates/period-presets'

interface UltimaAnalise {
  mode: InsightMode | null
  periodLabel: string
  compareLabel?: string | null
  generatedAt: Date
  destaquesCount: number
}

interface Props {
  empresaId: string
  ultima: UltimaAnalise | null
}

const MODE_LABELS: Record<InsightMode, string> = {
  comparative: 'Comparativo',
  evolution: 'Evolução',
  single: 'Análise',
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? 'min' : 'min'}`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `há ${diffD} ${diffD === 1 ? 'dia' : 'dias'}`
  return date.toLocaleDateString('pt-BR')
}

export function AIInsightsPreviewCard({ empresaId, ultima }: Props) {
  return (
    <Link
      href={`/empresas/${empresaId}/relatorios/analise-ia`}
      className="group flex h-full flex-col rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-purple-500/5 p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
      data-testid="preview-card-analise-ia"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            Análise da IA
            <Sparkles className="h-3 w-3 text-primary" />
          </h3>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 space-y-3">
        {ultima ? (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Última análise
              </p>
              <p className="text-sm font-semibold mt-0.5">
                {ultima.compareLabel
                  ? `${ultima.periodLabel} vs ${ultima.compareLabel}`
                  : ultima.periodLabel}
              </p>
            </div>
            <ul className="space-y-1 text-sm border-t border-primary/10 pt-3">
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Modo</span>
                <span className="font-medium">
                  {ultima.mode ? MODE_LABELS[ultima.mode] : '—'}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Destaques</span>
                <span className="tabular-nums font-medium">
                  {ultima.destaquesCount}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Gerada</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(ultima.generatedAt)}
                </span>
              </li>
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground leading-relaxed">
              Compare períodos, identifique tendências e descubra o que mudou —
              tudo em português natural.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Nenhuma análise gerada ainda.
            </p>
          </>
        )}
      </div>

      {/* CTA footer */}
      <div className="mt-4 pt-3 border-t border-primary/10 flex items-center justify-between text-xs">
        <span className="text-primary font-medium group-hover:underline">
          {ultima ? 'Abrir análise' : 'Gerar análise'}
        </span>
        <ChevronRight className="h-4 w-4 text-primary/60 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  )
}
