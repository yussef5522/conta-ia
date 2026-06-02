// Sprint PF FATIA 1 — Categorias do perfil PF.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
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

interface Category {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color: string | null
  icon: string | null
  isDefault: boolean
  isActive: boolean
}

export default function CategoriasPFPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [color, setColor] = useState('#10b981')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetch(`/api/perfis/${id}/categorias`)
      .then((r) => r.json())
      .then((d) => setItems(d.categories ?? []))
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
      const r = await fetch(`/api/perfis/${id}/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          color,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao criar categoria')
        return
      }
      setName('')
      setShowForm(false)
      reload()
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  const incomes = items.filter((c) => c.type === 'INCOME')
  const expenses = items.filter((c) => c.type === 'EXPENSE')

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
          <h1 className="text-2xl font-bold text-zinc-900">Categorias</h1>
          <p className="text-sm text-zinc-600">
            Plano de contas pessoal — 15 categorias padrão + suas customizadas
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova categoria
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-4 border-emerald-200">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="cat-name">Nome *</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  className="mt-1"
                  placeholder='Ex: "Pet", "Streaming"'
                />
              </div>

              <div>
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'INCOME' | 'EXPENSE')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                    <SelectItem value="INCOME">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="color">Cor</Label>
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="mt-1 h-9 w-full"
                />
              </div>

              {error && (
                <div className="sm:col-span-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="sm:col-span-3 flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar
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
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-emerald-700 text-sm mb-3 uppercase tracking-wide">
                Receitas ({incomes.length})
              </h2>
              <div className="space-y-1.5">
                {incomes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 py-1.5 border-b last:border-0"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? '#10b981' }}
                    />
                    <span className="text-sm flex-1">{c.name}</span>
                    {c.isDefault && (
                      <span className="text-[9px] uppercase font-semibold text-zinc-400">
                        Padrão
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-red-700 text-sm mb-3 uppercase tracking-wide">
                Despesas ({expenses.length})
              </h2>
              <div className="space-y-1.5">
                {expenses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 py-1.5 border-b last:border-0"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? '#ef4444' }}
                    />
                    <span className="text-sm flex-1">{c.name}</span>
                    {c.isDefault && (
                      <span className="text-[9px] uppercase font-semibold text-zinc-400">
                        Padrão
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
