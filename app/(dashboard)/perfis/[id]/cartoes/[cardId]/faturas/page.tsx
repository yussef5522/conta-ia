// Sprint PF Fatia 2 — Histórico de faturas do cartão.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Invoice {
  id: string
  reference: string
  totalAmount: number
  paidAmount: number
  status: string
  closingDate: string
  dueDate: string
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function formatRef(ref: string) {
  const [y, m] = ref.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[m - 1]}/${y}`
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Aberta', color: 'bg-blue-50 text-blue-700' },
  CLOSED: { label: 'Fechada', color: 'bg-amber-50 text-amber-700' },
  PAID: { label: 'Paga', color: 'bg-emerald-50 text-emerald-700' },
  PARTIAL: { label: 'Parcial', color: 'bg-orange-50 text-orange-700' },
  OVERDUE: { label: 'Atrasada', color: 'bg-red-50 text-red-700' },
}

export default function FaturasPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>
}) {
  const { id, cardId } = use(params)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/perfis/${id}/cartoes/${cardId}/faturas`)
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .finally(() => setLoading(false))
  }, [id, cardId])

  return (
    <div>
      <Link
        href={`/perfis/${id}/cartoes/${cardId}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao cartão
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-4">Histórico de faturas</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-600">Nenhuma fatura ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.OPEN
            const remaining = inv.totalAmount - inv.paidAmount
            return (
              <Link
                key={inv.id}
                href={`/perfis/${id}/cartoes/${cardId}/faturas/${inv.id}`}
              >
                <Card className="hover:border-emerald-300 transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-900">
                          {formatRef(inv.reference)}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-semibold tracking-wide px-2 py-0.5 rounded-full ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Vence em {new Date(inv.dueDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums">
                        {formatBRL(inv.totalAmount)}
                      </div>
                      {inv.paidAmount > 0 && inv.status !== 'PAID' && (
                        <div className="text-xs text-emerald-700">
                          Restante: {formatBRL(remaining)}
                        </div>
                      )}
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
