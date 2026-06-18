// Sprint Empréstimos UI — Carteira /empresas/[id]/emprestimos

'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { use } from 'react'
import {
  Wallet,
  Plus,
  TrendingDown,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

interface LoanRow {
  id: string
  lender: string
  contractNumber: string | null
  principal: number
  amortizationSystem: 'PRICE' | 'SAC'
  termMonths: number
  interestRateMonthly: number
  status: 'ACTIVE' | 'PAID_OFF' | 'LATE'
  statusVisual: 'EM_DIA' | 'PROXIMA_VENCER' | 'ATRASADA' | 'QUITADO'
  bankAccount: { id: string; name: string; bankName: string | null }
  saldoDevedor: number
  totalPaid: number
  proximaParcelaDate: string | null
  proximaParcelaValor: number | null
  progresso: number
  disbursementVinculada: boolean
}

interface CarteiraResponse {
  loans: LoanRow[]
  agregados: {
    totalSaldoDevedor: number
    compromissoMes: number
    jurosMes: number
    proximoVencimento: { dueDate: string; loanId: string; lender: string } | null
    contratosAtivos: number
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

const fmtRate = (r: number) =>
  `${(r * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`

function StatusPill({ s }: { s: LoanRow['statusVisual'] }) {
  if (s === 'QUITADO')
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Quitado
      </Badge>
    )
  if (s === 'ATRASADA')
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Atrasada
      </Badge>
    )
  if (s === 'PROXIMA_VENCER')
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <Clock className="h-3 w-3 mr-1" />
        Vence em breve
      </Badge>
    )
  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Em dia
    </Badge>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

export default function CarteiraEmprestimosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: empresaId } = use(params)
  const [data, setData] = useState<CarteiraResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/empresas/${empresaId}/emprestimos`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [empresaId])

  // Agrupa por banco
  const groupedByBank = useMemo(() => {
    if (!data) return new Map<string, LoanRow[]>()
    const map = new Map<string, LoanRow[]>()
    for (const l of data.loans) {
      const key = l.lender
      const arr = map.get(key) ?? []
      arr.push(l)
      map.set(key, arr)
    }
    return map
  }, [data])

  return (
    <div className="space-y-6">
      <Header title="Empréstimos" description="Carteira de financiamentos da empresa">
        <Link href={`/empresas/${empresaId}/emprestimos/novo`}>
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Novo empréstimo
          </Button>
        </Link>
      </Header>

      {/* KPI Cards */}
      {loading && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<Wallet className="h-4 w-4 text-primary" />}
              label="Dívida total"
              value={formatBRL(data.agregados.totalSaldoDevedor)}
              sub={`${data.agregados.contratosAtivos} contrato${data.agregados.contratosAtivos === 1 ? '' : 's'} ativo${data.agregados.contratosAtivos === 1 ? '' : 's'}`}
              tone="primary"
            />
            <KpiCard
              icon={<Calendar className="h-4 w-4 text-amber-600" />}
              label="Compromisso do mês"
              value={formatBRL(data.agregados.compromissoMes)}
              sub="Soma das parcelas em aberto"
              tone="amber"
            />
            <KpiCard
              icon={<TrendingDown className="h-4 w-4 text-red-600" />}
              label="Juros do mês"
              value={formatBRL(data.agregados.jurosMes)}
              sub="Despesa financeira no DRE"
              tone="red"
            />
            <KpiCard
              icon={<Clock className="h-4 w-4 text-slate-600" />}
              label="Próximo vencimento"
              value={
                data.agregados.proximoVencimento
                  ? fmtDate(data.agregados.proximoVencimento.dueDate)
                  : '—'
              }
              sub={data.agregados.proximoVencimento?.lender ?? 'Nada agendado'}
              tone="slate"
            />
          </div>

          {/* Lista agrupada */}
          {data.loans.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-3">
                <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-base font-medium">Nenhum empréstimo cadastrado</p>
                <p className="text-sm text-muted-foreground">
                  Cadastre o 1º empréstimo pra controlar parcelas + linkar a liberação no extrato e tirar do DRE.
                </p>
                <Link href={`/empresas/${empresaId}/emprestimos/novo`}>
                  <Button className="mt-2">
                    <Plus className="h-4 w-4 mr-1" />
                    Cadastrar empréstimo
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedByBank.entries()).map(([lender, loans]) => {
                const subtotalDivida = loans.reduce((s, l) => s + l.saldoDevedor, 0)
                return (
                  <div key={lender} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-semibold text-foreground">{lender}</h3>
                      <p className="text-xs text-muted-foreground">
                        {loans.length} contrato{loans.length === 1 ? '' : 's'} ·{' '}
                        <span className="font-medium text-foreground">
                          {formatBRL(subtotalDivida)}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      {loans.map((l) => (
                        <Link
                          key={l.id}
                          href={`/empresas/${empresaId}/emprestimos/${l.id}`}
                          className="block"
                        >
                          <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                            <CardContent className="py-3.5 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium truncate">
                                    Contrato {l.contractNumber ?? '(sem nº)'}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {l.amortizationSystem}
                                  </Badge>
                                  <StatusPill s={l.statusVisual} />
                                  {!l.disbursementVinculada && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-amber-50/50 text-amber-700 border-amber-200"
                                    >
                                      Liberação não linkada
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>
                                    {l.termMonths}× · {fmtRate(l.interestRateMonthly)}
                                  </span>
                                  <span>·</span>
                                  <span>{l.bankAccount.name}</span>
                                </div>
                                <div className="space-y-1">
                                  <ProgressBar pct={l.progresso} />
                                  <p className="text-[10px] text-muted-foreground">
                                    {l.totalPaid}/{l.termMonths} parcelas pagas ({l.progresso}%)
                                  </p>
                                </div>
                              </div>
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Saldo devedor
                                </p>
                                <p className="text-sm font-semibold tabular-nums">
                                  {formatBRL(l.saldoDevedor)}
                                </p>
                              </div>
                              <div className="text-right hidden md:block min-w-[110px]">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Próxima
                                </p>
                                <p className="text-sm font-medium tabular-nums">
                                  {l.proximaParcelaValor !== null
                                    ? formatBRL(l.proximaParcelaValor)
                                    : '—'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {l.proximaParcelaDate ? fmtDate(l.proximaParcelaDate) : '—'}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
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
