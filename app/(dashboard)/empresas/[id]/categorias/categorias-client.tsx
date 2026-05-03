'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  Download,
  Upload,
  RotateCcw,
  Search,
  Settings2,
  ListTree,
  FileText,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface Categoria {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  parentId: string | null
  dreGroup: string | null
  code: string | null
  description: string | null
  color: string
  icon: string | null
  order: number
  visibleInRegimes: string | null
  isActive: boolean
  isSystemDefault: boolean
  _count: { transactions: number }
}

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
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS')
  const [filtroDreGroup, setFiltroDreGroup] = useState<string>('TODOS')
  const [filtroStatus, setFiltroStatus] = useState<string>('ATIVAS')

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

  return (
    <div className="space-y-6">
      {/* Header com título + estatísticas */}
      <Header
        title={`Plano de Contas — ${empresaNome}`}
        description={`${totalCategorias} categorias · ${setorLabel} · ${regimeLabel}`}
      >
        <Button variant="ghost" size="sm" aria-label="Configurar plano de contas" disabled>
          <Settings2 className="h-4 w-4" />
        </Button>
      </Header>

      {/* Toolbar — botões placeholder (5.1.B/C) */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled aria-label="Criar nova categoria (5.1.B)">
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
        <Button size="sm" variant="outline" disabled aria-label="Restaurar template padrão">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>
      </div>

      {/* Filtros — placeholder não-funcional (5.1.B) */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px] space-y-1">
              <label htmlFor="busca-categoria" className="text-xs text-muted-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="busca-categoria"
                  className="h-8 pl-8 text-sm"
                  placeholder="Buscar por nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  disabled
                  aria-label="Buscar categoria por nome"
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <Select value={filtroTipo} onValueChange={setFiltroTipo} disabled>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="INCOME">Receitas</SelectItem>
                  <SelectItem value="EXPENSE">Despesas</SelectItem>
                  <SelectItem value="TRANSFER">Transferências</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">DRE Group</p>
              <Select value={filtroDreGroup} onValueChange={setFiltroDreGroup} disabled>
                <SelectTrigger className="h-8 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os grupos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={filtroStatus} onValueChange={setFiltroStatus} disabled>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVAS">Ativas</SelectItem>
                  <SelectItem value="INATIVAS">Inativas</SelectItem>
                  <SelectItem value="TODAS">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Badge variant="outline" className="text-xs">
              Filtros funcionarão em 5.1.B
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Layout split 40/60 (responsivo: empilha em mobile <768px) */}
      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        {/* Coluna esquerda — placeholder árvore */}
        <Card className="min-h-[480px]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListTree className="h-4 w-4 text-muted-foreground" />
              Árvore de Categorias
            </div>

            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Carregando categorias">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : erro ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Não foi possível carregar as categorias
                </p>
                <p className="text-xs text-muted-foreground mt-1">{erro}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tente recarregar a página em alguns segundos.
                </p>
              </div>
            ) : categorias.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Nenhuma categoria cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Categorias do template do setor são criadas automaticamente.
                </p>
              </div>
            ) : (
              <div
                className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-6"
                role="region"
                aria-label="Pré-visualização da árvore de categorias"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pré-visualização
                </p>
                <p className="text-sm mt-1">
                  Carregadas {categorias.length} categorias da empresa.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Árvore navegável com expand/collapse, drag-and-drop e cores por DRE Group entra
                  na sub-etapa <strong>5.1.B</strong>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna direita — placeholder detalhes */}
        <Card className="min-h-[480px]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Detalhes da Categoria
            </div>

            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium">Selecione uma categoria à esquerda</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Painel de edição com nome, código, DRE Group, cor, ícone, descrição,
                visibilidade por regime e estatísticas de uso entra na sub-etapa{' '}
                <strong>5.1.C</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
