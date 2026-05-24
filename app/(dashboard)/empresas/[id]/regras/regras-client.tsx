'use client'

// UI de regras aprendidas — Sprint 2.1 Onda 2.
// Lista paginada + filtros + stats + edit/pause/delete inline.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Brain,
  Sparkles,
  Pencil,
  Pause,
  Play,
  Trash2,
  Loader2,
  Search,
} from 'lucide-react'
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
  matchTypeLabel,
  matchTypeColor,
  confidenceLabel,
  confidencePercent,
  confidenceColors,
  fonteLabel,
} from '@/lib/regras/format'

interface Categoria {
  id: string
  name: string
  type: string | null
  dreGroup: string | null
  color: string | null
}

interface Regra {
  id: string
  padrao: string
  tipoMatch: string
  confianca: number
  vezesAplicada: number
  isActive: boolean
  fonte: string
  createdAt: string
  updatedAt: string
  category: { id: string; name: string; dreGroup: string | null; color: string | null } | null
  supplier: { id: string; razaoSocial: string } | null
}

interface Stats {
  totalAtivas: number
  confiancaMedia: number
  topRules: Array<{ id: string; padrao: string; vezesAplicada: number; tipoMatch: string }>
  ultimaRegra: { padrao: string; createdAt: string } | null
}

interface ListResponse {
  items: Regra[]
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
  stats: Stats
}

interface Props {
  empresaId: string
  empresaNome: string
  categorias: Categoria[]
}

export function RegrasClient({ empresaId, empresaNome, categorias }: Props) {
  const { toast } = useToast()

  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [tipoMatch, setTipoMatch] = useState<string>('ALL')
  const [categoryId, setCategoryId] = useState<string>('ALL')
  const [status, setStatus] = useState<string>('ALL')

  const [editing, setEditing] = useState<Regra | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Regra | null>(null)

  const fetchData = useCallback(
    async (resetPage = false) => {
      setLoading(true)
      const nextPage = resetPage ? 1 : page
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: '10',
          tipoMatch,
          status,
        })
        if (q.trim()) params.set('q', q.trim())
        if (categoryId !== 'ALL') params.set('categoryId', categoryId)

        const res = await fetch(
          `/api/empresas/${empresaId}/regras?${params.toString()}`,
        )
        const json = await res.json()
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: json.erro ?? 'Falha ao carregar regras.',
          })
          return
        }
        setData(json)
        if (resetPage) setPage(1)
      } finally {
        setLoading(false)
      }
    },
    [empresaId, page, q, tipoMatch, categoryId, status, toast],
  )

  useEffect(() => {
    void fetchData(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    void fetchData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoMatch, categoryId, status])

  async function togglePause(r: Regra) {
    const action = r.isActive ? 'pause' : 'resume'
    const res = await fetch(
      `/api/empresas/${empresaId}/regras/${r.id}/${action}`,
      { method: 'POST' },
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
      title: r.isActive ? 'Regra pausada' : 'Regra reativada',
      description: r.padrao,
    })
    void fetchData(false)
  }

  async function deleteRule(r: Regra) {
    const res = await fetch(`/api/empresas/${empresaId}/regras/${r.id}`, {
      method: 'DELETE',
    })
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
      title: 'Regra removida',
      description: `"${r.padrao}" deletada.`,
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
            <Brain className="h-6 w-6 text-primary" />
            Regras Aprendidas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Padrões que a IA Contadora reconhece pra classificar automaticamente.
          </p>
        </div>
        <Link
          href={`/empresas/${empresaId}/pendentes`}
          className="text-sm text-primary hover:underline"
        >
          Pendentes →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Regras ativas"
          value={stats?.totalAtivas ?? 0}
          hint="ativas no momento"
        />
        <StatCard
          label="Confiança média"
          value={
            stats?.confiancaMedia
              ? confidencePercent(stats.confiancaMedia)
              : '—'
          }
          hint="das regras ativas"
        />
        <StatCard
          label="Top regra"
          value={stats?.topRules[0]?.vezesAplicada ?? 0}
          hint={stats?.topRules[0]?.padrao ?? 'sem dados'}
        />
        <StatCard
          label="Última aprendida"
          value={
            stats?.ultimaRegra
              ? new Date(stats.ultimaRegra.createdAt).toLocaleDateString('pt-BR')
              : '—'
          }
          hint={stats?.ultimaRegra?.padrao ?? '—'}
        />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Buscar padrão</Label>
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
              placeholder="ex: NETFLIX"
              className="pl-7 h-9 text-sm"
            />
          </form>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Match</Label>
          <Select value={tipoMatch} onValueChange={setTipoMatch}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="EXACT">Exato</SelectItem>
              <SelectItem value="CONTAINS">Contém</SelectItem>
              <SelectItem value="CNPJ">CNPJ</SelectItem>
              <SelectItem value="NORMALIZED">Normalizado</SelectItem>
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
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="ACTIVE">Ativas</SelectItem>
              <SelectItem value="PAUSED">Pausadas</SelectItem>
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
            Nenhuma regra encontrada. Classifique transações em{' '}
            <Link
              href={`/empresas/${empresaId}/pendentes`}
              className="underline"
            >
              /pendentes
            </Link>{' '}
            pra criar regras automaticamente.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Padrão</th>
                <th className="text-left px-3 py-2">Match</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-left px-3 py-2">Confiança</th>
                <th className="text-right px-3 py-2 tabular-nums">Usos</th>
                <th className="text-left px-3 py-2">Atualizado</th>
                <th className="text-left px-3 py-2">Fonte</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const mc = matchTypeColor(r.tipoMatch)
                const cc = confidenceColors(r.confianca)
                return (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-mono text-xs max-w-[280px] truncate">
                      {r.padrao}
                      {!r.isActive && (
                        <span className="ml-2 text-[10px] uppercase text-amber-600 dark:text-amber-400">
                          pausada
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                        style={{
                          background: mc.bg,
                          color: mc.text,
                        }}
                      >
                        {matchTypeLabel(r.tipoMatch)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.category ? (
                        <span className="inline-flex items-center gap-1">
                          {r.category.color && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: r.category.color }}
                            />
                          )}
                          {r.category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${cc.bg} ${cc.text}`}
                      >
                        {confidenceLabel(r.confianca)} ·{' '}
                        {confidencePercent(r.confianca)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.vezesAplicada}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.updatedAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.fonte === 'CLAUDE' ? (
                        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <Sparkles className="h-3 w-3" />
                          IA
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Manual</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          aria-label="Editar"
                          onClick={() => setEditing(r)}
                          className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label={r.isActive ? 'Pausar' : 'Reativar'}
                          onClick={() => void togglePause(r)}
                          className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"
                        >
                          {r.isActive ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          aria-label="Deletar"
                          onClick={() => setConfirmDelete(r)}
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
              {pagination.total} regras
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

      {/* Edit modal */}
      {editing && (
        <EditRegraModal
          empresaId={empresaId}
          regra={editing}
          categorias={categorias}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void fetchData(false)
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
          title="Deletar regra?"
          description={
            <div className="space-y-2 text-sm">
              <p>
                Padrão: <strong className="font-mono">{confirmDelete.padrao}</strong>
              </p>
              <p>
                Essa regra foi aplicada{' '}
                <strong>{confirmDelete.vezesAplicada}</strong>{' '}
                vez{confirmDelete.vezesAplicada === 1 ? '' : 'es'}. As
                transações classificadas por ela ficam intactas — só o vínculo
                com a regra é desfeito.
              </p>
            </div>
          }
          confirmLabel="Deletar"
          variant="destructive"
          onConfirm={async () => {
            await deleteRule(confirmDelete)
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// StatCard
// ============================================================

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
// Edit modal
// ============================================================

function EditRegraModal({
  empresaId,
  regra,
  categorias,
  onClose,
  onSaved,
}: {
  empresaId: string
  regra: Regra
  categorias: Categoria[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [padrao, setPadrao] = useState(regra.padrao)
  const [tipoMatch, setTipoMatch] = useState(regra.tipoMatch)
  const [categoryId, setCategoryId] = useState(regra.category?.id ?? '')
  const [confianca, setConfianca] = useState(regra.confianca)
  const [saving, setSaving] = useState(false)

  // Sprint 3.0.4 C3 — preview ao vivo do que a regra mataria
  interface Sample {
    id: string
    description: string
    amount: number
    date: string
    type: string
  }
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewSamples, setPreviewSamples] = useState<Sample[]>([])
  const [previewTruncado, setPreviewTruncado] = useState(false)

  useEffect(() => {
    const padraoTrim = padrao.trim()
    if (!padraoTrim) {
      setPreviewCount(null)
      setPreviewSamples([])
      return
    }
    const handle = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await fetch(`/api/empresas/${empresaId}/regras/preview`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ padrao: padraoTrim, tipoMatch, excludeRuleId: regra.id }),
        })
        if (!res.ok) {
          setPreviewCount(null)
          setPreviewSamples([])
          return
        }
        const data = await res.json()
        setPreviewCount(data.count)
        setPreviewSamples(data.samples ?? [])
        setPreviewTruncado(!!data.truncado)
      } catch {
        setPreviewCount(null)
        setPreviewSamples([])
      } finally {
        setPreviewLoading(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [padrao, tipoMatch, empresaId, regra.id])

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      if (padrao !== regra.padrao) payload.padrao = padrao
      if (tipoMatch !== regra.tipoMatch) payload.tipoMatch = tipoMatch
      if (categoryId !== (regra.category?.id ?? '')) {
        payload.categoryId = categoryId || null
      }
      if (Math.abs(confianca - regra.confianca) > 0.001) {
        payload.confianca = confianca
      }
      if (Object.keys(payload).length === 0) {
        onClose()
        return
      }
      const res = await fetch(`/api/empresas/${empresaId}/regras/${regra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: json.erro ?? 'Falha ao atualizar.',
        })
        return
      }
      toast({ title: 'Regra atualizada', description: padrao })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar regra</DialogTitle>
          <DialogDescription>
            Aplicada {regra.vezesAplicada} vez
            {regra.vezesAplicada === 1 ? '' : 'es'} em transações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Padrão</Label>
            <Input
              value={padrao}
              onChange={(e) => setPadrao(e.target.value)}
              className="font-mono text-sm"
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de match</Label>
            <Select value={tipoMatch} onValueChange={setTipoMatch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXACT">Exato</SelectItem>
                <SelectItem value="CONTAINS">Contém</SelectItem>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="NORMALIZED">Normalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs">
              Confiança: {confidencePercent(confianca)}
            </Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={confianca}
              onChange={(e) => setConfianca(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Sprint 3.0.4 C3 — Preview ao vivo: o que essa regra mataria HOJE */}
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Calculando preview…
            </div>
          ) : previewCount === null ? (
            <p className="text-muted-foreground">
              Digite um padrão pra ver quantas pendentes seriam classificadas.
            </p>
          ) : previewCount === 0 ? (
            <p className="text-muted-foreground">
              Nenhuma transação pendente bate com esse padrão.
              {previewTruncado && ' (janela: 5000 tx mais recentes)'}
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">
                <span className="tabular-nums">{previewCount}</span> transaç
                {previewCount === 1 ? 'ão pendente seria classificada' : 'ões pendentes seriam classificadas'}
                {previewTruncado && ' (de uma janela de 5000)'}
              </p>
              <ul className="space-y-0.5 pl-3 text-muted-foreground">
                {previewSamples.map((s) => (
                  <li key={s.id} className="truncate">
                    • {s.description}
                  </li>
                ))}
                {previewCount > previewSamples.length && (
                  <li className="italic text-muted-foreground/70">
                    + {previewCount - previewSamples.length} outras…
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
