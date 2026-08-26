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
import { estadoDaFatura } from '@/lib/credit-card/estado-fatura'

// mesma paleta semântica do resto do sistema (Contas a Pagar)
const TOM_BADGE: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
  sky: 'bg-sky-100 text-sky-800',
  slate: 'bg-slate-100 text-slate-700',
}
import { Button } from '@/components/ui/button'

interface Summary {
  cardId: string
  creditLimit: number
  limitUsed: number
  limitAvailable: number
  limitUsedPercent: number
  limitBreakdown?: {
    faturasNaoPagas: number
    parceladoAVencer: number
    cicloAtualDesconhecido: boolean
  }
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
  proximasDeclaradas?: {
    proxima: number | null; seguinte: number | null; demais: number | null; total: number | null
    rotuloProxima: string | null; rotuloSeguinte: string | null
  } | null
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
              {/* ⚠️ "pelo menos" (26/08): as compras do ciclo ATUAL só aparecem na
                  próxima fatura, então o usado é um PISO. Antes o cartão dizia
                  18.348,72 com ~40 mil comprometidos no banco — e pior, ao pagar a
                  fatura o usado ZERARIA, com 28.989,62 de parcelado pendurado. */}
              <div className="text-xs text-zinc-500">
                Usado {summary.limitBreakdown?.cicloAtualDesconhecido && '(pelo menos)'}
              </div>
              <div className="text-lg font-bold tabular-nums text-red-700">
                {formatBRL(summary.limitUsed)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">
                Disponível {summary.limitBreakdown?.cicloAtualDesconhecido && '(no máximo)'}
              </div>
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
          {summary.limitBreakdown && (
            <div className="mt-3 space-y-1 border-t pt-2 text-[11px] text-zinc-600">
              <div className="flex justify-between">
                <span>faturas não pagas</span>
                <span className="tabular-nums">{formatBRL(summary.limitBreakdown.faturasNaoPagas)}</span>
              </div>
              <div className="flex justify-between">
                <span>parcelado a vencer (declarado pelo banco)</span>
                <span className="tabular-nums">{formatBRL(summary.limitBreakdown.parceladoAVencer)}</span>
              </div>
              {summary.limitBreakdown.cicloAtualDesconhecido && (
                <div className="flex justify-between text-amber-700">
                  <span>compras do ciclo atual</span>
                  <span className="italic">a apurar — chegam na próxima fatura</span>
                </div>
              )}
              {summary.limitBreakdown.parceladoAVencer > 0 && (
                <p className="pt-1 text-[10px] text-zinc-500">
                  Pagar a fatura libera só a parte dela — o parcelado segue comprometendo
                  o limite até ser cobrado nas próximas faturas.
                </p>
              )}
            </div>
          )}
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
                {/* ⚠️ 26/08: aqui saía "fecha em −29 dias" numa fatura que fechou em
                    29/07 — dia negativo é o sistema pedindo pro dono fazer a conta. E
                    não dizia que estava VENCIDA: R$ 18 mil em atraso sem cor na tela.
                    O estado vem de `estadoDaFatura` (decisão única, derivada da data e
                    do pago — o `status` gravado nunca transiciona sozinho). */}
                {(() => {
                  const e = estadoDaFatura(
                    {
                      closingDate: new Date(summary.currentInvoice!.closingDate),
                      dueDate: new Date(summary.currentInvoice!.dueDate),
                      totalAmount: summary.currentInvoice!.totalAmount,
                      paidAmount: summary.currentInvoice!.paidAmount,
                    },
                    new Date(),
                  )
                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM_BADGE[e.tom]}`}>
                          {e.rotulo}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatRef(summary.currentInvoice!.reference)} · {e.detalhe}
                        </span>
                      </div>
                      <div className={`mt-1 text-2xl font-bold tabular-nums ${e.estado === 'VENCIDA' ? 'text-rose-700' : 'text-zinc-900'}`}>
                        {formatBRL(summary.currentInvoice!.totalAmount)}
                      </div>
                      {summary.currentInvoice!.paidAmount > 0 && (
                        <div className="mt-1 text-xs text-emerald-700">
                          Já pago: {formatBRL(summary.currentInvoice!.paidAmount)} · falta {formatBRL(e.devido)}
                        </div>
                      )}
                      {e.estado === 'VENCIDA' && (
                        <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
                          Pagou? Importe o extrato e case o débito — a fatura vira <b>Paga</b>.
                        </p>
                      )}
                    </>
                  )
                })()}
              </>
            ) : (
              <p className="text-sm text-zinc-500">Nenhuma fatura ainda</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">Próximas faturas</h2>
            {/* ⚠️ 26/08: mostrava R$ 0,00 enquanto o PDF declarava "Agosto 10.747,10 ·
                Setembro 5.012,90 · Demais 13.229,62". Agora usa o que o BANCO declara.
                A projeção a partir das nossas linhas ficou só como conferência: na
                fatura real ela dá 71.733,16 contra 28.989,62, porque uma compra grande
                tem 4 parcelas na MESMA fatura + estorno de −20.954,54 (antecipação). */}
            {summary.proximasDeclaradas?.total != null ? (
              <>
                <div className="text-2xl font-bold tabular-nums text-zinc-900">
                  {formatBRL(summary.proximasDeclaradas.proxima ?? 0)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {summary.proximasDeclaradas.rotuloProxima ?? 'próxima'} · declarado pelo banco na fatura
                </div>
                <div className="mt-2 space-y-0.5 border-t pt-2 text-[11px] text-zinc-600">
                  {summary.proximasDeclaradas.seguinte != null && (
                    <div className="flex justify-between">
                      <span>{summary.proximasDeclaradas.rotuloSeguinte ?? 'seguinte'}</span>
                      <span className="tabular-nums">{formatBRL(summary.proximasDeclaradas.seguinte)}</span>
                    </div>
                  )}
                  {summary.proximasDeclaradas.demais != null && (
                    <div className="flex justify-between">
                      <span>demais faturas</span>
                      <span className="tabular-nums">{formatBRL(summary.proximasDeclaradas.demais)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-0.5 font-medium">
                    <span>total a vencer</span>
                    <span className="tabular-nums">{formatBRL(summary.proximasDeclaradas.total)}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums text-zinc-400">a apurar</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Importe a fatura em PDF — o banco declara as próximas nela.
                </div>
              </>
            )}
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
          {/* ⚠️ 26/08: apontava pro import de EXTRATO (OFX) e dizia "fatura OFX".
              No Brasil fatura de cartão vem em PDF — o Banrisul não emite OFX de
              cartão. Agora leva pra tela própria de import de fatura. */}
          <Link href={`/perfis/${id}/cartoes/${cardId}/importar-fatura`}>
            <Upload className="h-4 w-4 mr-1" />
            Importar fatura PDF
          </Link>
        </Button>
      </div>
    </div>
  )
}
