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
// ícone em CÍRCULO (24/08) — fundo suave + ícone no tom. Vale pra TODOS os cards do
// sistema, inclusive os da Contas a Pagar (que consome este mesmo componente): mudar aqui
// mantém as telas irmãs em vez de criar dois visuais.
const ICON_WRAP: Record<StatTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
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
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-0.5 truncate text-xl font-semibold tabular-nums ${VALUE_COLOR[tone]}`}>{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ICON_WRAP[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * A GRADE dos cards. Existe como componente porque a divergência que apareceu em 24/08
 * não foi no card e sim AQUI: metade das telas usava `grid-cols-2 gap-2 lg:grid-cols-4`
 * e a outra metade `gap-4 sm:grid-cols-2 lg:grid-cols-4` — que abaixo de `sm` vira UMA
 * coluna e o card ocupa a largura inteira (foi o "cards maiores" que o dono viu).
 * Uma grade só, como o card é um só.
 */
export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{children}</div>
}
