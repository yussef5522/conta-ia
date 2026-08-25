'use client'

// MOLDE OFICIAL (24/08) — a RÉGUA de totais no rodapé: soma por estado + total geral.
// Generalização do StickyFooter da /contas-a-pagar (que era fixo nos 4 estados de conta a
// pagar). Implementação ÚNICA — REGRA 4.
//
// ⚠️ Bug corrigido na travessia: o original escrevia `R$ {formatBRL(v)}` e o `formatBRL`
// JÁ inclui o "R$" (Intl style:'currency') — saía "R$ R$ 1.234,56" em 5 lugares. Aqui o
// valor entra pronto e a régua não prefixa nada.

import { formatBRL } from '@/lib/format/money'

export type TotalTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'violet'

const TONE: Record<TotalTone, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  slate: 'text-slate-700 dark:text-slate-300',
  violet: 'text-violet-600 dark:text-violet-400',
}

export interface TotalItem {
  chave: string
  label: string
  tone: TotalTone
  valor: number
  /** contagem opcional ao lado ("3 notas") */
  n?: number
  /** quando informado, o item vira botão de filtro */
  onClick?: () => void
}

export function TotalsBar({ itens, total, totalLabel = 'Total', formatar = formatBRL }: {
  itens: TotalItem[]
  /** total geral; se omitido, soma os itens */
  total?: number
  totalLabel?: string
  /** pra réguas que somam quantidade em vez de dinheiro */
  formatar?: (n: number) => string
}) {
  const geral = total ?? itens.reduce((s, i) => s + i.valor, 0)
  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 border-t bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80" data-testid="totals-bar">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 text-sm">
        {itens.map((i) => {
          const conteudo = (
            <>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{i.label}:</span>
              <span className={`font-medium tabular-nums ${TONE[i.tone]}`}>{formatar(i.valor)}</span>
              {i.n != null && <span className="text-[11px] tabular-nums text-muted-foreground/70">({i.n})</span>}
            </>
          )
          return i.onClick ? (
            <button key={i.chave} type="button" onClick={i.onClick}
              className="group -mx-1.5 flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-muted/40"
              aria-label={`Filtrar por ${i.label}: ${formatar(i.valor)}`} data-testid={`total-${i.chave}`}>
              {conteudo}
              <span className="text-[10px] text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">↑</span>
            </button>
          ) : (
            <span key={i.chave} className="flex items-center gap-1.5" data-testid={`total-${i.chave}`}>{conteudo}</span>
          )
        })}
        <div className="flex-1" />
        <div className="text-sm font-medium tabular-nums">
          {totalLabel}: <span className="text-foreground">{formatar(geral)}</span>
        </div>
      </div>
    </div>
  )
}
