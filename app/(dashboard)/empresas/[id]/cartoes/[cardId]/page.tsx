// Sprint Cartao Credito PJ — dashboard do cartao (visao Mercury-like)

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CreditCard, Upload, Loader2, ArrowLeft, Repeat, Link2, CheckCircle2, Undo2 } from 'lucide-react'
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
          <Link
            href={`/empresas/${params.id}/cartoes/${card.id}/importar-fatura`}
          >
            <Button>
              <Upload className="h-4 w-4 mr-1" />
              Importar fatura PDF
            </Button>
          </Link>
        </div>
      </Header>

      {/* R4 — Seletor de fatura */}
      {data.availableInvoices.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Fatura:</span>
          <select
            value={data.currentInvoiceMonth ?? ''}
            onChange={(e) => setSelectedInvoice(e.target.value || null)}
            className="border rounded-md h-8 px-2 text-sm"
          >
            {data.availableInvoices.map((m) => (
              <option key={m} value={m}>{fmtInvoiceLabel(m)}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            · {data.monthTransactions.filter((t) => !t.isCardPayment).length} compras + encargos
          </span>
        </div>
      )}

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Limite total</p>
            <p className="text-lg font-semibold tabular-nums">{formatBRL(card.creditLimit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">
              {data.currentInvoiceMonth ? `Fatura ${fmtInvoiceLabel(data.currentInvoiceMonth)}` : 'Sem fatura'}
            </p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                card.utilizationPct >= 0.9
                  ? 'text-red-700'
                  : card.utilizationPct >= 0.7
                    ? 'text-amber-700'
                    : 'text-foreground'
              }`}
            >
              {formatBRL(limiteUsado)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-700">
              {formatBRL(limiteDisp)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <p className="text-lg font-semibold">dia {card.dueDay}</p>
            <p className="text-[10px] text-muted-foreground">
              fecha dia {card.closingDay}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* R5: Candidatos a pagamento (valor exato R4 + hook OFX R2 unificados) */}
      {data.paymentCandidates.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-indigo-600" />
              Pagamento{data.paymentCandidates.length > 1 ? 's' : ''} aguardando casar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-indigo-900">
              Detectei {data.paymentCandidates.length} possível{data.paymentCandidates.length > 1 ? 'is' : ''} pagamento{data.paymentCandidates.length > 1 ? 's' : ''} desta fatura
              no extrato. Casar vira <strong>transferência banco → cartão</strong> (não conta como despesa
              no DRE). Você confirma cada um.
            </p>
            <div className="space-y-1">
              {data.paymentCandidates.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-1.5 border-t border-indigo-100 first:border-0"
                >
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{fmtDateBR(p.date)} · {p.description} · </span>
                      <strong>{formatBRL(p.amount)}</strong>
                      {p.bankAccountName && (
                        <span className="text-muted-foreground"> · {p.bankAccountName}</span>
                      )}
                      {p.matchLabel && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 ${
                            p.matchScore >= 0.95
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.matchScore >= 0.85
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {p.matchLabel}
                        </Badge>
                      )}
                    </div>
                    {p.currentCategoryName && (
                      <p className="text-[11px] text-amber-700">hoje: {p.currentCategoryName}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={casandoId === p.id}
                    onClick={() => casarPagamento(p.id)}
                    className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    {casandoId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        Casar com este cartão
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sprint R3 — pagamentos JÁ CASADOS com este cartão */}
      {data.matchedPayments.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Pagamento{data.matchedPayments.length > 1 ? 's' : ''} casado{data.matchedPayments.length > 1 ? 's' : ''} com este cartão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-emerald-900 mb-2">
              {data.matchedPayments.length} pagamento{data.matchedPayments.length > 1 ? 's' : ''} já estão
              fora do DRE como despesa (viram transferência banco → cartão). Pode desfazer se precisar.
            </p>
            {data.matchedPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-1.5 border-t border-emerald-100 first:border-0"
              >
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300"
                    >
                      ✓ casado
                    </Badge>
                    <span>{fmtDateBR(p.date)} · {p.description}</span>
                    <strong className="tabular-nums">{formatBRL(p.amount)}</strong>
                    {p.bankAccountName && (
                      <span className="text-xs text-muted-foreground">· {p.bankAccountName}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={desfazendoId === p.id}
                  onClick={() => desfazerCasamento(p.id)}
                  className="text-emerald-700 hover:bg-emerald-100"
                >
                  {desfazendoId === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Undo2 className="h-3.5 w-3.5 mr-1" />
                      desfazer
                    </>
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Barra de utilização */}
      <div className="space-y-1">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              card.utilizationPct >= 0.9
                ? 'bg-red-500'
                : card.utilizationPct >= 0.7
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, card.utilizationPct * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round(card.utilizationPct * 100)}% utilizado neste mês
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend by category */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Gasto por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {spendByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem compras neste mês.</p>
            ) : (
              <div className="space-y-2">
                {spendByCategory.map((c) => (
                  <div key={c.categoryId ?? 'no-cat'} className="flex justify-between text-sm">
                    <span className="truncate flex-1">{c.categoryName}</span>
                    <span className="tabular-nums font-medium">{formatBRL(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Compras do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {monthTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem compras importadas ainda. Importe a fatura PDF pra ver tudo aqui.
              </p>
            ) : (
              <div className="space-y-2">
                {monthTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate">{t.description}</span>
                        {t.installmentNumber && t.installmentTotal && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-sky-50 text-sky-700 border-sky-200"
                          >
                            {t.installmentNumber}/{t.installmentTotal}
                          </Badge>
                        )}
                        {t.isCardPayment && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
                          >
                            <Repeat className="h-3 w-3 mr-0.5" />
                            pagamento
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDateBR(t.date)} {t.categoryName ? `· ${t.categoryName}` : ''}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums font-medium ${
                        t.isCardPayment ? 'text-indigo-700' : 'text-foreground'
                      }`}
                    >
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
