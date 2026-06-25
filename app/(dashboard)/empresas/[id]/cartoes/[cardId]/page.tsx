// Sprint Cartao Credito PJ — dashboard do cartao (visao Mercury-like)

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CreditCard, Upload, Loader2, ArrowLeft, Repeat, Link2, CheckCircle2, Undo2, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

interface DashboardData {
  card: {
    id: string
    name: string
    bankName: string | null
    brand: string | null
    lastDigits: string | null
    creditLimit: number
    closingDay: number
    dueDay: number
    monthSpend: number
    monthTxCount: number
    utilizationPct: number
    latestInvoiceMonth: string | null
  }
  monthTransactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: string
    installmentNumber: number | null
    installmentTotal: number | null
    categoryName: string | null
    isCardPayment: boolean
  }>
  spendByCategory: Array<{
    categoryId: string | null
    categoryName: string
    amount: number
  }>
  matchedPayments: Array<{
    id: string
    date: string
    description: string
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
  }>
  availableInvoices: string[]
  currentInvoiceMonth: string | null
  paymentCandidates: Array<{
    id: string
    date: string
    description: string
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
    currentCategoryId: string | null
    currentCategoryName: string | null
    matchScore: number
    matchLabel: string
    isAlreadyMarkedPayment: boolean
  }>
}

export default function CartaoDashboardPage() {
  const params = useParams<{ id: string; cardId: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [casandoId, setCasandoId] = useState<string | null>(null)
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    const dashUrl = selectedInvoice
      ? `/api/empresas/${params.id}/cartoes/${params.cardId}?fatura=${encodeURIComponent(selectedInvoice)}`
      : `/api/empresas/${params.id}/cartoes/${params.cardId}`
    // R5: paymentCandidates vem agora dentro do dashboard payload (substitui
    // o endpoint /pagamentos-pendentes que so retornava isCardPayment=true).
    fetch(dashUrl, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((dashRes) => setData(dashRes))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.cardId, selectedInvoice])

  async function casarPagamento(txId: string) {
    setCasandoId(txId)
    try {
      const resp = await fetch(
        `/api/empresas/${params.id}/cartoes/${params.cardId}/casar-pagamento`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ txId }),
        },
      )
      const json = await resp.json()
      if (!resp.ok) {
        toast({ title: 'Erro', description: json.erro || 'Tente novamente', variant: 'destructive' })
        return
      }
      toast({
        title: 'Pagamento casado',
        description: `Saiu do DRE como despesa (R$ ${json.deltaDespesaRemovidoDoDRE.toFixed(2)})`,
      })
      reload()
    } finally {
      setCasandoId(null)
    }
  }

  async function desfazerCasamento(txId: string) {
    setDesfazendoId(txId)
    try {
      const resp = await fetch(
        `/api/empresas/${params.id}/cartoes/${params.cardId}/casar-pagamento?txId=${encodeURIComponent(txId)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      const json = await resp.json()
      if (!resp.ok) {
        toast({ title: 'Erro', description: json.erro || 'Tente novamente', variant: 'destructive' })
        return
      }
      toast({
        title: 'Casamento desfeito',
        description: 'Volta a "aguardando casar" — você pode casar de novo se quiser.',
      })
      reload()
    } finally {
      setDesfazendoId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        Carregando…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Cartão não encontrado.</p>
        <Link href={`/empresas/${params.id}/cartoes`}>
          <Button variant="outline">← Voltar</Button>
        </Link>
      </div>
    )
  }

  const { card, monthTransactions, spendByCategory } = data
  const limiteUsado = card.monthSpend
  const limiteDisp = Math.max(0, card.creditLimit - limiteUsado)
  const purchasesCount = monthTransactions.filter((t) => !t.isCardPayment).length

  // R6 — Status da fatura: paga se há matchedPayments na competência ativa
  const faturaPaga = data.matchedPayments.length > 0
  const topMatchedPayment = data.matchedPayments[0] ?? null
  const topCandidate = data.paymentCandidates[0] ?? null

  return (
    <div className="space-y-6">
      <Header
        title={card.name}
        description={
          [card.bankName, card.brand, card.lastDigits ? `final ${card.lastDigits}` : null]
            .filter(Boolean)
            .join(' · ') || 'Cartão de crédito PJ'
        }
      >
        <div className="flex gap-2">
          <Link href={`/empresas/${params.id}/cartoes`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Cartões
            </Button>
          </Link>
          <Link href={`/empresas/${params.id}/cartoes/${card.id}/importar-fatura`}>
            <Button>
              <Upload className="h-4 w-4 mr-1" />
              Importar fatura PDF
            </Button>
          </Link>
        </div>
      </Header>

      {/* R6 — HEADER PREMIUM DA FATURA (estilo Mercury) */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        {/* Top row: mini cartão + selo + seletor */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-14 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 flex items-end justify-end p-1.5 shadow-sm">
              <CreditCard className="h-3.5 w-3.5 text-white/80 dark:text-slate-900/80" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {card.brand ?? 'Cartão'} {card.lastDigits ? `· •••• ${card.lastDigits}` : ''}
              </p>
              <p className="text-sm font-medium truncate">{card.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {data.availableInvoices.length > 0 && (
              <select
                value={data.currentInvoiceMonth ?? ''}
                onChange={(e) => setSelectedInvoice(e.target.value || null)}
                className="border border-border bg-background rounded-full h-8 px-3 text-xs font-medium hover:border-foreground/30 transition-colors"
                aria-label="Selecionar fatura"
              >
                {data.availableInvoices.map((m) => (
                  <option key={m} value={m}>{fmtInvoiceLabel(m)}</option>
                ))}
              </select>
            )}
            <StatusPill paga={faturaPaga} />
          </div>
        </div>

        {/* Valor central + métricas */}
        <div className="px-6 pb-5 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Fatura {data.currentInvoiceMonth ? fmtInvoiceLabel(data.currentInvoiceMonth) : 'pendente'}
            </p>
            <p className="text-[38px] leading-tight font-medium tabular-nums tracking-[-0.02em]">
              {formatBRL(limiteUsado)}
            </p>
          </div>

          {/* Barra de limite */}
          <div className="space-y-1.5">
            <div className="h-[5px] bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  card.utilizationPct >= 0.9
                    ? 'bg-red-500'
                    : card.utilizationPct >= 0.7
                      ? 'bg-amber-500'
                      : 'bg-emerald-500/80'
                }`}
                style={{ width: `${Math.min(100, card.utilizationPct * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{Math.round(card.utilizationPct * 100)}%</span> do limite ·{' '}
              <span className="font-medium text-foreground tabular-nums">{formatBRL(limiteDisp)}</span> disponível
            </p>
          </div>

          {/* 3 métricas com divisores */}
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border pt-4 -mx-6 px-6">
            <Metric label="Vencimento" value={`dia ${card.dueDay}`} />
            <Metric label="Lançamentos" value={String(purchasesCount)} centered />
            <Metric label="Fechamento" value={`dia ${card.closingDay}`} rightAligned />
          </div>
        </div>

        {/* Linha de pagamento integrada — paga (verde) OU candidato (azul) OU aviso (âmbar) */}
        {faturaPaga && topMatchedPayment && (
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-t border-emerald-200/60 dark:border-emerald-900/40 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="h-7 w-7 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="text-emerald-900 dark:text-emerald-100">
                Paga em <span className="font-medium">{fmtDateBR(topMatchedPayment.date)}</span>
                {topMatchedPayment.bankAccountName && (
                  <> pela <span className="font-medium">{topMatchedPayment.bankAccountName}</span></>
                )}
                {' · '}
                <span className="font-medium tabular-nums">{formatBRL(topMatchedPayment.amount)}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={desfazendoId === topMatchedPayment.id}
              onClick={() => desfazerCasamento(topMatchedPayment.id)}
              className="text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 font-medium inline-flex items-center gap-1 disabled:opacity-50"
            >
              {desfazendoId === topMatchedPayment.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Undo2 className="h-3 w-3" />
              )}
              desfazer
            </button>
          </div>
        )}

        {!faturaPaga && topCandidate && (
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border-t border-blue-200/60 dark:border-blue-900/40 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="h-7 w-7 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Link2 className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="text-blue-900 dark:text-blue-100">
                Achei pagamento{' '}
                <span className="font-medium tabular-nums">{formatBRL(topCandidate.amount)}</span>{' '}
                em <span className="font-medium">{fmtDateBR(topCandidate.date)}</span>
                {topCandidate.bankAccountName && (
                  <> · <span className="font-medium">{topCandidate.bankAccountName}</span></>
                )}
                {topCandidate.matchLabel && (
                  <span className="text-blue-700 dark:text-blue-300"> · {topCandidate.matchLabel}</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              disabled={casandoId === topCandidate.id}
              onClick={() => casarPagamento(topCandidate.id)}
              className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
            >
              {casandoId === topCandidate.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2 className="h-3 w-3 mr-1" />
              )}
              Casar pagamento
            </Button>
          </div>
        )}

        {!faturaPaga && !topCandidate && data.currentInvoiceMonth && purchasesCount > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border-t border-amber-200/60 dark:border-amber-900/40 px-6 py-3.5 flex items-center gap-2.5 text-sm text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Fatura em aberto. Quando o pagamento aparecer no extrato, dá pra casar aqui.</span>
          </div>
        )}
      </Card>

      {/* Candidatos extras (quando há > 1) — só lista se top já mostrado no header e ainda restam outros */}
      {data.paymentCandidates.length > 1 && (
        <Card className="rounded-xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outros possíveis pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {data.paymentCandidates.slice(1).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{fmtDateBR(p.date)} · {p.description}</span>
                    <span className="font-medium tabular-nums">{formatBRL(p.amount)}</span>
                    {p.bankAccountName && (
                      <span className="text-muted-foreground">· {p.bankAccountName}</span>
                    )}
                    {p.matchLabel && (
                      <span className="text-[11px] text-muted-foreground">· {p.matchLabel}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={casandoId === p.id}
                  onClick={() => casarPagamento(p.id)}
                  className="h-7 text-xs"
                >
                  {casandoId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Casar'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pagamentos casados anteriores (só lista quando há > 1 — o atual ja ta no header) */}
      {data.matchedPayments.length > 1 && (
        <Card className="rounded-xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pagamentos anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {data.matchedPayments.slice(1).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0 text-sm"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{fmtDateBR(p.date)} · {p.description}</span>
                  <span className="font-medium tabular-nums">{formatBRL(p.amount)}</span>
                  {p.bankAccountName && (
                    <span className="text-muted-foreground">· {p.bankAccountName}</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={desfazendoId === p.id}
                  onClick={() => desfazerCasamento(p.id)}
                  className="h-7 text-xs text-muted-foreground"
                >
                  {desfazendoId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'desfazer'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend by category */}
        <Card className="lg:col-span-1 rounded-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {spendByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem compras nesta fatura.</p>
            ) : (
              <div className="space-y-2.5">
                {spendByCategory.map((c) => (
                  <div key={c.categoryId ?? 'no-cat'} className="flex justify-between text-sm">
                    <span className="truncate flex-1 text-muted-foreground">{c.categoryName}</span>
                    <span className="tabular-nums font-medium">{formatBRL(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-2 rounded-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Compras da fatura {data.currentInvoiceMonth ? fmtInvoiceLabel(data.currentInvoiceMonth) : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem compras importadas ainda. Importe a fatura PDF pra ver tudo aqui.
              </p>
            ) : (
              <div className="space-y-0">
                {monthTransactions.filter((t) => !t.isCardPayment).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-2.5 border-t border-border first:border-0 text-sm gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate">{t.description}</span>
                        {t.installmentNumber && t.installmentTotal && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 font-normal"
                          >
                            {t.installmentNumber}/{t.installmentTotal}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtDateBR(t.date)} {t.categoryName ? `· ${t.categoryName}` : ''}
                      </p>
                    </div>
                    <span className="tabular-nums font-medium text-foreground">
                      {formatBRL(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusPill({ paga }: { paga: boolean }) {
  if (paga) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/60 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Fatura paga
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
      <AlertCircle className="h-3 w-3" />
      Em aberto
    </span>
  )
}

function Metric({
  label,
  value,
  centered = false,
  rightAligned = false,
}: {
  label: string
  value: string
  centered?: boolean
  rightAligned?: boolean
}) {
  const align = rightAligned ? 'text-right pr-0 pl-4' : centered ? 'text-center px-4' : 'text-left pl-0 pr-4'
  return (
    <div className={align}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-[15px] font-medium tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function fmtDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtInvoiceLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split('-')
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1))
  return `${MESES_PT[idx]}/${y}`
}
