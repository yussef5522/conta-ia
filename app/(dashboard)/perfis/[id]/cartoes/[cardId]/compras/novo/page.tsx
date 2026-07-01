// Sprint PF Fatia 2 — Nova compra (à vista ou parcelada com preview).

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InstallmentPreview } from '@/components/credit-card/installment-preview'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPF } from '@/lib/transacoes/on-create-category'

interface CategoryMini {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color?: string | null
}

const MAX_INSTALLMENTS = 24

export default function NovaCompraPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>
}) {
  const { id, cardId } = use(params)
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryMini[]>([])

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [installments, setInstallments] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/perfis/${id}/categorias`)
      .then((r) => r.json())
      .then((d) => setCategories((d.categories ?? []).filter((c: CategoryMini) => c.type === 'EXPENSE')))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/perfis/${id}/cartoes/${cardId}/compras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          description: description.trim(),
          totalAmount: parseFloat(totalAmount),
          installments: parseInt(installments, 10),
          categoryId: categoryId || null,
          notes: notes.trim() || null,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao criar compra')
        return
      }
      router.push(`/perfis/${id}/cartoes/${cardId}`)
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  const totalNum = parseFloat(totalAmount) || 0
  const instNum = parseInt(installments, 10) || 1

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/perfis/${id}/cartoes/${cardId}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-4">Nova compra no cartão</h1>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="desc">Descrição *</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={200}
                placeholder='Ex: "Mercado Pão de Açúcar"'
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="amount">Valor total *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                placeholder="0,00"
                className="mt-1 tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="installments">Parcelas (1 a {MAX_INSTALLMENTS})</Label>
              <Input
                id="installments"
                type="number"
                min="1"
                max={MAX_INSTALLMENTS}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="mt-1 tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Categoria (opcional)</Label>
              {/* Sprint Category-Combobox PF Batch (30/06/2026): unificação. */}
              <CategoryCombobox
                value={categoryId || null}
                categorias={categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  color: c.color ?? null,
                  type: c.type,
                  dreGroup: null,
                }))}
                onChange={(v) => setCategoryId(v ?? '')}
                onCreate={async (name) => {
                  // Compra no cartão = despesa (EXPENSE).
                  const cat = await createCategoryForPF(id, name, 'EXPENSE')
                  if (cat) setCategories((prev) => [...prev, {
                    id: cat.id,
                    name: cat.name,
                    type: 'EXPENSE',
                    color: cat.color ?? null,
                  }])
                  return cat
                }}
                placeholder="—"
                className="mt-1 h-9 w-full justify-between border-input"
                ariaLabel="Categoria da compra"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="notes">Observação</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Preview de parcelas */}
            {totalNum > 0 && instNum >= 1 && (
              <div className="sm:col-span-2">
                <InstallmentPreview
                  profileId={id}
                  cardId={cardId}
                  date={date}
                  totalAmount={totalNum}
                  installments={instNum}
                />
              </div>
            )}

            {error && (
              <div className="sm:col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="sm:col-span-2 flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting || !description.trim() || !totalAmount}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Lançar compra
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/perfis/${id}/cartoes/${cardId}`}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
