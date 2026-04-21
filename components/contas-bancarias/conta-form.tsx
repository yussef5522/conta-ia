'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { TIPOS_CONTA } from '@/lib/validations/conta-bancaria'

const TIPO_LABELS: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Conta Poupança',
  INVESTMENT: 'Conta Investimento',
}

const BANCOS_BR = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '237', name: 'Bradesco' },
  { code: '341', name: 'Itaú' },
  { code: '260', name: 'Nubank' },
  { code: '290', name: 'PagBank' },
  { code: '323', name: 'Mercado Pago' },
  { code: '336', name: 'C6 Bank' },
  { code: '077', name: 'Inter' },
  { code: '000', name: 'Outro' },
]

interface ContaFormProps {
  empresaId: string
  conta?: {
    id: string
    name: string
    bankName: string | null
    bankCode: string | null
    agency: string | null
    accountNumber: string | null
    accountType: string
    balance: number
  }
}

export function ContaForm({ empresaId, conta }: ContaFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!conta

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: conta?.name ?? '',
    bankName: conta?.bankName ?? '',
    bankCode: conta?.bankCode ?? '',
    agency: conta?.agency ?? '',
    accountNumber: conta?.accountNumber ?? '',
    accountType: conta?.accountType ?? 'CHECKING',
    balance: conta?.balance?.toString() ?? '0',
  })

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const url = isEditing ? `/api/contas-bancarias/${conta.id}` : '/api/contas-bancarias'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, balance: parseFloat(form.balance) || 0, empresaId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.campos) { setErrors(data.campos); return }
        toast({ variant: 'destructive', title: 'Erro', description: data.erro })
        return
      }

      toast({ variant: 'success', title: 'Sucesso', description: isEditing ? 'Conta atualizada!' : 'Conta cadastrada!' })
      router.push(`/empresas/${empresaId}/contas`)
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro interno. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome da Conta <span className="text-destructive">*</span></Label>
            <Input id="name" placeholder="Ex: Conta Principal Itaú" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankCode">Banco</Label>
            <Select value={form.bankCode} onValueChange={(v) => {
              const banco = BANCOS_BR.find(b => b.code === v)
              set('bankCode', v)
              if (banco) set('bankName', banco.name)
            }}>
              <SelectTrigger id="bankCode"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
              <SelectContent>
                {BANCOS_BR.map((b) => (
                  <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountType">Tipo de Conta <span className="text-destructive">*</span></Label>
            <Select value={form.accountType} onValueChange={(v) => set('accountType', v)}>
              <SelectTrigger id="accountType"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CONTA.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountType && <p className="text-xs text-destructive">{errors.accountType}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agency">Agência</Label>
            <Input id="agency" placeholder="0001" value={form.agency} onChange={(e) => set('agency', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Número da Conta</Label>
            <Input id="accountNumber" placeholder="12345-6" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Saldo Inicial</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="balance">Saldo atual (R$)</Label>
            <Input id="balance" type="number" step="0.01" placeholder="0,00" value={form.balance} onChange={(e) => set('balance', e.target.value)} />
            <p className="text-xs text-muted-foreground">Informe o saldo atual desta conta para começar o controle.</p>
            {errors.balance && <p className="text-xs text-destructive">{errors.balance}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : isEditing ? 'Atualizar conta' : 'Cadastrar conta'}
        </Button>
      </div>
    </form>
  )
}
