// Sprint Cartao Credito PJ — form de criar cartao

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'

interface BankAccountOption {
  id: string
  name: string
}

export default function NovoCartaoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    bankName: '',
    brand: '',
    lastDigits: '',
    creditLimit: '',
    closingDay: '',
    dueDay: '',
    closingDayRule: 'ATUAL' as 'ATUAL' | 'PROXIMA',
    defaultPaymentBankAccountId: '',
  })

  useEffect(() => {
    fetch(`/api/contas-bancarias?empresaId=${params.id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const accs: BankAccountOption[] = Array.isArray(d?.contas)
          ? d.contas.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
          : []
        setBankAccounts(accs)
      })
      .catch(() => {})
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/cartoes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          bankName: form.bankName.trim() || null,
          brand: form.brand.trim() || null,
          lastDigits: form.lastDigits.trim() || null,
          creditLimit: parseFloat(form.creditLimit.replace(',', '.')) || 0,
          closingDay: parseInt(form.closingDay, 10),
          dueDay: parseInt(form.dueDay, 10),
          closingDayRule: form.closingDayRule,
          defaultPaymentBankAccountId: form.defaultPaymentBankAccountId || null,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        toast({
          title: 'Erro',
          description: json.erro || 'Tente novamente',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Cartão criado' })
      router.push(`/empresas/${params.id}/cartoes/${json.card.id}`)
    } catch (err) {
      toast({
        title: 'Erro de rede',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Novo cartão" description="Cadastre o cartão pra importar fatura PDF + categorizar compras">
        <Link
          href={`/empresas/${params.id}/cartoes`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Dados do cartão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Nome do cartão *</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ex: Caixa Mastercard 3883"
                />
              </div>
              <div>
                <Label htmlFor="bankName">Banco emissor</Label>
                <Input
                  id="bankName"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="Caixa, Banrisul, Sicredi…"
                />
              </div>
              <div>
                <Label htmlFor="brand">Bandeira</Label>
                <select
                  id="brand"
                  className="w-full h-10 border rounded-md px-3 text-sm"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="VISA">Visa</option>
                  <option value="MASTERCARD">Mastercard</option>
                  <option value="ELO">Elo</option>
                  <option value="AMEX">American Express</option>
                  <option value="HIPERCARD">Hipercard</option>
                </select>
              </div>
              <div>
                <Label htmlFor="lastDigits">Últimos 4 dígitos</Label>
                <Input
                  id="lastDigits"
                  value={form.lastDigits}
                  onChange={(e) =>
                    setForm({ ...form, lastDigits: e.target.value.replace(/\D/g, '').slice(0, 6) })
                  }
                  placeholder="3883"
                />
              </div>
              <div>
                <Label htmlFor="creditLimit">Limite total (R$) *</Label>
                <Input
                  id="creditLimit"
                  required
                  type="number"
                  step="any"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  placeholder="8000"
                />
              </div>
              <div>
                <Label htmlFor="closingDay">Dia do fechamento *</Label>
                <Input
                  id="closingDay"
                  required
                  type="number"
                  min="1"
                  max="31"
                  value={form.closingDay}
                  onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div>
                <Label htmlFor="dueDay">Dia do vencimento *</Label>
                <Input
                  id="dueDay"
                  required
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                  placeholder="10"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="defaultPaymentBankAccountId">Conta que paga a fatura (opcional)</Label>
                <select
                  id="defaultPaymentBankAccountId"
                  className="w-full h-10 border rounded-md px-3 text-sm"
                  value={form.defaultPaymentBankAccountId}
                  onChange={(e) => setForm({ ...form, defaultPaymentBankAccountId: e.target.value })}
                >
                  <option value="">— Escolho na hora —</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Definir aqui faz o sistema sugerir reclassificar pagamentos dessa conta como
                  transferência ao importar fatura.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link href={`/empresas/${params.id}/cartoes`}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="submit" disabled={saving || !form.name || !form.creditLimit || !form.closingDay || !form.dueDay}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Criar cartão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
