// Sprint PF Fatia 2 — Lista de cartões do perfil.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, CreditCard as CardIcon, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CardItem {
  id: string
  name: string
  bankName: string | null
  brand: string | null
  lastDigits: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default function CartoesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [cards, setCards] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/perfis/${id}/cartoes`)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao perfil
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cartões de crédito</h1>
          <p className="text-sm text-zinc-600">
            Múltiplos cartões, limites, faturas e parcelamento.
          </p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link href={`/perfis/${id}/cartoes/novo`}>
            <Plus className="h-4 w-4 mr-1" />
            Novo cartão
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CardIcon className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <h2 className="font-semibold text-zinc-900 mb-1">Nenhum cartão ainda</h2>
            <p className="text-sm text-zinc-600 max-w-md mx-auto mb-4">
              Cadastre seu cartão com limite, dia de fechamento e vencimento.
              Depois lance suas compras à vista ou parceladas.
            </p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href={`/perfis/${id}/cartoes/novo`}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar cartão
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.id} href={`/perfis/${id}/cartoes/${c.id}`} className="group">
              <Card className="hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <CardIcon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-900 group-hover:text-emerald-700 truncate">
                        {c.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate">
                        {c.bankName}
                        {c.brand && ` · ${c.brand}`}
                        {c.lastDigits && ` · ****${c.lastDigits}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-zinc-500 text-xs">Limite total</div>
                  <div className="text-xl font-bold tabular-nums text-zinc-900">
                    {formatBRL(c.creditLimit)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-2">
                    Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
