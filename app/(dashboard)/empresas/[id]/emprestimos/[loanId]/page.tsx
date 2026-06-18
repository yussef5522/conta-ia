// Sprint Empréstimos UI — Detalhe /empresas/[id]/emprestimos/[loanId]

'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wallet,
  TrendingDown,
  Link2,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Header } from '@/components/layout/header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatBRL } from '@/lib/format/money'
import { CandidatosDialog } from './_components/candidatos-dialog'

const SaldoDevedorChart = dynamic(
  () => import('./_components/saldo-devedor-chart').then((m) => m.SaldoDevedorChart),
  { ssr: false, loading: () => <div className="h-48 bg-muted/20 rounded-md animate-pulse" /> },
)

interface LoanDetalhe {
  loan: {
    id: string
    lender: string
    contractNumber: string | null
    principal: number
    interestRateMonthly: number
    termMonths: number
    amortizationSystem: 'PRICE' | 'SAC'
    firstDueDate: string
    iof: number
    disbursementDate: string
    status: 'ACTIVE' | 'PAID_OFF' | 'LATE'
    bankAccount: { id: string; name: string; bankName: string | null }
    disbursementTransaction: {
      id: string
      date: string
      amount: number
      description: string
    } | null
  }
  agregados: {
    saldoDevedor: number
    jurosTotalContrato: number
    jurosPagos: number
    principalAmortizado: number
    parcelasPagas: number
    parcelasTotal: number
    proximaParcela: {
      number: number
      dueDate: string
      payment: number
      interest: number
      amortization: number
      isAtrasada: boolean
    } | null
  }
  installments: Array<{
    number: number
    dueDate: string
    openingBalance: number
    interest: number
    amortization: number
    payment: number
    closingBalance: number
    status: 'PAID' | 'OPEN' | 'LATE'
    paidDate: string | null
    reconciledTransaction: {
      id: string
      date: string
      amount: number
      description: string
      accountName: string | null
    } | null
  }>
  chartPoints: Array<{ x: number; label: string; saldoDevedor: number }>
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

const fmtRate = (r: number) => `${(r * 100).toFixed(2)}% a.m.`

function StatusInstallment({ s }: { s: 'PAID' | 'OPEN' | 'LATE' }) {
  if (s === 'PAID')
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Paga · conciliada
      </Badge>
    )
  if (s === 'LATE')
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Atrasada
      </Badge>
    )
  return (
    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
      <Clock className="h-3 w-3 mr-1" />
      Em aberto
    </Badge>
  )
}

export default function DetalheEmprestimoPage({
  params,
}: {
  params: Promise<{ id: string; loanId: string }>
}) {
  const { id: empresaId, loanId } = use(params)
  const { toast } = useToast()
  const [data, setData] = useState<LoanDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [openCandidatos, setOpenCandidatos] = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState<number | null>(null)

  function refresh() {
    setLoading(true)
    fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, loanId])

  async function desfazer(number: number) {
    const res = await fetch(
      `/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${number}`,
      { method: 'DELETE', credentials: 'include' },
    )
    if (res.ok) {
      toast({ title: `Parcela #${number} aberta de novo` })
      refresh()
    } else {
      toast({ variant: 'destructive', title: 'Falha ao desfazer' })
    }
    setConfirmUndo(null)
  }

  async function excluirLoan() {
    const res = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      toast({ title: 'Empréstimo excluído' })
      window.location.href = `/empresas/${empresaId}/emprestimos`
    } else {
      toast({ variant: 'destructive', title: 'Falha ao excluir' })
    }
    setConfirmDel(false)
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        Carregando…
      </div>
    )
  }

  const { loan, agregados, installments, chartPoints } = data

  return (
    <div className="space-y-6">
      <Header
        title={`${loan.lender}${loan.contractNumber ? ` · ${loan.contractNumber}` : ''}`}
        description={`${loan.bankAccount.name} · ${loan.termMonths}× ${loan.amortizationSystem} · ${fmtRate(loan.interestRateMonthly)}`}
      >
        <Link href={`/empresas/${empresaId}/emprestimos`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <Button variant="ghost" onClick={() => setConfirmDel(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4 mr-1" />
          Excluir
        </Button>
      </Header>

      {/* Status do contrato */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={
            loan.status === 'PAID_OFF'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-primary/10 text-primary border-primary/30'
          }
        >
          {loan.status === 'PAID_OFF' ? 'Quitado' : 'Ativo'}
        </Badge>
        {!loan.disbursementTransaction && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Liberação não linkada — receita fake no DRE
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Wallet className="h-4 w-4 text-primary" />}
          label="Saldo devedor"
          value={formatBRL(agregados.saldoDevedor)}
          sub={`${agregados.parcelasPagas}/${agregados.parcelasTotal} parcelas pagas`}
          tone="primary"
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4 text-slate-600" />}
          label="Principal"
          value={formatBRL(loan.principal)}
          sub={`${formatBRL(agregados.principalAmortizado)} amortizado`}
          tone="slate"
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          label="Juros do contrato"
          value={formatBRL(agregados.jurosTotalContrato)}
          sub={`${formatBRL(agregados.jurosPagos)} pagos`}
          tone="red"
        />
        <KpiCard
          icon={<Calendar className="h-4 w-4 text-amber-600" />}
          label="Próxima parcela"
          value={agregados.proximaParcela ? formatBRL(agregados.proximaParcela.payment) : '—'}
          sub={
            agregados.proximaParcela
              ? `#${agregados.proximaParcela.number} · ${fmtDate(agregados.proximaParcela.dueDate)}${agregados.proximaParcela.isAtrasada ? ' (atrasada)' : ''}`
              : 'Quitado'
          }
          tone={agregados.proximaParcela?.isAtrasada ? 'red' : 'amber'}
        />
      </div>

      {/* Gráfico saldo devedor */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Saldo devedor ao longo do contrato</p>
            <p className="text-xs text-muted-foreground">{loan.termMonths} parcelas</p>
          </div>
          <SaldoDevedorChart points={chartPoints} />
        </CardContent>
      </Card>

      {/* Cronograma */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <p className="text-sm font-medium">Cronograma de parcelas</p>
            <p className="text-xs text-muted-foreground">
              IOF: {formatBRL(loan.iof)} · Liberação:{' '}
              {fmtDate(loan.disbursementDate)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">Vencimento</th>
                  <th className="text-right p-3 font-medium">Saldo inicial</th>
                  <th className="text-right p-3 font-medium">Juros</th>
                  <th className="text-right p-3 font-medium">Amortização</th>
                  <th className="text-right p-3 font-medium">Parcela</th>
                  <th className="text-right p-3 font-medium">Saldo final</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => (
                  <tr
                    key={i.number}
                    className={`border-t hover:bg-muted/20 ${i.status === 'PAID' ? 'bg-emerald-50/20' : ''}`}
                  >
                    <td className="p-3 tabular-nums font-medium">{i.number}</td>
                    <td className="p-3 text-xs">{fmtDate(i.dueDate)}</td>
                    <td className="p-3 text-right tabular-nums text-xs text-muted-foreground">
                      {formatBRL(i.openingBalance)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs text-red-700">
                      {formatBRL(i.interest)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs text-emerald-700">
                      {formatBRL(i.amortization)}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {formatBRL(i.payment)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs text-muted-foreground">
                      {formatBRL(i.closingBalance)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <StatusInstallment s={i.status} />
                        {i.status === 'PAID' && i.reconciledTransaction && (
                          <button
                            type="button"
                            onClick={() => setConfirmUndo(i.number)}
                            className="text-[10px] text-muted-foreground hover:text-red-600 underline"
                            title={`Tx ${i.reconciledTransaction.date.slice(0, 10)} · ${formatBRL(i.reconciledTransaction.amount)}`}
                          >
                            Desfazer
                          </button>
                        )}
                        {(i.status === 'OPEN' || i.status === 'LATE') && (
                          <button
                            type="button"
                            onClick={() => setOpenCandidatos(i.number)}
                            className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            Marcar paga
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {openCandidatos !== null && (
        <CandidatosDialog
          empresaId={empresaId}
          loanId={loanId}
          parcelaNumber={openCandidatos}
          onClose={() => setOpenCandidatos(null)}
          onConfirmed={() => {
            setOpenCandidatos(null)
            refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Excluir empréstimo?"
        description="Vai apagar o contrato + cronograma. Tx OFX vinculadas continuam existindo (sem vínculo)."
        confirmLabel="Excluir"
        onConfirm={excluirLoan}
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmUndo !== null}
        onOpenChange={(o) => !o && setConfirmUndo(null)}
        title={`Desfazer parcela #${confirmUndo}?`}
        description="A parcela volta pra 'em aberto' e a tx fica livre pra outro vínculo."
        confirmLabel="Desfazer"
        variant="default"
        onConfirm={async () => {
          if (confirmUndo !== null) await desfazer(confirmUndo)
        }}
      />
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone: 'primary' | 'amber' | 'red' | 'slate'
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: 'border-primary/20 bg-primary/5',
    amber: 'border-amber-200 bg-amber-50/40',
    red: 'border-red-200 bg-red-50/40',
    slate: 'border-slate-200 bg-slate-50/40',
  }
  return (
    <Card className={toneClass[tone]}>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </CardContent>
    </Card>
  )
}
