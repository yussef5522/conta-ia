// Sprint Emprestimos Acompanhamento Mensal (27/06/2026) — tela premium.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, Clock, Archive, Loader2, ArrowLeft,
  HandCoins,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

interface Item {
  id: string
  number: number
  dueDate: string
  payment: number
  interest: number
  amortization: number
  isEstimate: boolean
  status: 'PAGA' | 'AGUARDANDO' | 'ATRASADA' | 'PLACEHOLDER'
  paidDate: string | null
  reconciledTransactionId: string | null
  loan: {
    id: string
    lender: string
    contractNumber: string | null
    bankAccountName: string | null
  }
}

interface Data {
  mes: string
  items: Item[]
  counts: { total: number; paga: number; aguardando: number; atrasada: number; placeholder: number }
  totals: { valorPago: number; valorEsperado: number; jurosPago: number }
  availableMonths: string[]
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtMonth(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split('-')
  return `${MESES_PT[parseInt(m, 10) - 1]}/${y}`
}
function fmtDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ParcelasDoMesPage() {
  const params = useParams<{ id: string }>()
  const today = new Date()
  const defaultMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [mes, setMes] = useState<string>(defaultMes)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/empresas/${params.id}/emprestimos/parcelas-do-mes?mes=${mes}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [params.id, mes])

  return (
    <div className="space-y-6">
      <Header
        title="Parcelas do mês"
        description="Acompanhe quais parcelas casaram com o extrato e quais estão pendentes"
      >
        <Link href={`/empresas/${params.id}/emprestimos`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Carteira
          </Button>
        </Link>
      </Header>

      {/* Seletor de mês */}
      {data && data.availableMonths.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mês:</span>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="border border-border bg-background rounded-full h-8 px-3 text-xs font-medium hover:border-foreground/30 transition-colors"
          >
            {data.availableMonths.map((m) => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label="Casadas"
              value={String(data.counts.paga)}
              sub={`${formatBRL(data.totals.valorPago)} pago`}
              tone="emerald"
            />
            <KpiCard
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              label="Aguardando"
              value={String(data.counts.aguardando)}
              sub="dentro do prazo"
              tone="amber"
            />
            <KpiCard
              icon={<AlertCircle className="h-4 w-4 text-red-600" />}
              label="Atrasadas"
              value={String(data.counts.atrasada)}
              sub="passaram de 3 dias"
              tone="red"
            />
            <KpiCard
              icon={<HandCoins className="h-4 w-4 text-muted-foreground" />}
              label="A pagar"
              value={formatBRL(data.totals.valorEsperado)}
              sub={`juros pagos: ${formatBRL(data.totals.jurosPago)}`}
              tone="slate"
            />
          </div>

          {/* Lista de parcelas */}
          {data.items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Archive className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma parcela vence em {fmtMonth(mes)}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border-border/60">
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-[10px] uppercase text-muted-foreground tracking-wider">
                      <tr>
                        <th className="text-left py-2 w-16">Status</th>
                        <th className="text-left py-2">Empréstimo</th>
                        <th className="text-center py-2 w-14">Nº</th>
                        <th className="text-center py-2 w-24">Vencimento</th>
                        <th className="text-right py-2 w-32">Valor planejado</th>
                        <th className="text-center py-2 w-24">Pago em</th>
                        <th className="text-right py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((it) => (
                        <ParcelaRow key={it.id} item={it} empresaId={params.id} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function ParcelaRow({ item, empresaId }: { item: Item; empresaId: string }) {
  const visual = visualStatusOf(item.status)
  return (
    <tr className="border-b last:border-0">
      <td className="py-2.5">
        <StatusPill status={item.status} />
      </td>
      <td className="py-2.5">
        <Link
          href={`/empresas/${empresaId}/emprestimos/${item.loan.id}`}
          className="text-sm hover:text-primary transition-colors"
        >
          <span className="font-medium">{item.loan.lender}</span>
          {item.loan.contractNumber && (
            <span className="text-muted-foreground"> · {item.loan.contractNumber}</span>
          )}
        </Link>
      </td>
      <td className="py-2.5 text-center text-muted-foreground tabular-nums">
        {item.number}
      </td>
      <td className="py-2.5 text-center tabular-nums">{fmtDateBR(item.dueDate)}</td>
      <td className="py-2.5 text-right tabular-nums font-medium">
        {formatBRL(item.payment)}
        {item.isEstimate && (
          <span className="ml-1 text-[10px] text-muted-foreground italic">(estim.)</span>
        )}
      </td>
      <td className={`py-2.5 text-center tabular-nums ${visual.dateColor}`}>
        {item.paidDate ? fmtDateBR(item.paidDate) : '—'}
      </td>
      <td className="py-2.5 text-right">
        {(item.status === 'AGUARDANDO' || item.status === 'ATRASADA') && (
          <Link
            href={`/empresas/${empresaId}/emprestimos/${item.loan.id}`}
            className="text-xs text-primary hover:underline"
          >
            casar
          </Link>
        )}
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: Item['status'] }) {
  const cfg = {
    PAGA: {
      icon: CheckCircle2,
      label: 'Paga',
      cls: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300',
    },
    AGUARDANDO: {
      icon: Clock,
      label: 'Aguarda',
      cls: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900/60 text-amber-700 dark:text-amber-300',
    },
    ATRASADA: {
      icon: AlertCircle,
      label: 'Atrasada',
      cls: 'bg-red-50 dark:bg-red-950/40 border-red-200/70 dark:border-red-900/60 text-red-700 dark:text-red-300',
    },
    PLACEHOLDER: {
      icon: Archive,
      label: 'Histórico',
      cls: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 text-slate-500 dark:text-slate-400',
    },
  }[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

function visualStatusOf(status: Item['status']): { dateColor: string } {
  if (status === 'PAGA') return { dateColor: 'text-emerald-700 dark:text-emerald-400' }
  if (status === 'ATRASADA') return { dateColor: 'text-red-700 dark:text-red-400' }
  return { dateColor: 'text-muted-foreground' }
}

function KpiCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone: 'emerald' | 'amber' | 'red' | 'slate'
}) {
  const toneClass = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
    slate: 'text-foreground',
  }[tone]
  return (
    <Card className="rounded-xl border-border/60">
      <CardContent className="py-3.5 space-y-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        </div>
        <p className={`text-2xl font-medium tabular-nums tracking-tight ${toneClass}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}
