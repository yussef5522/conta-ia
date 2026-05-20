'use client'

// UI de fornecedores (Supplier) — Sprint 2.2 Onda 2.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Store,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  formatCNPJ,
  fonteLabel,
  fonteColor,
  isValidCNPJ,
  unformatCNPJ,
} from '@/lib/fornecedores/format'

interface Categoria {
  id: string
  name: string
  type: string | null
  dreGroup: string | null
  color: string | null
}

interface Fornecedor {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string | null
  cnaePrincipal: string | null
  fonte: string
  isActive: boolean
  notes: string | null
  createdAt: string
  category: { id: string; name: string; color: string | null } | null
  transacoesCount: number
}

interface Stats {
  totalAtivos: number
  porFonte: Record<string, number>
  topPorValor: Array<{ supplierId: string | null; nome: string; total: number }>
}

interface ListResponse {
  items: Fornecedor[]
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
  stats: Stats
}

interface Props {
  empresaId: string
  empresaNome: string
  categorias: Categoria[]
}

export function FornecedoresClient({
  empresaId,
  empresaNome,
  categorias,
}: Props) {
  const { toast } = useToast()

  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [fonte, setFonte] = useState('ALL')
  const [categoryId, setCategoryId] = useState('ALL')
  const [comCnpj, setComCnpj] = useState('all')

  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<Fornecedor | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Fornecedor | null>(null)

  const fetchData = useCallback(
    async (resetPage = false) => {
      setLoading(true)
      const nextPage = resetPage ? 1 : page
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: '10',
          fonte,
          comCnpj,
        })
        if (q.trim()) params.set('q', q.trim())
        if (categoryId !== 'ALL') params.set('categoryId', categoryId)
        const res = await fetch(
          `/api/empresas/${empresaId}/fornecedores?${params.toString()}`,
        )
        const json = await res.json()
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: json.erro ?? 'Falha ao carregar.',
          })
          return
        }
        setData(json)
        if (resetPage) setPage(1)
      } finally {
        setLoading(false)
      }
    },
    [empresaId, page, q, fonte, categoryId, comCnpj, toast],
  )

  useEffect(() => {
    void fetchData(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    void fetchData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonte, categoryId, comCnpj])

  async function deleteSupplier(s: Fornecedor) {
    const res = await fetch(
      `/api/empresas/${empresaId}/fornecedores/${s.id}`,
      { method: 'DELETE' },
    )
    const json = await res.json()
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: json.erro ?? 'Falha.',
      })
      return
    }
    toast({
      title: 'Fornecedor removido',
      description: s.razaoSocial,
    })
    setConfirmDelete(null)
    void fetchData(false)
  }

  const items = data?.items ?? []
  const pagination = data?.pagination
  const stats = data?.stats

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {empresaNome}
          </p>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quem recebe pagamentos — detectado por CNPJ, IA ou cadastro manual.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total ativos"
          value={stats?.totalAtivos ?? 0}
          hint="cadastrados na empresa"
        />
        <StatCard
          label="BrasilAPI"
          value={stats?.porFonte.BRASILAPI ?? 0}
          hint="detectados via CNPJ"
        />
        <StatCard
          label="Manuais"
          value={stats?.porFonte.MANUAL ?? 0}
          hint="cadastro humano"
        />
        <StatCard
          label="Top fornecedor"
          value={
            stats?.topPorValor[0]
              ? stats.topPorValor[0].total.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })
              : '—'
          }
          hint={stats?.topPorValor[0]?.nome ?? 'últimos 6 meses'}
        />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Buscar (nome ou CNPJ)</Label>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void fetchData(true)
            }}
            className="relative"
          >
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ex: petrobras ou 33.000.167"
              className="pl-7 h-9 text-sm"
            />
          </form>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Origem</Label>
          <Select value={fonte} onValueChange={setFonte}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="BRASILAPI">BrasilAPI</SelectItem>
              <SelectItem value="CLAUDE">IA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tem CNPJ?</Label>
          <Select value={comCnpj} onValueChange={setComCnpj}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Com CNPJ</SelectItem>
              <SelectItem value="false">Sem CNPJ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border bg-card">
        {loading && !data ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum fornecedor encontrado. Importe OFX ou{' '}
            <button
              onClick={() => setCreating(true)}
              className="underline text-primary"
            >
              cadastre manualmente
            </button>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">CNPJ</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-right px-3 py-2 tabular-nums">Tx</th>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const fc = fonteColor(s.fonte)
                return (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {s.nomeFantasia ?? s.razaoSocial}
                      </p>
                      {s.nomeFantasia && (
                        <p className="text-[10px] text-muted-foreground">
                          {s.razaoSocial}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {s.cnpj ? formatCNPJ(s.cnpj) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.category ? (
                        <span className="inline-flex items-center gap-1">
                          {s.category.color && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: s.category.color }}
                            />
                          )}
                          {s.category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <button
                        onClick={() => setViewing(s)}
                        className="text-xs text-primary hover:underline"
                      >
                        {s.transacoesCount}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${fc.bg} ${fc.text}`}
                      >
                        {fonteLabel(s.fonte)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          aria-label="Ver transações"
                          onClick={() => setViewing(s)}
                          className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label="Editar"
                          onClick={() => setEditing(s)}
                          className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label="Deletar"
                          onClick={() => setConfirmDelete(s)}
                          className="h-7 w-7 rounded hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
            <span>
              Página {pagination.page} de {pagination.totalPages} ·{' '}
              {pagination.total} fornecedor{pagination.total === 1 ? '' : 'es'}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <FornecedorFormModal
          empresaId={empresaId}
          fornecedor={null}
          categorias={categorias}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            void fetchData(true)
          }}
        />
      )}

      {editing && (
        <FornecedorFormModal
          empresaId={empresaId}
          fornecedor={editing}
          categorias={categorias}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void fetchData(false)
          }}
        />
      )}

      {viewing && (
        <TransacoesModal
          empresaId={empresaId}
          fornecedor={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
          title="Deletar fornecedor?"
          description={
            <div className="space-y-2 text-sm">
              <p>
                <strong>{confirmDelete.razaoSocial}</strong> tem{' '}
                <strong>{confirmDelete.transacoesCount}</strong> transações
                vinculadas. Elas ficam intactas — o vínculo com o fornecedor é
                desfeito.
              </p>
              <p className="text-xs text-muted-foreground">
                Regras associadas ficam ativas mas sem fornecedor.
              </p>
            </div>
          }
          confirmLabel="Deletar"
          variant="destructive"
          onConfirm={async () => {
            await deleteSupplier(confirmDelete)
          }}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>
    </div>
  )
}

// ============================================================
// Form modal (create + edit)
// ============================================================

function FornecedorFormModal({
  empresaId,
  fornecedor,
  categorias,
  onClose,
  onSaved,
}: {
  empresaId: string
  fornecedor: Fornecedor | null
  categorias: Categoria[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const isEdit = !!fornecedor
  const [razaoSocial, setRazaoSocial] = useState(
    fornecedor?.razaoSocial ?? '',
  )
  const [nomeFantasia, setNomeFantasia] = useState(
    fornecedor?.nomeFantasia ?? '',
  )
  const [cnpjInput, setCnpjInput] = useState(
    fornecedor?.cnpj ? formatCNPJ(fornecedor.cnpj) : '',
  )
  const [categoryId, setCategoryId] = useState(
    fornecedor?.category?.id ?? '',
  )
  const [notes, setNotes] = useState(fornecedor?.notes ?? '')
  const [aplicarEmRegras, setAplicarEmRegras] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cnpjErr, setCnpjErr] = useState<string | null>(null)

  function validate(): boolean {
    setCnpjErr(null)
    if (razaoSocial.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Razão social muito curta.',
      })
      return false
    }
    if (cnpjInput.trim()) {
      const digits = unformatCNPJ(cnpjInput)
      if (!isValidCNPJ(digits)) {
        setCnpjErr('CNPJ inválido')
        return false
      }
    }
    return true
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || null,
        cnpj: cnpjInput.trim() ? unformatCNPJ(cnpjInput) : null,
        categoryId: categoryId || null,
        notes: notes.trim() || null,
      }
      if (isEdit && aplicarEmRegras) {
        payload.aplicarEmRegras = true
      }

      const url = isEdit
        ? `/api/empresas/${empresaId}/fornecedores/${fornecedor!.id}`
        : `/api/empresas/${empresaId}/fornecedores`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: json.erro ?? 'Falha ao salvar.',
        })
        return
      }
      const regras = json.regrasAtualizadas
      toast({
        title: isEdit ? 'Fornecedor atualizado' : 'Fornecedor cadastrado',
        description:
          regras && regras > 0
            ? `${razaoSocial} (${regras} regra${regras === 1 ? '' : 's'} atualizada${regras === 1 ? '' : 's'})`
            : razaoSocial,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}
          </DialogTitle>
          {fornecedor?.fonte === 'BRASILAPI' && (
            <DialogDescription>
              Detectado via BrasilAPI. Você pode editar livremente.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Razão social <span className="text-destructive">*</span>
            </Label>
            <Input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="ex: PETROBRAS DISTRIBUIDORA S.A."
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome fantasia</Label>
            <Input
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="ex: BR Distribuidora"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">CNPJ</Label>
            <Input
              value={cnpjInput}
              onChange={(e) => {
                setCnpjInput(e.target.value)
                setCnpjErr(null)
              }}
              placeholder="00.000.000/0000-00"
              className="font-mono"
            />
            {cnpjErr && (
              <p className="text-xs text-destructive">{cnpjErr}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria padrão</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEdit && categoryId !== (fornecedor?.category?.id ?? '') && (
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={aplicarEmRegras}
                onChange={(e) => setAplicarEmRegras(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Aplicar nova categoria nas regras associadas a esse fornecedor
                (futuras transações serão classificadas com essa categoria).
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="(opcional)"
              maxLength={1000}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving
              ? 'Salvando...'
              : isEdit
                ? 'Salvar alterações'
                : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal "Ver transações"
// ============================================================

interface TransacoesData {
  supplier: { id: string; razaoSocial: string; cnpj: string | null }
  transacoes: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: string
    status: string
    bankAccount: { id: string; bankName: string; accountNumber: string | null }
    category: { id: string; name: string } | null
  }>
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
  stats: { total: number; media: number; primeira: string | null; ultima: string | null }
}

function TransacoesModal({
  empresaId,
  fornecedor,
  onClose,
}: {
  empresaId: string
  fornecedor: Fornecedor
  onClose: () => void
}) {
  const [data, setData] = useState<TransacoesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    fetch(
      `/api/empresas/${empresaId}/fornecedores/${fornecedor.id}/transacoes?page=${page}`,
    )
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false))
  }, [empresaId, fornecedor.id, page])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fornecedor.razaoSocial}</DialogTitle>
          {fornecedor.cnpj && (
            <DialogDescription className="font-mono">
              {formatCNPJ(fornecedor.cnpj)}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="Tx" value={String(data.pagination.total)} />
              <Stat
                label="Total"
                value={data.stats.total.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              />
              <Stat
                label="Média"
                value={data.stats.media.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              />
              <Stat
                label="Última"
                value={
                  data.stats.ultima
                    ? new Date(data.stats.ultima).toLocaleDateString('pt-BR')
                    : '—'
                }
              />
            </div>

            <div className="border rounded-md mt-3 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-2 py-1.5">Data</th>
                    <th className="text-left px-2 py-1.5">Descrição</th>
                    <th className="text-left px-2 py-1.5">Categoria</th>
                    <th className="text-right px-2 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transacoes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-muted-foreground py-6"
                      >
                        Sem transações
                      </td>
                    </tr>
                  ) : (
                    data.transacoes.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-2 py-1.5 tabular-nums">
                          {new Date(t.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[260px]">
                          {t.description}
                        </td>
                        <td className="px-2 py-1.5">
                          {t.category?.name ?? '—'}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right tabular-nums font-mono ${t.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                        >
                          {t.type === 'CREDIT' ? '+' : '−'}
                          {t.amount.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">
                  Página {data.pagination.page} de {data.pagination.totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Link
                href={`/empresas/${empresaId}/pendentes?supplierId=${fornecedor.id}`}
                className="text-xs text-primary hover:underline"
              >
                Abrir página /pendentes filtrada →
              </Link>
            </DialogFooter>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Erro ao carregar.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  )
}
