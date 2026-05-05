'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  PlusCircle,
  Loader2,
  PartyPopper,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDreColorClass, getDreLabel } from '@/lib/categories/dre-colors'
import type { DiffResult, DiffSummary } from '@/lib/categories/template-diff'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  onApplied: () => void
}

interface DiffResponse {
  setor: string
  regime: string
  diff: DiffResult
  summary: DiffSummary
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function RestoreTemplateDialog({
  open,
  onOpenChange,
  empresaId,
  onApplied,
}: Props) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [data, setData] = useState<DiffResponse | null>(null)
  const [applying, setApplying] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Estado das seleções
  const [revertEdited, setRevertEdited] = useState<Set<string>>(new Set())
  const [removeCustomIds, setRemoveCustomIds] = useState<Set<string>>(new Set())
  const [addMissing, setAddMissing] = useState<Set<string>>(new Set())

  const [searchQuery, setSearchQuery] = useState('')

  // Seções colapsadas (default: identical colapsada)
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['edited', 'custom', 'missing']),
  )

  function toggleSection(s: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  // Carrega diff ao abrir
  useEffect(() => {
    if (!open) return
    let cancelado = false

    async function carregar() {
      try {
        setLoading(true)
        setErro(null)
        setData(null)
        setRevertEdited(new Set())
        setRemoveCustomIds(new Set())
        setAddMissing(new Set())
        setSearchQuery('')

        const res = await fetch(`/api/empresas/${empresaId}/categorias/template-diff`)
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.erro ?? 'Erro ao calcular diff')
        }
        const json: DiffResponse = await res.json()
        if (!cancelado) setData(json)
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro inesperado')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [open, empresaId])

  // Filtro de busca
  const filteredDiff = useMemo(() => {
    if (!data) return null
    const q = normalizar(searchQuery.trim())
    if (!q) return data.diff

    const matches = (s: string) => normalizar(s).includes(q)

    return {
      identical: data.diff.identical.filter((c) => matches(c.name)),
      edited: data.diff.edited.filter(
        (e) => matches(e.category.name) || matches(e.templateOriginal.name),
      ),
      custom: data.diff.custom.filter((c) => matches(c.name)),
      missing: data.diff.missing.filter((m) => matches(m.name)),
    }
  }, [data, searchQuery])

  const totalChanges =
    revertEdited.size + removeCustomIds.size + addMissing.size

  async function handleApply() {
    if (!data) return
    setApplying(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/categorias/restore-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revertEdited: Array.from(revertEdited),
          removeCustom: Array.from(removeCustomIds),
          addMissing: Array.from(addMissing),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Erro ao aplicar',
          description: d.erro ?? 'Tente novamente.',
        })
        throw new Error(d.erro ?? 'Erro')
      }
      const result = await res.json()
      const total =
        (result.applied?.reverted ?? 0) +
        (result.applied?.removed ?? 0) +
        (result.applied?.added ?? 0)
      toast({
        variant: 'success',
        title: `${total} mudança${total !== 1 ? 's' : ''} aplicada${total !== 1 ? 's' : ''}`,
      })
      onApplied()
      onOpenChange(false)
    } catch (e) {
      // Já mostrou toast acima — re-throw pra ConfirmDialog não fechar
      throw e
    } finally {
      setApplying(false)
    }
  }

  // Empty state geral (sem mudanças)
  const hasNoChanges =
    !!data &&
    data.summary.editedCount === 0 &&
    data.summary.customCount === 0 &&
    data.summary.missingCount === 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>↺ Restaurar Padrão</DialogTitle>
            <DialogDescription>
              Compare seu plano de contas com o template oficial do setor. Decida o que voltar
              ao padrão, manter customizado ou adicionar.
            </DialogDescription>
          </DialogHeader>

          {/* Loading */}
          {loading && (
            <div className="space-y-3 py-2">
              <Skeleton className="h-9 w-full" />
              <div className="grid grid-cols-4 gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {/* Erro */}
          {erro && !loading && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                Não foi possível calcular o diff
              </p>
              <p className="text-xs text-muted-foreground mt-1">{erro}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !erro && hasNoChanges && (
            <div className="flex flex-col items-center py-12 text-center">
              <PartyPopper className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-base font-semibold">Tudo em ordem!</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Seu plano de contas está idêntico ao template oficial do setor{' '}
                <strong>{data?.setor}</strong>.
              </p>
            </div>
          )}

          {/* Conteúdo principal */}
          {!loading && !erro && data && !hasNoChanges && (
            <>
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Buscar nas mudanças..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Buscar no diff"
                />
              </div>

              {/* Resumo (4 cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SummaryCard
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  label="Idênticas"
                  count={data.summary.identicalCount}
                />
                <SummaryCard
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  label="Editadas"
                  count={data.summary.editedCount}
                />
                <SummaryCard
                  icon={<Sparkles className="h-3.5 w-3.5 text-indigo-500" />}
                  label="Customizadas"
                  count={data.summary.customCount}
                />
                <SummaryCard
                  icon={<PlusCircle className="h-3.5 w-3.5 text-blue-500" />}
                  label="Novas no template"
                  count={data.summary.missingCount}
                />
              </div>

              {/* Seções */}
              <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-2">
                {/* Identical (collapsed por default) */}
                <Section
                  id="identical"
                  expanded={expanded.has('identical')}
                  onToggle={() => toggleSection('identical')}
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  title="Já idênticas ao template"
                  count={filteredDiff?.identical.length ?? 0}
                >
                  <div className="text-xs text-muted-foreground py-2">
                    Estas categorias batem 100% com o template — nada a fazer.
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {filteredDiff?.identical.slice(0, 30).map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-block h-1.5 w-1.5 rounded-full',
                            getDreColorClass(c.dreGroup),
                          )}
                        />
                        {c.name}
                      </li>
                    ))}
                    {(filteredDiff?.identical.length ?? 0) > 30 && (
                      <li className="italic">
                        ... +{(filteredDiff?.identical.length ?? 0) - 30} categorias
                      </li>
                    )}
                  </ul>
                </Section>

                {/* Edited */}
                {(filteredDiff?.edited.length ?? 0) > 0 && (
                  <Section
                    id="edited"
                    expanded={expanded.has('edited')}
                    onToggle={() => toggleSection('edited')}
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                    title="Você editou"
                    count={filteredDiff?.edited.length ?? 0}
                  >
                    <div className="flex items-center gap-2 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRevertEdited(
                            new Set([
                              ...revertEdited,
                              ...(filteredDiff?.edited.map((e) => e.category.id) ?? []),
                            ]),
                          )
                        }}
                      >
                        Voltar todas ao padrão
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const ids = new Set(
                            filteredDiff?.edited.map((e) => e.category.id) ?? [],
                          )
                          setRevertEdited(
                            new Set([...revertEdited].filter((id) => !ids.has(id))),
                          )
                        }}
                      >
                        Manter todas
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {filteredDiff?.edited.map((e) => (
                        <li
                          key={e.category.id}
                          className="rounded border bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {e.category.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Era: <span className="font-mono">{e.templateOriginal.name}</span>{' '}
                                · Diferenças: {e.differences.join(', ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant={revertEdited.has(e.category.id) ? 'outline' : 'ghost'}
                                onClick={() =>
                                  setRevertEdited((prev) => {
                                    const next = new Set(prev)
                                    next.delete(e.category.id)
                                    return next
                                  })
                                }
                                className={cn(
                                  'text-xs',
                                  !revertEdited.has(e.category.id) &&
                                    'bg-muted',
                                )}
                              >
                                Manter custom
                              </Button>
                              <Button
                                size="sm"
                                variant={revertEdited.has(e.category.id) ? 'default' : 'outline'}
                                onClick={() =>
                                  setRevertEdited((prev) => {
                                    const next = new Set(prev)
                                    next.add(e.category.id)
                                    return next
                                  })
                                }
                                className="text-xs"
                              >
                                Voltar ao padrão
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Custom */}
                {(filteredDiff?.custom.length ?? 0) > 0 && (
                  <Section
                    id="custom"
                    expanded={expanded.has('custom')}
                    onToggle={() => toggleSection('custom')}
                    icon={<Sparkles className="h-4 w-4 text-indigo-500" />}
                    title="Suas customizações"
                    count={filteredDiff?.custom.length ?? 0}
                  >
                    <div className="text-xs text-muted-foreground py-2">
                      Por padrão são <strong>mantidas</strong>. Marque pra <strong>remover</strong>{' '}
                      categorias custom que não usa mais.
                    </div>
                    <ul className="space-y-1.5">
                      {filteredDiff?.custom.map((c) => {
                        const txCount = c._count?.transactions ?? 0
                        const childrenCount = c._count?.children ?? 0
                        const bloqueado = txCount > 0 || childrenCount > 0
                        const motivo =
                          txCount > 0
                            ? `${txCount} transações vinculadas`
                            : childrenCount > 0
                            ? `${childrenCount} subcategorias`
                            : null
                        const marcadaPraRemover = removeCustomIds.has(c.id)
                        return (
                          <li
                            key={c.id}
                            className={cn(
                              'flex items-start gap-2 rounded border bg-card p-2',
                              bloqueado && 'opacity-70',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={marcadaPraRemover}
                              disabled={bloqueado}
                              onChange={(e) =>
                                setRemoveCustomIds((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(c.id)
                                  else next.delete(c.id)
                                  return next
                                })
                              }
                              className="mt-0.5"
                              title={
                                bloqueado
                                  ? `Não pode remover: ${motivo}`
                                  : 'Marque pra remover esta customização'
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                {marcadaPraRemover ? 'Remover' : 'Manter'}{' '}
                                <span className="font-medium">{c.name}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {bloqueado ? motivo : 'sem uso — pode remover'}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Section>
                )}

                {/* Missing */}
                {(filteredDiff?.missing.length ?? 0) > 0 && (
                  <Section
                    id="missing"
                    expanded={expanded.has('missing')}
                    onToggle={() => toggleSection('missing')}
                    icon={<PlusCircle className="h-4 w-4 text-blue-500" />}
                    title="Novas no template"
                    count={filteredDiff?.missing.length ?? 0}
                  >
                    <div className="flex items-center gap-2 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddMissing(
                            new Set([
                              ...addMissing,
                              ...(filteredDiff?.missing.map((m) => m.templateKey) ?? []),
                            ]),
                          )
                        }}
                      >
                        Adicionar todas
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const keys = new Set(
                            filteredDiff?.missing.map((m) => m.templateKey) ?? [],
                          )
                          setAddMissing(
                            new Set([...addMissing].filter((k) => !keys.has(k))),
                          )
                        }}
                      >
                        Nenhuma
                      </Button>
                    </div>
                    <ul className="space-y-1.5">
                      {filteredDiff?.missing.map((m) => (
                        <li
                          key={m.templateKey}
                          className="flex items-start gap-2 rounded border bg-card p-2"
                        >
                          <input
                            type="checkbox"
                            checked={addMissing.has(m.templateKey)}
                            onChange={(e) =>
                              setAddMissing((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(m.templateKey)
                                else next.delete(m.templateKey)
                                return next
                              })
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{m.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'inline-block h-1.5 w-1.5 rounded-full',
                                  getDreColorClass(m.dreGroup),
                                )}
                              />
                              {getDreLabel(m.dreGroup)}
                              {m.defaultCode && ` · ${m.defaultCode}`}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>

              {/* Resumo das seleções */}
              <div className="border-t pt-3 text-sm">
                <p className="font-medium">Mudanças selecionadas:</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <li>{revertEdited.size} categoria(s) volta(m) ao padrão</li>
                  <li>{removeCustomIds.size} customização(ões) removida(s)</li>
                  <li>{addMissing.size} categoria(s) nova(s) adicionada(s)</li>
                  <li className="font-medium pt-1">
                    Total: {totalChanges} mudança{totalChanges !== 1 ? 's' : ''}
                  </li>
                </ul>
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
              {hasNoChanges ? 'Fechar' : 'Cancelar'}
            </Button>
            {!hasNoChanges && data && (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={totalChanges === 0 || applying}
              >
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  `Aplicar ${totalChanges} mudança${totalChanges !== 1 ? 's' : ''}`
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação final */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar mudanças?"
        description={
          <>
            Você está prestes a aplicar <strong>{totalChanges} mudança(s)</strong>:
            <ul className="mt-2 space-y-1 text-sm">
              {revertEdited.size > 0 && <li>• {revertEdited.size} categoria(s) volta(m) ao padrão</li>}
              {removeCustomIds.size > 0 && (
                <li>• {removeCustomIds.size} customização(ões) removida(s)</li>
              )}
              {addMissing.size > 0 && (
                <li>• {addMissing.size} categoria(s) nova(s) adicionada(s)</li>
              )}
            </ul>
            <p className="mt-3 text-xs">
              ⚠️ Esta ação cria registro permanente no histórico. Pode ser revisada mas não pode
              ser desfeita automaticamente.
            </p>
          </>
        }
        confirmLabel="Confirmar e Aplicar"
        cancelLabel="Cancelar"
        variant="default"
        onConfirm={handleApply}
      />
    </>
  )
}

function SummaryCard({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums mt-0.5">{count}</p>
    </div>
  )
}

function Section({
  id,
  expanded,
  onToggle,
  icon,
  title,
  count,
  children,
}: {
  id: string
  expanded: boolean
  onToggle: () => void
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <Badge variant="outline" className="text-xs tabular-nums">
          {count}
        </Badge>
      </button>
      {expanded && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  )
}
