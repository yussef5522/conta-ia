'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Download,
  Upload,
  RotateCcw,
  Settings2,
  ListTree,
  FileText,
  Inbox,
  FilterX,
  Keyboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { CategoryTree } from '@/components/categorias/CategoryTree'
import { CategoryFilters } from '@/components/categorias/CategoryFilters'
import { CategoryForm, type FormMode } from '@/components/categorias/CategoryForm'
import { ShortcutsCheatsheet } from '@/components/categorias/ShortcutsCheatsheet'
import { RestoreTemplateDialog } from '@/components/categorias/RestoreTemplateDialog'
import {
  buildTree,
  flattenTree,
  type CategoryFlat,
  type CategoryNode,
} from '@/lib/categories/buildTree'
import {
  filterTree,
  DEFAULT_FILTERS,
  type CategoryFilters as Filters,
} from '@/lib/categories/filterTree'
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'

interface Props {
  empresaId: string
  empresaNome: string
  totalCategorias: number
  setorLabel: string
  regimeLabel: string
}

export function CategoriasClient({
  empresaId,
  empresaNome,
  totalCategorias,
  setorLabel,
  regimeLabel,
}: Props) {
  const { toast } = useToast()
  const [categorias, setCategorias] = useState<CategoryFlat[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<FormMode>('view')
  const [refetchKey, setRefetchKey] = useState(0)
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)

  const buscaInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        setLoading(true)
        setErro(null)
        const res = await fetch(`/api/empresas/${empresaId}/categorias`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.erro ?? 'Erro ao carregar categorias')
        }
        const data = await res.json()
        if (!cancelado) setCategorias(data.categorias ?? [])
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
  }, [empresaId, refetchKey])

  const treeBase = useMemo(() => buildTree(categorias), [categorias])

  const dreGroupsPresentes = useMemo(() => {
    const set = new Set<string>()
    for (const c of categorias) {
      if (c.dreGroup) set.add(c.dreGroup)
    }
    return Array.from(set).sort()
  }, [categorias])

  const treeFiltrada = useMemo(() => filterTree(treeBase, filters), [treeBase, filters])

  const flatVisible = useMemo(() => flattenTree(treeFiltrada), [treeFiltrada])

  const selected = useMemo<CategoryNode | null>(() => {
    if (!selectedId) return null
    const buscar = (nodes: CategoryNode[]): CategoryNode | null => {
      for (const n of nodes) {
        if (n.id === selectedId) return n
        const found = buscar(n.children)
        if (found) return found
      }
      return null
    }
    return buscar(treeBase)
  }, [selectedId, treeBase])

  const parentCandidates = useMemo<CategoryNode[]>(() => {
    const todos = flattenTree(treeBase)
    if (mode !== 'edit' || !selected) return todos
    const proibidos = new Set<string>([selected.id])
    const visitar = (n: CategoryNode) => {
      proibidos.add(n.id)
      for (const c of n.children) visitar(c)
    }
    visitar(selected)
    return todos.filter((c) => !proibidos.has(c.id))
  }, [treeBase, mode, selected])

  const filtrosAtivos =
    filters.search.trim() !== '' ||
    filters.type !== 'ALL' ||
    filters.dreGroup !== 'ALL' ||
    filters.status !== DEFAULT_FILTERS.status

  const limparFiltros = () => setFilters(DEFAULT_FILTERS)
  const expandirTudo = filters.search.trim() !== ''

  function handleNovaCategoria() {
    setSelectedId(null)
    setMode('create')
  }

  function handleSaved() {
    setRefetchKey((k) => k + 1)
    setMode('view')
  }

  function handleDeactivated() {
    setRefetchKey((k) => k + 1)
    setMode('view')
  }

  // Reorder via drag-and-drop (com optimistic update)
  async function handleReorder(movedId: string, parentId: string | null, overId: string | null) {
    // Calcula newIndex baseado no overId nos siblings
    const siblings = categorias.filter((c) => (c.parentId ?? null) === (parentId ?? null))
    const ordenados = [...siblings].sort((a, b) => a.order - b.order)
    const overIndex = overId ? ordenados.findIndex((s) => s.id === overId) : ordenados.length - 1
    if (overIndex < 0) return
    const movedIndex = ordenados.findIndex((s) => s.id === movedId)
    // Se o movido está antes do over, newIndex = overIndex; senão overIndex
    const newIndex = overIndex

    // Optimistic update local
    const snapshot = categorias
    const reordenadosIds = (() => {
      const lista = ordenados.filter((s) => s.id !== movedId).map((s) => s.id)
      lista.splice(Math.max(0, Math.min(newIndex, lista.length)), 0, movedId)
      return lista
    })()
    setCategorias((prev) =>
      prev.map((c) => {
        if ((c.parentId ?? null) !== (parentId ?? null)) return c
        const idx = reordenadosIds.indexOf(c.id)
        return idx >= 0 ? { ...c, order: idx + 1 } : c
      }),
    )

    try {
      const res = await fetch(`/api/empresas/${empresaId}/categorias/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: movedId, newOrder: newIndex, parentId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erro ?? 'Erro ao reordenar')
      }
    } catch (e) {
      // Rollback
      setCategorias(snapshot)
      toast({
        variant: 'destructive',
        title: 'Erro ao reordenar',
        description: e instanceof Error ? e.message : 'Tente novamente.',
      })
    }
  }

  // Rename inline (com optimistic update)
  async function handleRename(id: string, newName: string) {
    const snapshot = categorias
    setCategorias((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)))

    try {
      const res = await fetch(`/api/empresas/${empresaId}/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erro ?? 'Erro ao renomear')
      }
      toast({ variant: 'success', title: 'Categoria renomeada' })
    } catch (e) {
      setCategorias(snapshot)
      toast({
        variant: 'destructive',
        title: 'Erro ao renomear',
        description: e instanceof Error ? e.message : 'Tente novamente.',
      })
    }
  }

  function navegarLista(direcao: 1 | -1) {
    if (flatVisible.length === 0) return
    const idxAtual = selectedId ? flatVisible.findIndex((n) => n.id === selectedId) : -1
    let proximo = idxAtual + direcao
    if (idxAtual === -1) proximo = direcao === 1 ? 0 : flatVisible.length - 1
    if (proximo < 0) proximo = 0
    if (proximo >= flatVisible.length) proximo = flatVisible.length - 1
    setSelectedId(flatVisible[proximo].id)
  }

  // Atalhos de teclado (apenas em modo view)
  const shortcutsEnabled = mode === 'view'
  useKeyboardShortcuts(
    [
      { key: 'j', handler: () => navegarLista(1) },
      { key: 'ArrowDown', handler: () => navegarLista(1) },
      { key: 'k', handler: () => navegarLista(-1) },
      { key: 'ArrowUp', handler: () => navegarLista(-1) },
      {
        key: 'Enter',
        handler: () => {
          if (selected) setMode('edit')
        },
      },
      { key: 'n', handler: handleNovaCategoria },
      {
        key: 'e',
        handler: () => {
          if (selected) setMode('edit')
        },
      },
      {
        key: 'Delete',
        handler: () => {
          // Click programático no botão de desativar não é trivial.
          // Estratégia: deixa o botão de desativar acessível via tab; aqui só mostra mensagem.
          if (selected?.isActive) {
            toast({
              title: 'Use o botão Desativar',
              description: 'Pra desativar use o botão na lateral direita pra abrir a confirmação.',
            })
          }
        },
      },
      {
        key: 'Escape',
        handler: () => setSelectedId(null),
      },
      {
        key: '/',
        handler: () => {
          buscaInputRef.current?.focus()
        },
      },
      {
        key: '?',
        handler: () => setCheatsheetOpen(true),
      },
    ],
    { enabled: shortcutsEnabled },
  )

  return (
    <div className="space-y-6">
      <Header
        title={`Plano de Contas — ${empresaNome}`}
        description={`${totalCategorias} categorias · ${setorLabel} · ${regimeLabel}`}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCheatsheetOpen(true)}
          aria-label="Ver atalhos de teclado"
          title="Atalhos (?)"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Configurar plano de contas" disabled>
          <Settings2 className="h-4 w-4" />
        </Button>
      </Header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleNovaCategoria}
          aria-label="Criar nova categoria (atalho N)"
          disabled={mode !== 'view'}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova Categoria
        </Button>
        <Button size="sm" variant="outline" disabled aria-label="Importar categorias (v2)">
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Importar
        </Button>
        <Button size="sm" variant="outline" disabled aria-label="Exportar categorias">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Exportar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRestoreOpen(true)}
          disabled={mode !== 'view'}
          aria-label="Restaurar template padrão"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>
      </div>

      {/* Filtros */}
      <CategoryFilters
        filters={filters}
        onChange={setFilters}
        dreGroupsPresentes={dreGroupsPresentes}
        searchInputRef={buscaInputRef}
      />

      {/* Layout split */}
      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        <Card className="min-h-[480px]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListTree className="h-4 w-4 text-muted-foreground" />
              Árvore de Categorias
              {!loading && categorias.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({treeFiltrada.length > 0 ? `mostrando ${countFlat(treeFiltrada)}` : '0'} de{' '}
                  {categorias.length})
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Carregando categorias">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : erro ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Não foi possível carregar as categorias
                </p>
                <p className="text-xs text-muted-foreground mt-1">{erro}</p>
              </div>
            ) : categorias.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Nenhuma categoria cadastrada</p>
              </div>
            ) : treeFiltrada.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <FilterX className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  Nenhuma categoria encontrada com esses filtros
                </p>
                <Button size="sm" variant="outline" onClick={limparFiltros} className="mt-3">
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <CategoryTree
                tree={treeFiltrada}
                selectedId={selectedId}
                onSelect={(node) => {
                  if (mode === 'view') setSelectedId(node.id)
                }}
                defaultExpandAll={expandirTudo}
                onReorder={handleReorder}
                onRename={handleRename}
                interactiveDisabled={mode !== 'view'}
                onInvalidDrop={() => {
                  toast({
                    title: 'Movimento entre níveis não permitido',
                    description:
                      "Use o campo 'É subcategoria de...' no formulário de edição pra mover entre níveis.",
                  })
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[480px]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {mode === 'view' && 'Detalhes da Categoria'}
              {mode === 'create' && 'Nova Categoria'}
              {mode === 'edit' && 'Editando Categoria'}
            </div>
            <CategoryForm
              empresaId={empresaId}
              mode={mode}
              selected={selected}
              parentCandidates={parentCandidates}
              onModeChange={setMode}
              onSaved={handleSaved}
              onDeactivated={handleDeactivated}
            />
          </CardContent>
        </Card>
      </div>

      {filtrosAtivos && treeFiltrada.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={limparFiltros}>
            <FilterX className="mr-1.5 h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        </div>
      )}

      <ShortcutsCheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />

      <RestoreTemplateDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        empresaId={empresaId}
        onApplied={() => {
          setRestoreOpen(false)
          setRefetchKey((k) => k + 1)
        }}
      />
    </div>
  )
}

function countFlat(tree: CategoryNode[]): number {
  let n = 0
  const visitar = (node: CategoryNode) => {
    n++
    for (const c of node.children) visitar(c)
  }
  for (const r of tree) visitar(r)
  return n
}
