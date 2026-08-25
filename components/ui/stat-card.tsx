// MOLDE OFICIAL (24/08) — card de resumo do topo. Nasceu na /contas-a-pagar e virou o
// padrão do sistema; esta é a implementação ÚNICA (REGRA 4) — a de contas-a-pagar passou
// a ser uma casca fina sobre esta, pra não existirem dois cards que divergem com o tempo.
//
// Diferença pro original: `tone` é semântico e aberto (não só os 4 estados de conta a
// pagar), e o valor entra JÁ FORMATADO — algumas telas mostram dinheiro, outras mostram
// contagem ("12 itens") ou texto ("a apurar").

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export type StatTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'violet'

// Mapas EXPLÍCITOS — Tailwind não vê classe montada por interpolação.
const VALUE_COLOR: Record<StatTone, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  slate: 'text-slate-900 dark:text-slate-100',
  violet: 'text-violet-600 dark:text-violet-400',
}
const ICON_COLOR: Record<StatTone, string> = {
  emerald: 'text-emerald-400/40',
  sky: 'text-sky-400/40',
  amber: 'text-amber-400/40',
  rose: 'text-rose-300',
  slate: 'text-slate-300',
  violet: 'text-violet-400/40',
}
const RING: Record<StatTone, string> = {
  emerald: 'ring-emerald-400/50', sky: 'ring-sky-400/50', amber: 'ring-amber-400/50',
  rose: 'ring-rose-400/50', slate: 'ring-slate-400/50', violet: 'ring-violet-400/50',
}

export interface StatCardProps {
  tone: StatTone
  label: string
  /** já formatado: "R$ 1.234,56" · "214" · "a apurar" */
  value: string
  /** linha de baixo: "214 contas" · "3 fornecedores" */
  sub?: string
  icon: LucideIcon
  onClick?: () => void
  /** marca o card como o filtro ativo */
  active?: boolean
  testId?: string
}

export function StatCard({ tone, label, value, sub, icon: Icon, onClick, active, testId }: StatCardProps) {
  const clicavel = !!onClick
  return (
    <Card
      className={`${clicavel ? 'cursor-pointer transition-colors hover:bg-muted/30' : ''} ${active ? `ring-1 ${RING[tone]}` : ''}`}
      onClick={onClick}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onKeyDown={clicavel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      data-testid={testId}
    >
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-1 truncate text-2xl font-semibold tabular-nums ${VALUE_COLOR[tone]}`}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <Icon className={`h-8 w-8 shrink-0 ${ICON_COLOR[tone]}`} />
        </div>
      </CardContent>
    </Card>
  )
}
