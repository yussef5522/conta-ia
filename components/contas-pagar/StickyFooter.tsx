// Sprint 5.0.3.0a — Footer fixo (sticky bottom) com totalizadores.
//
// Valores clicáveis que filtram a tabela: Vencidas / Vence hoje / A pagar / Pagas.
// + Total geral à direita.
//
// Cada item tem aria-label pra screen reader + role="button" pra accessibility.

import { formatBRL } from '@/lib/format/money'
import { ROTULO_PAGAS } from '@/lib/contas-pagar/rotulos'

interface Totals {
  paid: number
  pending: number
  overdue: number
  /** ⭐ 26/09 — o 4º card entrou, e o rodapé se declara FECHADO: sem ele somaria menos */
  today: number
}

interface Props {
  totals: Totals
  onClickFilter: (kind: 'paid' | 'pending' | 'overdue' | 'today') => void
}

const ITEMS = [
  { kind: 'overdue', label: 'Vencidas', tone: 'text-red-600 dark:text-red-400' },
  /**
   * ⭐⭐ 26/09 — VENCE HOJE. ⛔ E ele NÃO repete o erro do *"a vencer (3d)"* que saiu daqui
   * em 13/09: aquele era SUBCONJUNTO de "A pagar" (a mesma conta 2× no total); este é
   * PARTIÇÃO — o "A pagar" agora começa em amanhã.
   */
  { kind: 'today', label: 'Vence hoje', tone: 'text-amber-600 dark:text-amber-400' },
  // ⛔ "A vencer (3d)" saiu daqui junto com o card (13/09): era SUBCONJUNTO de "A pagar",
  // então o rodapé somava a mesma conta 2× e o total geral vinha inflado.
  { kind: 'pending', label: 'A pagar', tone: 'text-sky-600 dark:text-sky-400' },
  // ⚠️ o rótulo vem do dono único — o chip filtra a MESMA coisa que o card e o dropdown
  { kind: 'paid', label: ROTULO_PAGAS, tone: 'text-emerald-600 dark:text-emerald-400' },
] as const

export function StickyFooter({ totals, onClickFilter }: Props) {
  // ⭐ a soma FECHA: os status cobrem tudo e não se sobrepõem (guard em `escopo.test.ts`)
  const total = totals.paid + totals.pending + totals.overdue + totals.today

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
              {/* ⚠️ 24/08: era `R$ {formatBRL(value)}` e o formatBRL JÁ inclui o "R$"
                  (Intl style:'currency') — saía "R$ R$ 1.234,56". */}
              <span className={`font-medium tabular-nums ${item.tone}`}>
                {formatBRL(value)}
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
          <span className="text-foreground">{formatBRL(total)}</span>
        </div>
      </div>
    </div>
  )
}
