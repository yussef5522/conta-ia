'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryTree } from '@/components/categorias/CategoryTree'
import { CategoryFilters } from '@/components/categorias/CategoryFilters'
import { CategoryForm, type FormMode } from '@/components/categorias/CategoryForm'
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
  const [categorias, setCategorias] = useState<CategoryFlat[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<FormMode>('view')

  // Token pra forçar refetch após save/delete
  const [refetchKey, setRefetchKey] = useState(0)

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

  // Seleção busca na árvore base (não filtrada) — preserva mesmo se filtro esconder
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

  // Lista achatada de candidatas a parent — exclui self e descendentes (em modo edit)
  const parentCandidates = useMemo<CategoryNode[]>(() => {
    const todos = flattenTree(treeBase)
    if (mode !== 'edit' || !selected) return todos
    // Coleta IDs descendentes da selected
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
    // Mantém selectedId pra mostrar a categoria como inativa
  }

  return (
    <div className="space-y-6">
      <Header
        title={`Plano de Contas — ${empresaNome}`}
        description={`${totalCategorias} categorias · ${setorLabel} · ${regimeLabel}`}
      >
        <Button variant="ghost" size="sm" aria-label="Configurar plano de contas" disabled>
          <Settings2 className="h-4 w-4" />
        </Button>
      </Header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleNovaCategoria}
          aria-label="Criar nova categoria"
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
        <Button size="sm" variant="outline" disabled aria-label="Restaurar template padrão (5.1.E)">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>
      </div>

      {/* Filtros */}
      <CategoryFilters
        filters={filters}
        onChange={setFilters}
        dreGroupsPresentes={dreGroupsPresentes}
      />

      {/* Layout split 40/60 */}
      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        {/* Coluna esquerda — Árvore */}
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
                  // Se está em modo create/edit, não permitir trocar seleção sem cancelar
                  if (mode === 'view') {
                    setSelectedId(node.id)
                  }
                }}
                defaultExpandAll={expandirTudo}
              />
            )}
          </CardContent>
        </Card>

        {/* Coluna direita — Form (view/create/edit) */}
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
