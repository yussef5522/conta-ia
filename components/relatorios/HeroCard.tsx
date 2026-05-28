// Sprint 5.0.4.0b — Hero Card do /relatorios.
// Gradient escuro premium, sparkline 12m, 3 mini-stats, CTA pro DRE.

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from 'lucide-react'
import type { HeroPreview } from '@/lib/relatorios/preview-queries'
import { HeroSparklineDynamic } from './HeroSparklineWrapper'

interface Props {
  preview: HeroPreview
  empresaId: string
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

function formatBRLCompact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (abs >= 1_000) {
    return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`
  }
  return formatBRL(v)
}

export function HeroCard({ preview, empresaId }: Props) {
  const {
    monthLabel,
    prevMonthLabel,
    lucroLiquido,
    isProfit,
    receita,
    despesas,
    margemPct,
    trendPercent,
    trendDirection,
    sparkline,
  } = preview

  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-300'
      : trendDirection === 'down'
        ? 'text-red-300'
        : 'text-amber-300'

  const TrendIcon =
    trendDirection === 'up'
      ? ArrowUpRight
      : trendDirection === 'down'
        ? ArrowDownRight
        : Minus

  const trendLabel =
    trendPercent !== null
      ? `${trendPercent > 0 ? '+' : ''}${trendPercent.toFixed(0)}% vs ${prevMonthLabel}`
      : sparkline.length === 0
        ? 'Primeiro mês com dados'
        : `vs ${prevMonthLabel}`

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-8 sm:p-10 text-white shadow-xl shadow-blue-900/20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
      data-testid="relatorios-hero"
    >
      {/* Subtle decorative grain */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      <div className="relative space-y-6">
        {/* Header row: label + trend */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] font-medium text-slate-300/80">
              <TrendingUp className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              Lucro Líquido • {monthLabel}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-full bg-white/5 backdrop-blur px-3 py-1 text-xs font-medium ${trendColor} border border-white/10`}
            data-testid="hero-trend"
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trendLabel}
          </div>
        </div>

        {/* Big number */}
        <div>
          <p
            className={`text-5xl sm:text-6xl font-bold tabular-nums tracking-tight ${
              isProfit ? 'text-white' : 'text-red-300'
            }`}
            data-testid="hero-lucro-liquido"
          >
            {formatBRL(lucroLiquido)}
          </p>
          {margemPct !== null && (
            <p className="text-sm text-slate-300/80 mt-2">
              Margem líquida:{' '}
              <span className="text-slate-100 font-medium">
                {margemPct.toFixed(1)}%
              </span>
            </p>
          )}
        </div>

        {/* Sparkline (apenas se ≥3 meses de dados) */}
        {sparkline.length >= 3 && (
          <div
            className="rounded-lg border border-white/10 bg-black/15 p-3"
            data-testid="hero-sparkline-wrapper"
          >
            <HeroSparklineDynamic
              data={sparkline}
              variant={isProfit ? 'positive' : 'negative'}
            />
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
              Lucro Líquido — últimos {sparkline.length} meses
            </p>
          </div>
        )}

        {/* 3 mini-stats inline */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          <div className="rounded-lg bg-white/5 backdrop-blur border border-white/10 p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-300/70">
              Receita
            </p>
            <p className="text-lg sm:text-xl font-semibold tabular-nums mt-1">
              {formatBRLCompact(receita)}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 backdrop-blur border border-white/10 p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-300/70">
              Despesas
            </p>
            <p className="text-lg sm:text-xl font-semibold tabular-nums mt-1">
              {formatBRLCompact(despesas)}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 backdrop-blur border border-white/10 p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-300/70">
              Margem
            </p>
            <p className="text-lg sm:text-xl font-semibold tabular-nums mt-1">
              {margemPct !== null ? `${margemPct.toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div>
          <Link
            href={`/empresas/${empresaId}/relatorios/dre-gerencial`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors px-4 py-2 text-sm font-medium border border-white/20"
            data-testid="hero-cta-dre"
          >
            Ver DRE completa
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
