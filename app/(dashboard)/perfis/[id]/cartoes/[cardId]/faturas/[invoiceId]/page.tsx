// Sprint PF Fatia 2 — Detalhe da fatura + pagar.

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface InvoiceTx {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  installmentNumber: number | null
  installmentTotal: number | null
  isInvoicePayment: boolean
  category: { id: string; name: string; color: string | null } | null
}
interface InvoiceDetail {
  id: string
  reference: string
  totalAmount: number
  paidAmount: number
  status: string
  closingDate: string
  dueDate: string
  transactions: InvoiceTx[]
}

interface AccountMini {
  id: string
  name: string
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
function formatRef(ref: string) {
  const [y, m] = ref.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[m - 1]}/${y}`
}

export default function FaturaDetalhePage({
  params,
}: {
  params: Promise<{ id: string; cardId: string; invoiceId: string }>
}) {
  const { id, cardId, invoiceId } = use(params)
  const router = useRouter()
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [accounts, setAccounts] = useState<AccountMini[]>([])
  const [loading, setLoading] = useState(true)
  const [showPay, setShowPay] = useState(false)
  const [payAccount, setPayAccount] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payJuros, setPayJuros] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetch(`/api/perfis/${id}/cartoes/${cardId}/faturas/${invoiceId}`)
      .then((r) => r.json())
      .then((d) => setInvoice(d.invoice))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    fetch(`/api/perfis/${id}/contas`)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
  }, [id, cardId, invoiceId])

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(
        `/api/perfis/${id}/cartoes/${cardId}/faturas/${invoiceId}/pagar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentAccountId: payAccount,
            amount: parseFloat(payAmount),
            juros: payJuros ? parseFloat(payJuros) : null,
          }),
        },
      )
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha no pagamento')
        return
      }
      setShowPay(false)
      setPayAmount('')
      setPayJuros('')
      reload()
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }
  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600">Fatura não encontrada</p>
      </div>
    )
  }

  const remaining = invoice.totalAmount - invoice.paidAmount
  const canPay = invoice.status !== 'PAID' && remaining > 0

  return (
    <div>
      <Link
        href={`/perfis/${id}/cartoes/${cardId}/faturas`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-1">
        Fatura {formatRef(invoice.reference)}
      </h1>
      <p className="text-sm text-zinc-500 mb-4">
        Fecha {new Date(invoice.closingDate).toLocaleDateString('pt-BR')} · Vence{' '}
        {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
      </p>

      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-zinc-500">Total</div>
              <div className="text-xl font-bold tabular-nums">{formatBRL(invoice.totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Pago</div>
              <div className="text-xl font-bold tabular-nums text-emerald-700">
                {formatBRL(invoice.paidAmount)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Restante</div>
              <div className="text-xl font-bold tabular-nums">{formatBRL(remaining)}</div>
            </div>
          </div>
          {canPay && (
            <div className="mt-4 pt-4 border-t">
              {!showPay ? (
                <Button
                  onClick={() => {
                    setPayAmount(remaining.toFixed(2))
                    setShowPay(true)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Pagar fatura
                </Button>
              ) : (
                <form onSubmit={handlePay} className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Conta de débito *</Label>
                    <Select value={payAccount} onValueChange={setPayAccount}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor a pagar *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remaining}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      required
                      className="mt-1 tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Juros do rotativo (opcional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payJuros}
                      onChange={(e) => setPayJuros(e.target.value)}
                      placeholder="0,00 — informe se o banco vai cobrar juros"
                      className="mt-1 tabular-nums"
                    />
                  </div>
                  {error && (
                    <div className="sm:col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  <div className="sm:col-span-2 flex gap-2">
                    <Button
                      type="submit"
                      disabled={submitting || !payAccount || !payAmount}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                    >
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Confirmar pagamento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPay(false)
                        setError(null)
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Lançamentos</h2>
      {invoice.transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-600">Sem lançamentos nesta fatura ainda</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-left px-4 py-2">Descrição</th>
                  <th className="text-right px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {invoice.transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-2 tabular-nums text-zinc-600">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      {t.description}
                      {t.category && (
                        <span className="ml-2 text-xs text-zinc-500">
                          · {t.category.name}
                        </span>
                      )}
                      {t.isInvoicePayment && (
                        <span className="ml-2 text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Pagamento
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-semibold ${
                        t.type === 'CREDIT' ? 'text-emerald-700' : 'text-zinc-900'
                      }`}
                    >
                      {t.type === 'CREDIT' ? '+ ' : ''}
                      {formatBRL(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
