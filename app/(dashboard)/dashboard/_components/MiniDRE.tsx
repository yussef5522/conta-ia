// Mini-DRE compacta — Sprint 1 Dia 2.
// Server component que faz fetch + renderiza 5 linhas resumidas.

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMiniDRE } from '@/lib/dashboard/queries'
import { formatBRL } from '@/lib/format/money'
import type { MiniDRELine } from '@/lib/dashboard/compute-mini-dre'

interface MiniDREProps {
  companyId: string
}

export async function MiniDRE({ companyId }: MiniDREProps) {
  const dre = await getMiniDRE(companyId)

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">DRE Gerencial</CardTitle>
        <Link
          href={`/empresas/${companyId}/dre`}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          Ver DRE completa
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1 pb-5">
        {dre.lines.map((line) => (
          <Line key={line.id} line={line} />
        ))}
      </CardContent>
    </Card>
  )
}

function Line({ line }: { line: MiniDRELine }) {
  const valueDisplay = line.isReduction
    ? `-${formatBRL(line.value)}`
    : formatBRL(line.value)

  const DeltaIcon =
    line.deltaDirection === 'up'
      ? ArrowUpRight
      : line.deltaDirection === 'down'
        ? ArrowDownRight
        : Minus

  const deltaColor =
    line.deltaDirection === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : line.deltaDirection === 'down'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground'

  // deltaPercent é null quando o mês anterior era 0 (proteção contra div/0).
  // ANTES caía em formatBRL(deltaAbsolute) que duplicava o próprio valor da
  // linha visualmente. Agora mostramos "novo" — semântico ("primeira vez no
  // período comparado") e curto, sem sobrepor o valor à esquerda.
  const deltaLabel =
    line.deltaPercent !== null
      ? `${line.deltaPercent > 0 ? '+' : ''}${line.deltaPercent.toFixed(1)}%`
      : line.deltaAbsolute === 0
        ? '—'
        : 'novo'

  if (line.highlighted) {
    return (
      <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{line.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tabular-nums">{valueDisplay}</span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${deltaColor}`}
            >
              <DeltaIcon className="h-3 w-3" />
              {deltaLabel}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{line.label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums">{valueDisplay}</span>
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums w-[88px] justify-end ${deltaColor}`}
        >
          <DeltaIcon className="h-3 w-3" />
          {deltaLabel}
        </span>
      </div>
    </div>
  )
}
