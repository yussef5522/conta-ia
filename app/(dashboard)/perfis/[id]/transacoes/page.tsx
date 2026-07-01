// Sprint PF FATIA 1 — Transações do perfil PF (lista + criar inline).
// Sprint Categorias-PF-Nav (07/06/2026) — botão "Categorias" no header +
// "+ Criar nova categoria" no dropdown com auto-select após criar.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from 'lucide-react'
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
  SelectSeparator,
} from '@/components/ui/select'
import {
  NovaCategoriaPFModal,
  type PersonalCategoryCreated,
} from '@/components/categorias-pf/NovaCategoriaPFModal'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPF } from '@/lib/transacoes/on-create-category'

interface Tx {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  bankAccount: { id: string; name: string } | null
  category: { id: string; name: string; color: string | null } | null
}

interface AccountMini {
  id: string
  name: string
}

interface CategoryMini {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color?: string | null
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('pt-BR')
}

export default function TransacoesPFPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [items, setItems] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [accounts, setAccounts] = useState<AccountMini[]>([])
  const [categories, setCategories] = useState<CategoryMini[]>([])
  // Sprint Categorias-PF-Nav (07/06/2026): modal "+ criar categoria" inline
  const [novaCatOpen, setNovaCatOpen] = useState(false)

  // Form
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'CREDIT' | 'DEBIT'>('DEBIT')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetch(`/api/perfis/${id}/transacoes?pageSize=100`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    fetch(`/api/perfis/${id}/contas`)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
    fetch(`/api/perfis/${id}/categorias`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/perfis/${id}/transacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          description: description.trim(),
          amount: Math.abs(parseFloat(amount)),
          type,
          bankAccountId: bankAccountId || null,
          categoryId: categoryId || null,
          notes: notes.trim() || null,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao criar transação')
        return
      }
      // Sprint Tier1-no-scroll-jump: insere a tx criada no topo do estado
      // local sem reload() da lista inteira (preserva scroll).
      const body = await r.json().catch(() => null)
      const created = body?.transaction as
        | {
            id: string
            date: string
            description: string
            amount: number
            type: 'CREDIT' | 'DEBIT'
          }
        | undefined
      if (created) {
        const acc = accounts.find((a) => a.id === bankAccountId) ?? null
        const cat = categories.find((c) => c.id === categoryId) ?? null
        const newTx: Tx = {
          id: created.id,
          date: created.date,
          description: created.description,
          amount: created.amount,
          type: created.type,
          bankAccount: acc ? { id: acc.id, name: acc.name } : null,
          category: cat ? { id: cat.id, name: cat.name, color: null } : null,
        }
        setItems((prev) => [newTx, ...prev])
      }
      // Reset
      setDescription('')
      setAmount('')
      setNotes('')
      setShowForm(false)
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredCategories = categories.filter(
    (c) => (type === 'CREDIT' && c.type === 'INCOME') || (type === 'DEBIT' && c.type === 'EXPENSE'),
  )

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
          <h1 className="text-2xl font-bold text-zinc-900">Transações</h1>
          <p className="text-sm text-zinc-600">
            Lance suas entradas e saídas pessoais
          </p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-2">
            {/* Sprint Categorias-PF-Nav: atalho pra gerenciar categorias do
                perfil (separadas das categorias da empresa). */}
            <Button asChild variant="outline">
              <Link href={`/perfis/${id}/categorias`}>
                <FileText className="h-4 w-4 mr-1" />
                Categorias
              </Link>
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova transação
            </Button>
          </div>
        )}
      </div>

      {showForm && (
        <Card className="mb-4 border-emerald-200">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'CREDIT' | 'DEBIT')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">Saída (despesa)</SelectItem>
                    <SelectItem value="CREDIT">Entrada (receita)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 tabular-nums"
                  placeholder="0,00"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="desc">Descrição *</Label>
                <Input
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  maxLength={200}
                  className="mt-1"
                  placeholder='Ex: "Salário", "Supermercado Extra", "Luz"'
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

              <div>
                <Label>Conta</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label>Categoria</Label>
                {/* Sprint Category-Combobox PF Batch (30/06/2026): trocado
                    Select shadcn por CategoryCombobox (unificação PJ+PF).
                    onCreate liga em createCategoryForPF que deriva type do
                    contexto (CREDIT→INCOME, DEBIT→EXPENSE). NovaCategoriaPFModal
                    continua disponível como fallback pro fluxo antigo (linha 426). */}
                <CategoryCombobox
                  value={categoryId || null}
                  categorias={filteredCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color ?? null,
                    type: c.type,
                    dreGroup: null,
                  }))}
                  onChange={(v) => setCategoryId(v ?? '')}
                  onCreate={async (name) => {
                    const cat = await createCategoryForPF(
                      id,
                      name,
                      type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
                    )
                    if (cat) setCategories((prev) => [...prev, {
                      id: cat.id,
                      name: cat.name,
                      type: (cat.type as 'INCOME' | 'EXPENSE') ?? (type === 'CREDIT' ? 'INCOME' : 'EXPENSE'),
                      color: cat.color ?? null,
                    }])
                    return cat
                  }}
                  placeholder="Selecione (opcional)"
                  className="mt-1 h-9 w-full justify-between border-input"
                  ariaLabel="Categoria da transação"
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

              {error && (
                <div className="sm:col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="sm:col-span-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting || !description.trim() || !amount}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Lançar
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
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-600">
              Nenhuma transação ainda. Clique em "Nova transação" pra começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-left px-4 py-2">Descrição</th>
                  <th className="text-left px-4 py-2 hidden sm:table-cell">Categoria</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Conta</th>
                  <th className="text-right px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-2 text-sm tabular-nums text-zinc-600">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-900">{t.description}</td>
                    <td className="px-4 py-2 text-sm text-zinc-600 hidden sm:table-cell">
                      {t.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-600 hidden md:table-cell">
                      {t.bankAccount?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div
                        className={`inline-flex items-center gap-1 font-semibold tabular-nums text-sm ${
                          t.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {t.type === 'CREDIT' ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {formatBRL(t.amount)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Sprint Categorias-PF-Nav (07/06/2026): modal "+ criar nova categoria"
          inline. Pré-seleciona o tipo conforme o que está sendo lançado
          (despesa OU receita). Após criar, a categoria já vem SELECIONADA
          no dropdown sem o user sair da tela. */}
      <NovaCategoriaPFModal
        open={novaCatOpen}
        profileId={id}
        defaultType={type === 'CREDIT' ? 'INCOME' : 'EXPENSE'}
        onClose={() => setNovaCatOpen(false)}
        onCreated={(cat: PersonalCategoryCreated) => {
          // 1. Insere no estado local sem refetch
          setCategories((prev) => [
            ...prev,
            { id: cat.id, name: cat.name, type: cat.type },
          ])
          // 2. Auto-select da categoria criada no dropdown
          setCategoryId(cat.id)
        }}
      />
    </div>
  )
}
