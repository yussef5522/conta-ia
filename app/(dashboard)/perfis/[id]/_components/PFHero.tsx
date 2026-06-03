'use client'

// Sprint Dashboard PF — Zona 1: Hero gradient esmeralda.
// Saldo total grande + sparkline + 3 sub-KPIs (entradas/saídas/resultado)
// + saldo previsto 30d. Tipografia tabular. Framer Motion stagger entrance.

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Minus, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import type { SparkPoint } from '@/lib/dashboard/types'

// Sparkline carrega só no client (Recharts ResponsiveContainer)
const Sparkline = dynamic(
  () => import('@/app/(dashboard)/dashboard/_components/Sparkline').then((m) => m.Sparkline),
  { ssr: false, loading: () => <div style={{ height: 40 }} /> },
)

export interface PFHeroProps {
  profileName: string
  cpfMasked: string | null
  saldoTotal: number
  saldoSparkline: SparkPoint[]
  entradasMes: { value: number; spark: SparkPoint[]; delta: number | null }
  saidasMes: { value: number; spark: SparkPoint[]; delta: number | null }
  resultadoMes: { value: number; spark: SparkPoint[]; delta: number | null }
  saldoPrevisto30d: number
  cardsCount: number
  periodLabel: string
}

function DeltaIndicator({
  delta,
  invertSemantic = false,
}: {
  delta: number | null
  invertSemantic?: boolean
}) {
  if (delta === null) return null
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-100/70">
        <Minus className="h-3 w-3" /> estável
      </span>
    )
  }
  const isPositive = invertSemantic ? delta < 0 : delta > 0
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ${
        isPositive ? 'text-emerald-100' : 'text-rose-200'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(0)}% vs mês anterior
    </span>
  )
}

export function PFHero({
  profileName,
  cpfMasked,
  saldoTotal,
  saldoSparkline,
  entradasMes,
  saidasMes,
  resultadoMes,
  saldoPrevisto30d,
  cardsCount,
  periodLabel,
}: PFHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 p-6 text-white shadow-lg sm:p-8"
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-100/80">
            Perfil PF
          </p>
          <h1 className="text-xl font-bold sm:text-2xl">{profileName}</h1>
          {cpfMasked && (
            <p className="text-xs text-emerald-100/70">CPF {cpfMasked}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-emerald-100/80">
            Período
          </p>
          <p className="text-sm font-medium">{periodLabel}</p>
        </div>
      </div>

      {/* Saldo grande */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6"
      >
        <p className="text-xs uppercase tracking-wider text-emerald-100/80">
          Saldo total
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
          {formatBRL(saldoTotal)}
        </p>
        <p className="text-xs text-emerald-100/70">
          {cardsCount === 0 ? 'Nenhuma conta' : `${cardsCount} conta${cardsCount === 1 ? '' : 's'}`}
        </p>
        <div className="mt-2 max-w-xs">
          <Sparkline data={saldoSparkline} color="#ffffff" height={32} />
        </div>
      </motion.div>

      {/* 3 sub-KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SubKPI
          icon={<TrendingUp className="h-4 w-4" />}
          label="Entradas do mês"
          value={entradasMes.value}
          spark={entradasMes.spark}
          delta={entradasMes.delta}
          sign="+"
          delay={0.2}
        />
        <SubKPI
          icon={<TrendingDown className="h-4 w-4" />}
          label="Saídas do mês"
          value={saidasMes.value}
          spark={saidasMes.spark}
          delta={saidasMes.delta}
          sign="−"
          invertSemantic
          delay={0.25}
        />
        <SubKPI
          icon={<Wallet className="h-4 w-4" />}
          label="Resultado do mês"
          value={resultadoMes.value}
          spark={resultadoMes.spark}
          delta={resultadoMes.delta}
          sign={resultadoMes.value >= 0 ? '+' : ''}
          delay={0.3}
          highlight
        />
      </div>

      {/* Saldo previsto */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mt-6 rounded-lg bg-emerald-900/40 px-4 py-3 backdrop-blur-sm"
      >
        <p className="text-xs text-emerald-100/80">
          💡 Saldo previsto em 30 dias:{' '}
          <strong className="tabular-nums">{formatBRL(saldoPrevisto30d)}</strong>
          <span className="ml-2 text-emerald-100/60">
            (incluindo cheque especial e faturas a vencer)
          </span>
        </p>
      </motion.div>
    </motion.div>
  )
}

function SubKPI({
  icon,
  label,
  value,
  spark,
  delta,
  sign,
  invertSemantic = false,
  delay = 0,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  spark: SparkPoint[]
  delta: number | null
  sign?: string
  invertSemantic?: boolean
  delay?: number
  highlight?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`rounded-lg ${
        highlight ? 'bg-white/20 ring-1 ring-white/30' : 'bg-white/10'
      } px-4 py-3 backdrop-blur-sm`}
    >
      <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-emerald-100/80">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums sm:text-xl">
        {sign}
        {formatBRL(Math.abs(value))}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <DeltaIndicator delta={delta} invertSemantic={invertSemantic} />
        <div className="h-6 w-20 sm:w-24">
          <Sparkline data={spark} color="#ffffff" height={24} />
        </div>
      </div>
    </motion.div>
  )
}
