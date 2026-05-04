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
import { CategoryDetail } from '@/components/categorias/CategoryDetail'
import { buildTree, type CategoryFlat, type CategoryNode } from '@/lib/categories/buildTree'
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
  }, [empresaId])

  // Árvore base (sem filtros) — referência pra buscar a categoria selecionada
  const treeBase = useMemo(() => buildTree(categorias), [categorias])

  // DRE Groups presentes pra montar opções dinâmicas do filtro
  const dreGroupsPresentes = useMemo(() => {
    const set = new Set<string>()
    for (const c of categorias) {
      if (c.dreGroup) set.add(c.dreGroup)
    }
    return Array.from(set).sort()
  }, [categorias])

  // Árvore filtrada
  const treeFiltrada = useMemo(() => filterTree(treeBase, filters), [treeBase, filters])

  // Categoria selecionada (busca na árvore base, não filtrada — preserva mesmo se filtro esconder)
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

  const filtrosAtivos =
    filters.search.trim() !== '' ||
    filters.type !== 'ALL' ||
    filters.dreGroup !== 'ALL' ||
    filters.status !== DEFAULT_FILTERS.status

  const limparFiltros = () => setFilters(DEFAULT_FILTERS)

  // Quando há busca, expande tudo automaticamente pra mostrar matches profundos
  const expandirTudo = filters.search.trim() !== ''

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

      {/* Toolbar — botões funcionarão em 5.1.C */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled aria-label="Criar nova categoria (5.1.C)">
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

      {/* Layout split 40/60 (responsivo: empilha em mobile <768px) */}
      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        {/* Coluna esquerda — Árvore */}
        <Card className="min-h-[480px]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListTree className="h-4 w-4 text-muted-foreground" />
              Árvore de Categorias
              {!loading && categorias.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({treeFiltrada.length > 0 ? `mostrando ${countFlat(treeFiltrada)}` : '0'} de {categorias.length})
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
                onSelect={(node) => setSelectedId(node.id)}
                defaultExpandAll={expandirTudo}
              />
            )}
          </CardContent>
        </Card>

        {/* Coluna direita — Detalhes (read-only nesta sub-etapa) */}
        <Card className="min-h-[480px]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Detalhes da Categoria
            </div>
            <CategoryDetail empresaId={empresaId} selected={selected} />
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

// Conta total de nós em uma árvore (incluindo todos os filhos).
function countFlat(tree: CategoryNode[]): number {
  let n = 0
  const visitar = (node: CategoryNode) => {
    n++
    for (const c of node.children) visitar(c)
  }
  for (const r of tree) visitar(r)
  return n
}
