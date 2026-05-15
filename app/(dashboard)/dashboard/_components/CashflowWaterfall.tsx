// Cashflow Waterfall — Sprint 2 Dia 1.
// Server component: mostra como o dinheiro fluiu no período
// (saldo inicial → entradas → saídas → saldo final).
//
// Toggle de período via URL param ?wf=semana|mes|trimestre|ano (validado com Zod).

import Link from 'next/link'
import { TrendingUp, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCashflowWaterfall } from '@/lib/dashboard/queries'
import { formatBRL } from '@/lib/format/money'
import type { WaterfallPeriodType } from '@/lib/dashboard/compute-waterfall'
import { CashflowWaterfallChartLoader } from './CashflowWaterfallChartLoader'

interface CashflowWaterfallProps {
  companyId: string
  periodType: WaterfallPeriodType
}

const PERIOD_OPTIONS: Array<{ value: WaterfallPeriodType; label: string }> = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'ano', label: 'Ano' },
]

function formatPeriodRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${fmt(start)} — ${fmt(end)}`
}

export async function CashflowWaterfall({ companyId, periodType }: CashflowWaterfallProps) {
  const waterfall = await getCashflowWaterfall(companyId, periodType)

  // Barras de fluxo (entrada/saída) — se não houver, é "sem movimentações"
  const temMovimentacao = waterfall.bars.some(
    (b) => b.kind === 'income' || b.kind === 'expense',
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Fluxo de Caixa
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPeriodRange(waterfall.period.startDate, waterfall.period.endDate)}
            </p>
          </div>

          {/* Toggle de período — links URL (?wf=) */}
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/dashboard?wf=${opt.value}`}
                scroll={false}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  opt.value === periodType
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-5">
        {temMovimentacao ? (
          <>
            <CashflowWaterfallChartLoader
              bars={waterfall.bars}
              totalEntradas={waterfall.totalEntradas}
              totalSaidas={waterfall.totalSaidas}
              periodStart={waterfall.period.startDate.toISOString()}
              periodEnd={waterfall.period.endDate.toISOString()}
            />
            {/* Resumo abaixo do gráfico */}
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <ResumoItem label="Saldo inicial" value={waterfall.saldoInicial} />
              <ResumoItem label="Entradas" value={waterfall.totalEntradas} accent="green" />
              <ResumoItem label="Saídas" value={waterfall.totalSaidas} accent="red" />
              <ResumoItem label="Saldo final" value={waterfall.saldoFinal} />
            </div>
          </>
        ) : (
          <EmptyWaterfall companyId={companyId} saldo={waterfall.saldoInicial} />
        )}
      </CardContent>
    </Card>
  )
}

function ResumoItem({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'green' | 'red'
}) {
  const color =
    accent === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'red'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-foreground'
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold tabular-nums ${color}`}>{formatBRL(value)}</p>
    </div>
  )
}

function EmptyWaterfall({ companyId, saldo }: { companyId: string; saldo: number }) {
  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Sem movimentações neste período</p>
      <p className="text-xs text-muted-foreground mt-1">
        Saldo inicial e final iguais: <span className="tabular-nums font-medium">{formatBRL(saldo)}</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Tente outro período no seletor acima ou importe um extrato OFX.
      </p>
      <Button variant="outline" size="sm" className="mt-4" asChild>
        <Link href={`/empresas/${companyId}/contas`}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Importar OFX
        </Link>
      </Button>
    </div>
  )
}
