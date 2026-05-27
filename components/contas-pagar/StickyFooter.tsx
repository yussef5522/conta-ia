// Sprint 5.0.3.0a — Footer fixo (sticky bottom) com totalizadores.
//
// 4 valores clicáveis que filtram a tabela: Vencido / A vencer 3d / Pendente / Pago.
// + Total geral à direita.
//
// Cada item tem aria-label pra screen reader + role="button" pra accessibility.

import { formatBRL } from '@/lib/format/money'

interface Totals {
  paid: number
  pending: number
  warn3d: number
  overdue: number
}

interface Props {
  totals: Totals
  onClickFilter: (kind: 'paid' | 'pending' | 'warn3d' | 'overdue') => void
}

const ITEMS = [
  { kind: 'overdue', label: 'Vencidas', tone: 'text-red-600 dark:text-red-400' },
  { kind: 'warn3d', label: 'A vencer (3d)', tone: 'text-amber-600 dark:text-amber-400' },
  { kind: 'pending', label: 'A pagar', tone: 'text-sky-600 dark:text-sky-400' },
  { kind: 'paid', label: 'Pagas', tone: 'text-emerald-600 dark:text-emerald-400' },
] as const

export function StickyFooter({ totals, onClickFilter }: Props) {
  const total = totals.paid + totals.pending + totals.warn3d + totals.overdue

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t shadow-sm"
      data-testid="sticky-footer"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 text-sm">
        {ITEMS.map((item) => {
          const value = totals[item.kind]
          return (
            <button
              key={item.kind}
              type="button"
              onClick={() => onClickFilter(item.kind)}
              className="flex items-center gap-1.5 group hover:bg-muted/40 -mx-1.5 px-1.5 py-0.5 rounded transition-colors"
              aria-label={`Filtrar por ${item.label}: ${formatBRL(value)}`}
              data-testid={`footer-${item.kind}`}
            >
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {item.label}:
              </span>
              <span className={`font-medium tabular-nums ${item.tone}`}>
                R$ {formatBRL(value)}
              </span>
              <span className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                ↑
              </span>
            </button>
          )
        })}
        <div className="flex-1" />
        <div className="text-sm font-medium tabular-nums">
          Total:{' '}
          <span className="text-foreground">R$ {formatBRL(total)}</span>
        </div>
      </div>
    </div>
  )
}
