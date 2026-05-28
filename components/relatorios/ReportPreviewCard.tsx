// Sprint 5.0.4.0b — Card de preview reusável (Server Component).
// Exibe ícone + título + dados reais embutidos + sparkline opcional + CTA.

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { MiniSparklineDynamic } from './MiniSparklineWrapper'
import type { SparklinePoint } from '@/lib/relatorios/preview-queries'

export interface ReportPreviewLine {
  label: string
  value: string
  /** Cor opcional pro valor (default neutral) */
  tone?: 'neutral' | 'emerald' | 'red' | 'amber' | 'purple' | 'sky'
}

interface Props {
  icon: LucideIcon
  iconColor: string
  title: string
  /** Hero text grande no topo (ex: "COMPESA R$ 18.234") */
  primaryStat?: {
    label: string
    value: string
    tone?: 'neutral' | 'emerald' | 'red' | 'amber' | 'purple' | 'sky'
  }
  /** Linhas adicionais (max 4) */
  lines?: ReportPreviewLine[]
  /** Sparkline opcional. Cor controla o tom. */
  sparkline?: {
    data: SparklinePoint[]
    color?: string
  }
  /** Mensagem mostrada quando não há dados */
  emptyMessage?: string
  hasData: boolean
  ctaHref: string
  ctaLabel: string
  /** data-testid pro componente raiz */
  testId?: string
}

const TONE_CLASS: Record<NonNullable<ReportPreviewLine['tone']>, string> = {
  neutral: 'text-foreground',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  purple: 'text-purple-600 dark:text-purple-400',
  sky: 'text-sky-600 dark:text-sky-400',
}

export function ReportPreviewCard({
  icon: Icon,
  iconColor,
  title,
  primaryStat,
  lines,
  sparkline,
  emptyMessage,
  hasData,
  ctaHref,
  ctaLabel,
  testId,
}: Props) {
  return (
    <Link
      href={ctaHref}
      className="group flex h-full flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all"
      data-testid={testId}
    >
      {/* Header — ícone + título */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: iconColor }} />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      {/* Conteúdo principal */}
      {!hasData ? (
        <p className="text-sm text-muted-foreground italic flex-1">
          {emptyMessage ?? 'Sem dados no período.'}
        </p>
      ) : (
        <div className="flex-1 space-y-3">
          {primaryStat && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {primaryStat.label}
              </p>
              <p
                className={`text-xl font-bold tabular-nums truncate mt-0.5 ${
                  TONE_CLASS[primaryStat.tone ?? 'neutral']
                }`}
              >
                {primaryStat.value}
              </p>
            </div>
          )}

          {lines && lines.length > 0 && (
            <ul className="space-y-1 text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-muted-foreground truncate">
                    {line.label}
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      TONE_CLASS[line.tone ?? 'neutral']
                    }`}
                  >
                    {line.value}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {sparkline && sparkline.data.length >= 2 && (
            <div className="pt-2">
              <MiniSparklineDynamic
                data={sparkline.data}
                color={sparkline.color}
              />
            </div>
          )}
        </div>
      )}

      {/* CTA footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-primary font-medium group-hover:underline">
          {ctaLabel}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  )
}
