// Sprint PF Fatia 2 — Dashboard do cartão (KPIs + atalhos).

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CreditCard as CardIcon,
  Plus,
  Pencil,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Summary {
  cardId: string
  creditLimit: number
  limitUsed: number
  limitAvailable: number
  limitUsedPercent: number
  currentInvoice: {
    id: string
    reference: string
    totalAmount: number
    paidAmount: number
    closingDate: string
    dueDate: string
    daysUntilClosing: number
    daysUntilDue: number
  } | null
  nextInvoicePreview: number
}

interface CardData {
  id: string
  name: string
  bankName: string | null
  brand: string | null
  lastDigits: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  closingDayRule: string
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function formatRef(ref: string): string {
  const [y, m] = ref.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[m - 1]}/${y}`
}

export default function CartaoDashboardPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>
}) {
  const { id, cardId } = use(params)
  const [data, setData] = useState<{ card: CardData; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/perfis/${id}/cartoes/${cardId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.card) setData(d)
      })
      .finally(() => setLoading(false))
  }, [id, cardId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600">Cartão não encontrado</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/perfis/${id}/cartoes`}>Voltar</Link>
        </Button>
      </div>
    )
  }

  const { card, summary } = data
  const usedColor =
    summary.limitUsedPercent >= 90
      ? 'bg-red-500'
      : summary.limitUsedPercent >= 70
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  return (
    <div>
      <Link
        href={`/perfis/${id}/cartoes`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos cartões
      </Link>

      {/* Hero */}
      <div className="flex items-start gap-4 mb-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <CardIcon className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900">{card.name}</h1>
          <p className="text-sm text-zinc-500">
            {card.bankName}
            {card.brand && ` · ${card.brand}`}
            {card.lastDigits && ` · ****${card.lastDigits}`}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Fecha dia {card.closingDay} · Vence dia {card.dueDay} ·{' '}
            {card.closingDayRule === 'ATUAL' ? 'Compra no fechamento entra na atual' : 'Compra no fechamento entra na próxima'}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href={`/perfis/${id}/cartoes/${cardId}/compras/novo`}>
              <Plus className="h-4 w-4 mr-1" />
              Nova compra
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/perfis/${id}/cartoes/${cardId}/editar`}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Limite */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold text-zinc-900">Limite</h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              {summary.limitUsedPercent.toFixed(0)}% usado
            </span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-xs text-zinc-500">Total</div>
              <div className="text-lg font-bold tabular-nums">{formatBRL(summary.creditLimit)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Usado</div>
              <div className="text-lg font-bold tabular-nums text-red-700">
                {formatBRL(summary.limitUsed)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Disponível</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700">
                {formatBRL(summary.limitAvailable)}
              </div>
            </div>
          </div>
          <div className="h-2.5 bg-zinc-100 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${usedColor}`}
              style={{ width: `${summary.limitUsedPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fatura atual + próxima */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-900">Fatura atual</h2>
              {summary.currentInvoice && (
                <Link
                  href={`/perfis/${id}/cartoes/${cardId}/faturas/${summary.currentInvoice.id}`}
                  className="text-xs text-emerald-700 font-medium hover:underline"
                >
                  Ver detalhes →
                </Link>
              )}
            </div>
            {summary.currentInvoice ? (
              <>
                <div className="text-xs text-zinc-500">
                  {formatRef(summary.currentInvoice.reference)} · fecha em{' '}
                  {summary.currentInvoice.daysUntilClosing} dias
                </div>
                <div className="text-2xl font-bold tabular-nums text-zinc-900 mt-1">
                  {formatBRL(summary.currentInvoice.totalAmount)}
                </div>
                {summary.currentInvoice.paidAmount > 0 && (
                  <div className="text-xs text-emerald-700 mt-1">
                    Já pago: {formatBRL(summary.currentInvoice.paidAmount)}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">Nenhuma fatura ainda</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">Próxima fatura (preview)</h2>
            <div className="text-2xl font-bold tabular-nums text-zinc-900">
              {formatBRL(summary.nextInvoicePreview)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Considera parcelas conhecidas</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link href={`/perfis/${id}/cartoes/${cardId}/faturas`}>
            <FileText className="h-4 w-4 mr-1" />
            Histórico de faturas
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
          <Link href={`/perfis/${id}/importar?cartao=${cardId}`}>
            <Upload className="h-4 w-4 mr-1" />
            Importar fatura OFX
          </Link>
        </Button>
      </div>
    </div>
  )
}
