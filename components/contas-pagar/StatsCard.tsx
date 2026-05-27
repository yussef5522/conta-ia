// Sprint 5.0.3.0a — 4 stats cards padronizados pra /contas-a-pagar.
//
// Variants alinhadas com cores semânticas da spec:
//   - paid    → emerald   (PAGAS)
//   - pending → sky       (A PAGAR PENDENTE — não vencida)
//   - warn    → amber     (A VENCER em até 3 dias)
//   - overdue → red       (VENCIDAS)

import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'

export type StatsVariant = 'paid' | 'pending' | 'warn' | 'overdue'

interface Props {
  variant: StatsVariant
  label: string
  amount: number
  count: number
  icon: LucideIcon
  onClick?: () => void
}

// Mapas explícitos pra Tailwind safe-list (não interpolar classes dinamicamente).
const VALUE_COLOR: Record<StatsVariant, string> = {
  paid: 'text-emerald-600 dark:text-emerald-400',
  pending: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  overdue: 'text-red-600 dark:text-red-400',
}

const ICON_COLOR: Record<StatsVariant, string> = {
  paid: 'text-emerald-400/40',
  pending: 'text-sky-400/40',
  warn: 'text-amber-400/40',
  overdue: 'text-red-300',
}

export function StatsCard({
  variant,
  label,
  amount,
  count,
  icon: Icon,
  onClick,
}: Props) {
  const valueColor = VALUE_COLOR[variant]
  const iconColor = ICON_COLOR[variant]
  const isInteractive = !!onClick

  return (
    <Card
      className={
        isInteractive
          ? 'cursor-pointer transition-colors hover:bg-muted/30'
          : ''
      }
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      data-testid={`stats-card-${variant}`}
    >
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p
              className={`text-2xl font-semibold tabular-nums mt-1 ${valueColor}`}
            >
              {formatBRL(amount)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {count} conta{count !== 1 ? 's' : ''}
            </p>
          </div>
          <Icon className={`h-8 w-8 shrink-0 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  )
}
