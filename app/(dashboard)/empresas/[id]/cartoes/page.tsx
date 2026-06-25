// Sprint Cartao Credito PJ — lista de cartoes da empresa

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CreditCard, Plus, Loader2 } from 'lucide-react'
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
            const tone =
              c.utilizationPct >= 0.9
                ? 'text-red-700'
                : c.utilizationPct >= 0.7
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            return (
              <Link key={c.id} href={`/empresas/${params.id}/cartoes/${c.id}`}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.bankName, c.brand, c.lastDigits ? `final ${c.lastDigits}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Limite</p>
                        <p className="text-sm font-medium">{formatBRL(c.creditLimit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Gasto do mês</p>
                        <p className={`text-sm font-medium ${tone}`}>{formatBRL(c.monthSpend)}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            c.utilizationPct >= 0.9
                              ? 'bg-red-500'
                              : c.utilizationPct >= 0.7
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, c.utilizationPct * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Fechamento dia {c.closingDay} · vence dia {c.dueDay} · {c.monthTxCount} transações
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
