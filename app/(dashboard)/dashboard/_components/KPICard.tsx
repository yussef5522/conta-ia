'use client'

// Card de KPI premium — Sprint 1 Dia 1.
// Variant 'default': fundo branco/cinza, número grande, sparkline abaixo.
// Variant 'primary': gradient azul Conta IA, texto branco — usado pro Resultado.

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Minus, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'
import type { KPIValue } from '@/lib/dashboard/types'

// Sparkline carrega só no client: Recharts ResponsiveContainer não funciona em SSR
// (DOM sem dimensões → warnings de width(-1)). Dynamic import resolve.
const Sparkline = dynamic(() => import('./Sparkline').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <div style={{ height: 36 }} />,
})

interface KPICardProps {
  label: string
  kpi: KPIValue
  // 'default' = card branco; 'primary' = gradient azul Conta IA (pro Resultado)
  variant?: 'default' | 'primary'
  // Texto adicional pequeno (ex: "Margem 31%" no card de resultado)
  footnote?: string
  // Icone no canto (lucide). Quando ausente, espaço fica vazio.
  icon?: React.ReactNode
  // Override da cor do sparkline (default segue variant)
  sparkColor?: string
  // Animação de entrada com delay (stagger entre cards)
  delay?: number
  // Tooltip explicando o cálculo. Renderizado como ícone Info ao lado do label
  // com tooltip nativo do browser (atributo `title` — acessível por padrão,
  // funciona em hover e em tecnologia assistiva).
  tooltip?: string
}

export function KPICard({
  label,
  kpi,
  variant = 'default',
  footnote,
  icon,
  sparkColor,
  delay = 0,
  tooltip,
}: KPICardProps) {
  const isPrimary = variant === 'primary'

  // Cor do sparkline: default usa brand; primary usa branco sobre o gradient
  const defaultSparkColor = isPrimary ? '#FFFFFF' : '#185FA5'
  const sparkLineColor = sparkColor ?? defaultSparkColor

  // Cor do delta — semântico: up=verde, down=vermelho, flat=neutro.
  // No card primary, deltas usam branco com opacity pra contraste.
  const deltaColor = (() => {
    if (kpi.delta.direction === 'flat') {
      return isPrimary ? 'text-white/70' : 'text-muted-foreground'
    }
    if (kpi.delta.direction === 'up') {
      return isPrimary ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'
    }
    return isPrimary ? 'text-rose-200' : 'text-rose-600 dark:text-rose-400'
  })()

  const DeltaIcon =
    kpi.delta.direction === 'up'
      ? ArrowUpRight
      : kpi.delta.direction === 'down'
        ? ArrowDownRight
        : Minus

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card
        className={
          isPrimary
            ? 'relative overflow-hidden border-0 bg-gradient-to-br from-[#185FA5] to-[#0F4A8C] text-white shadow-md'
            : 'relative overflow-hidden'
        }
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className={`text-xs font-medium uppercase tracking-wide ${isPrimary ? 'text-white/80' : 'text-muted-foreground'}`}
              >
                {label}
              </p>
              {tooltip && (
                <button
                  type="button"
                  title={tooltip}
                  aria-label={`Detalhes: ${tooltip}`}
                  className={`shrink-0 inline-flex ${isPrimary ? 'text-white/60 hover:text-white/90' : 'text-muted-foreground/70 hover:text-muted-foreground'} transition-colors`}
                >
                  <Info className="h-3 w-3" />
                </button>
              )}
            </div>
            {icon && (
              <span className={isPrimary ? 'text-white/60' : 'text-muted-foreground'}>
                {icon}
              </span>
            )}
          </div>

          <p
            className={`mt-3 text-3xl font-semibold tabular-nums tracking-tight ${isPrimary ? 'text-white' : 'text-foreground'}`}
          >
            {formatBRL(kpi.value)}
          </p>

          <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${deltaColor}`}>
            <DeltaIcon className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {kpi.delta.percent !== null
                ? `${kpi.delta.percent > 0 ? '+' : ''}${kpi.delta.percent.toFixed(1)}%`
                : kpi.delta.absolute === 0
                  ? '—'
                  : formatBRL(kpi.delta.absolute)}
            </span>
            <span className={isPrimary ? 'text-white/60 font-normal' : 'text-muted-foreground font-normal'}>
              vs mês ant.
            </span>
          </div>

          {footnote && (
            <p
              className={`mt-1 text-xs ${isPrimary ? 'text-white/70' : 'text-muted-foreground'}`}
            >
              {footnote}
            </p>
          )}

          <div className="mt-3">
            <Sparkline data={kpi.spark} color={sparkLineColor} height={36} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
