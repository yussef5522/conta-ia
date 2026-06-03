// Sprint PF Fatia 2 — Editar cartão.

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
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

interface AccountMini {
  id: string
  name: string
}

export default function EditarCartaoPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>
}) {
  const { id, cardId } = use(params)
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountMini[]>([])

  const [name, setName] = useState('')
  const [bankName, setBankName] = useState('')
  const [brand, setBrand] = useState('')
  const [lastDigits, setLastDigits] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [closingDayRule, setClosingDayRule] = useState<'ATUAL' | 'PROXIMA'>('ATUAL')
  const [defaultPaymentAccountId, setDefaultPaymentAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/perfis/${id}/cartoes/${cardId}`).then((r) => r.json()),
      fetch(`/api/perfis/${id}/contas`).then((r) => r.json()),
    ]).then(([cardData, accData]) => {
      if (cardData.card) {
        const c = cardData.card
        setName(c.name)
        setBankName(c.bankName ?? '')
        setBrand(c.brand ?? '')
        setLastDigits(c.lastDigits ?? '')
        setCreditLimit(String(c.creditLimit))
        setClosingDay(String(c.closingDay))
        setDueDay(String(c.dueDay))
        setClosingDayRule(c.closingDayRule)
        setDefaultPaymentAccountId(c.defaultPaymentAccountId ?? '')
      }
      setAccounts(accData.accounts ?? [])
      setLoading(false)
    })
  }, [id, cardId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/perfis/${id}/cartoes/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bankName: bankName.trim() || null,
          brand: brand || null,
          lastDigits: lastDigits.trim() || null,
          creditLimit: parseFloat(creditLimit),
          closingDay: parseInt(closingDay, 10),
          dueDay: parseInt(dueDay, 10),
          closingDayRule,
          defaultPaymentAccountId: defaultPaymentAccountId || null,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao salvar')
        return
      }
      router.push(`/perfis/${id}/cartoes/${cardId}`)
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Desativar este cartão? Tx e faturas ficam preservadas (soft delete).')) return
    await fetch(`/api/perfis/${id}/cartoes/${cardId}`, { method: 'DELETE' })
    router.push(`/perfis/${id}/cartoes`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/perfis/${id}/cartoes/${cardId}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-4">Editar cartão</h1>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Apelido *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Bandeira</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VISA">Visa</SelectItem>
                  <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                  <SelectItem value="ELO">Elo</SelectItem>
                  <SelectItem value="AMEX">Amex</SelectItem>
                  <SelectItem value="HIPERCARD">Hipercard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Últimos 4</Label>
              <Input value={lastDigits} onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Limite *</Label>
              <Input type="number" step="0.01" min="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} required className="mt-1 tabular-nums" />
            </div>
            <div>
              <Label>Fechamento *</Label>
              <Input type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} required className="mt-1 tabular-nums" />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} required className="mt-1 tabular-nums" />
            </div>
            <div className="sm:col-span-2">
              <Label>Regra dia do fechamento</Label>
              <Select value={closingDayRule} onValueChange={(v) => setClosingDayRule(v as 'ATUAL' | 'PROXIMA')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATUAL">Atual</SelectItem>
                  <SelectItem value="PROXIMA">Próxima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Conta padrão de pagamento</Label>
              <Select value={defaultPaymentAccountId} onValueChange={setDefaultPaymentAccountId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="sm:col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="sm:col-span-2 flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={handleDelete} className="text-red-700 border-red-200 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-1" />
                Desativar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
