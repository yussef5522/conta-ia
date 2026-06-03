// Sprint PF Fatia 2 — Novo cartão.

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, CreditCard as CardIcon } from 'lucide-react'
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

export default function NovoCartaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountMini[]>([])

  const [name, setName] = useState('')
  const [bankName, setBankName] = useState('')
  const [brand, setBrand] = useState<string>('')
  const [lastDigits, setLastDigits] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [closingDay, setClosingDay] = useState('5')
  const [dueDay, setDueDay] = useState('12')
  const [closingDayRule, setClosingDayRule] = useState<'ATUAL' | 'PROXIMA'>('ATUAL')
  const [defaultPaymentAccountId, setDefaultPaymentAccountId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/perfis/${id}/contas`)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/perfis/${id}/cartoes`, {
        method: 'POST',
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
        setError(d.erro ?? 'Falha ao criar cartão')
        return
      }
      const data = await r.json()
      router.push(`/perfis/${id}/cartoes/${data.card.id}`)
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/perfis/${id}/cartoes`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <CardIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Novo cartão de crédito</h1>
          <p className="text-sm text-zinc-600">Limite, fechamento, vencimento</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Apelido *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
                placeholder='Ex: "Nubank Roxinho"'
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="bank">Banco</Label>
              <Input
                id="bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Nubank, Itaú, Bradesco…"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Bandeira (opcional)</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
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
              <Label htmlFor="last">Últimos 4 dígitos (opcional)</Label>
              <Input
                id="last"
                value={lastDigits}
                onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                inputMode="numeric"
                placeholder="0000"
                className="mt-1 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="limit">Limite *</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                min="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                required
                placeholder="0,00"
                className="mt-1 tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="closing">Dia do fechamento *</Label>
              <Input
                id="closing"
                type="number"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                required
                className="mt-1 tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="due">Dia do vencimento *</Label>
              <Input
                id="due"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                required
                className="mt-1 tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Regra do dia do fechamento</Label>
              <Select value={closingDayRule} onValueChange={(v) => setClosingDayRule(v as 'ATUAL' | 'PROXIMA')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATUAL">Compra no dia do fechamento → fatura atual (Nubank/Itaú padrão)</SelectItem>
                  <SelectItem value="PROXIMA">Compra no dia do fechamento → próxima fatura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>Conta padrão pra pagar a fatura (opcional)</Label>
              <Select value={defaultPaymentAccountId} onValueChange={setDefaultPaymentAccountId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar a cada pagamento" />
                </SelectTrigger>
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
                disabled={submitting || !name.trim() || !creditLimit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar cartão
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/perfis/${id}/cartoes`}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
