// Sprint Cartao Credito PJ — lista de cartoes da empresa

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CreditCard, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

interface CardRow {
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
  isLatestInvoicePaid: boolean
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtInvoiceLabel(ym: string | null): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ''
  const [y, m] = ym.split('-')
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1))
  return `${MESES_PT[idx]}/${y}`
}

export default function CartoesListaPage() {
  const params = useParams<{ id: string }>()
  const [cards, setCards] = useState<CardRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/empresas/${params.id}/cartoes`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCards(d?.cards ?? []))
      .finally(() => setLoading(false))
  }, [params.id])

  return (
    <div className="space-y-6">
      <Header
        title="Cartões de crédito"
        description="Cartões PJ da empresa. Compras viram despesa; pagamento da fatura = transferência banco → cartão."
      >
        <Link href={`/empresas/${params.id}/cartoes/novo`}>
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Novo cartão
          </Button>
        </Link>
      </Header>

      {loading && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && cards && cards.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-base font-medium">Nenhum cartão cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Cadastre o 1º cartão pra importar fatura PDF com IA + categorizar compras.
            </p>
            <Link href={`/empresas/${params.id}/cartoes/novo`}>
              <Button className="mt-2">
                <Plus className="h-4 w-4 mr-1" />
                Cadastrar cartão
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!loading && cards && cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const hasInvoice = !!c.latestInvoiceMonth
            const paga = c.isLatestInvoicePaid
            return (
              <Link key={c.id} href={`/empresas/${params.id}/cartoes/${c.id}`}>
                <Card className="rounded-2xl border-border/60 shadow-sm hover:shadow-md hover:border-foreground/20 transition-all cursor-pointer overflow-hidden">
                  <CardContent className="py-5 px-5 space-y-5">
                    {/* Header: mini-cartão + selo status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-12 rounded-md bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 flex items-end justify-end p-1.5 flex-shrink-0">
                          <CreditCard className="h-3 w-3 text-white/80 dark:text-slate-900/80" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                            {[c.brand, c.lastDigits ? `•••• ${c.lastDigits}` : null].filter(Boolean).join(' · ') || c.bankName}
                          </p>
                          <p className="text-sm font-medium truncate">{c.name}</p>
                        </div>
                      </div>
                      {hasInvoice && <CardStatusPill paga={paga} />}
                    </div>

                    {/* Valor destaque */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        {hasInvoice ? `Fatura ${fmtInvoiceLabel(c.latestInvoiceMonth)}` : 'Sem fatura'}
                      </p>
                      <p className="text-2xl font-medium tabular-nums tracking-[-0.01em] mt-0.5">
                        {hasInvoice ? formatBRL(c.monthSpend) : '—'}
                      </p>
                    </div>

                    {/* Barra de limite */}
                    <div className="space-y-1.5">
                      <div className="h-[5px] bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            c.utilizationPct >= 0.9
                              ? 'bg-red-500'
                              : c.utilizationPct >= 0.7
                                ? 'bg-amber-500'
                                : 'bg-emerald-500/80'
                          }`}
                          style={{ width: `${Math.min(100, c.utilizationPct * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">{Math.round(c.utilizationPct * 100)}%</span>{' '}
                        de {formatBRL(c.creditLimit)} · vence dia {c.dueDay}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardStatusPill({ paga }: { paga: boolean }) {
  if (paga) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/60 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 flex-shrink-0">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Paga
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 flex-shrink-0">
      <AlertCircle className="h-2.5 w-2.5" />
      Aberta
    </span>
  )
}
