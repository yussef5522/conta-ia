'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { useToast } from '@/components/ui/use-toast'

interface Category { id: string; name: string; color: string; type: string; dreGroup?: string | null }

interface TransacaoFormProps {
  contaId: string
  empresaId: string
  categories: Category[]
  transacao?: {
    id: string
    description: string
    amount: number
    type: string
    date: string
    categoryId?: string | null
    notes?: string | null
    status: string
  }
}

export function TransacaoForm({ contaId, empresaId, categories, transacao }: TransacaoFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!transacao

  const today = new Date().toISOString().split('T')[0]

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    description: transacao?.description ?? '',
    amount: transacao?.amount?.toString() ?? '',
    type: transacao?.type ?? 'DEBIT',
    date: transacao?.date ? transacao.date.split('T')[0] : today,
    categoryId: transacao?.categoryId ?? '',
    notes: transacao?.notes ?? '',
    status: transacao?.status ?? 'PENDING',
  })

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }))
  }

  const catsFiltradas = categories.filter((c) => {
    if (form.type === 'CREDIT') return c.type === 'INCOME' || c.type === 'TRANSFER'
    if (form.type === 'DEBIT') return c.type === 'EXPENSE' || c.type === 'TRANSFER'
    return true
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const url = isEditing ? `/api/transacoes/${transacao.id}` : '/api/transacoes'
      const method = isEditing ? 'PUT' : 'POST'

      const body = {
        ...(!isEditing ? { bankAccountId: contaId } : {}),
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        type: form.type,
        date: new Date(form.date).toISOString(),
        categoryId: form.categoryId || null,
        notes: form.notes || null,
        status: form.status,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.campos) { setErrors(data.campos); return }
        toast({ variant: 'destructive', title: 'Erro', description: data.erro })
        return
      }

      toast({ variant: 'success', title: 'Sucesso', description: isEditing ? 'Transação atualizada!' : 'Transação lançada!' })
      router.push(`/empresas/${empresaId}/contas/${contaId}/transacoes`)
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
        <CardHeader><CardTitle className="text-base">Dados do Lançamento</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              {(['CREDIT', 'DEBIT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { set('type', t); set('categoryId', '') }}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    form.type === t
                      ? t === 'CREDIT'
                        ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300'
                        : 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300'
                      : 'border-input bg-background hover:bg-muted'
                  }`}
                >
                  {t === 'CREDIT' ? '+ Entrada' : '− Saída'}
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="date">Data <span className="text-destructive">*</span></Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          {/* Descrição */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição <span className="text-destructive">*</span></Label>
            <Input id="description" placeholder="Ex: Pagamento de fornecedor" value={form.description} onChange={(e) => set('description', e.target.value)} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) <span className="text-destructive">*</span></Label>
            <Input id="amount" type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Categoria — Sprint Category-Combobox (29/06/2026):
              CategoryCombobox único. Busca sem acento, agrupado dreGroup, teclado. */}
          <div className="space-y-2">
            <Label htmlFor="categoryId">Categoria</Label>
            <CategoryCombobox
              value={form.categoryId || null}
              categorias={catsFiltradas.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
                dreGroup: c.dreGroup ?? null,
              }))}
              onChange={(v) => set('categoryId', v ?? '')}
              placeholder="Sem categoria"
              ariaLabel="Categoria da transação"
              className="h-9 w-full justify-between border-input"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="RECONCILED">Conciliado</SelectItem>
                <SelectItem value="IGNORED">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" placeholder="Informações adicionais..." rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Lançar transação'}
        </Button>
      </div>
    </form>
  )
}
