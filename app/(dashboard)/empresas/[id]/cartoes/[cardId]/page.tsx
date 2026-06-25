// Sprint Cartao Credito PJ — dashboard do cartao (visao Mercury-like)

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CreditCard, Upload, Loader2, ArrowLeft, Repeat, Link2 } from 'lucide-react'
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
}

interface PagamentoPendente {
  id: string
  date: string
  description: string
  amount: number
  bankAccountId: string | null
  bankAccountName: string | null
  currentCategoryId: string | null
  currentCategoryName: string | null
}

export default function CartaoDashboardPage() {
  const params = useParams<{ id: string; cardId: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendentes, setPendentes] = useState<PagamentoPendente[]>([])
  const [casandoId, setCasandoId] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    Promise.all([
      fetch(`/api/empresas/${params.id}/cartoes/${params.cardId}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/empresas/${params.id}/cartoes/pagamentos-pendentes`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { pendentes: [] })),
    ])
      .then(([dashRes, pendRes]) => {
        setData(dashRes)
        setPendentes(pendRes?.pendentes ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.cardId])

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
            <p className="text-xs text-muted-foreground">Usado no mês</p>
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

      {/* Pagamentos aguardando casar */}
      {pendentes.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-indigo-600" />
              Pagamento{pendentes.length > 1 ? 's' : ''} de cartão aguardando casar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-indigo-900">
              Detectei {pendentes.length} pagamento{pendentes.length > 1 ? 's' : ''} de cartão no extrato.
              Cada um já está <strong>fora do DRE</strong> (não conta como despesa). Marque o que
              pertence a este cartão pra confirmar o casamento.
            </p>
            <div className="space-y-1">
              {pendentes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-1.5 border-t border-indigo-100 first:border-0"
                >
                  <div className="flex-1 min-w-0 text-sm">
                    <span>{fmtDateBR(p.date)} · {p.description} · </span>
                    <strong>{formatBRL(p.amount)}</strong>
                    {p.bankAccountName && (
                      <span className="text-muted-foreground"> · {p.bankAccountName}</span>
                    )}
                    {p.currentCategoryName && (
                      <span className="text-amber-700"> · hoje: {p.currentCategoryName}</span>
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
