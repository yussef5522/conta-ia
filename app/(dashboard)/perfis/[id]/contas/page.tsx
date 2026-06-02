// Sprint PF FATIA 1 — Contas bancárias do perfil PF (lista + criar inline).

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Loader2, Building2, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Account {
  id: string
  name: string
  bankName: string | null
  accountType: string
  balance: number
  allowNegativeBalance: boolean
  creditLimit: number
  isActive: boolean
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

export default function ContasPFPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountType, setAccountType] = useState('CHECKING')
  const [balance, setBalance] = useState('0')
  const [allowNeg, setAllowNeg] = useState(true)
  const [creditLimit, setCreditLimit] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetch(`/api/perfis/${id}/contas`)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/perfis/${id}/contas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bankName: bankName.trim() || null,
          accountType,
          balance: parseFloat(balance) || 0,
          allowNegativeBalance: allowNeg,
          creditLimit: parseFloat(creditLimit) || 0,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao criar conta')
        return
      }
      // Reset form
      setName('')
      setBankName('')
      setBalance('0')
      setCreditLimit('0')
      setShowForm(false)
      reload()
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao perfil
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Contas bancárias</h1>
          <p className="text-sm text-zinc-600">Conta corrente, poupança, carteira digital</p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova conta
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-4 border-emerald-200">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="acc-name">Nome da conta *</Label>
                <Input
                  id="acc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Ex: "Itaú pessoal", "Nubank"'
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bank">Banco</Label>
                <Input
                  id="bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder='Ex: "Itaú", "Nubank"'
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Tipo *</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">Conta corrente</SelectItem>
                    <SelectItem value="SAVINGS">Poupança</SelectItem>
                    <SelectItem value="DIGITAL_WALLET">Carteira digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="balance">Saldo atual</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="mt-1 tabular-nums"
                />
              </div>

              <div>
                <Label htmlFor="limit">Limite cheque especial</Label>
                <Input
                  id="limit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="mt-1 tabular-nums"
                  disabled={!allowNeg}
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <Checkbox
                  id="neg"
                  checked={allowNeg}
                  onCheckedChange={(v) => setAllowNeg(v === true)}
                />
                <Label htmlFor="neg" className="font-normal cursor-pointer">
                  Permitir saldo negativo (cheque especial)
                </Label>
              </div>

              {error && (
                <div className="sm:col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="sm:col-span-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar conta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setError(null)
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Wallet className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-600">
              Adicione sua primeira conta pra começar a lançar transações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-900 truncate">
                        {a.name}
                      </h3>
                      {a.bankName && (
                        <p className="text-xs text-zinc-500 truncate">{a.bankName}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-xl font-bold tabular-nums mt-2 ${
                    a.balance >= 0 ? 'text-zinc-900' : 'text-red-700'
                  }`}
                >
                  {formatBRL(a.balance)}
                </div>
                {a.allowNegativeBalance && a.creditLimit > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Cheque especial: {formatBRL(a.creditLimit)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
