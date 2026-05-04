'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/lib/hooks/useDebounce'
import type { CategoryFilters as Filters } from '@/lib/categories/filterTree'
import { cn } from '@/lib/utils'
import { getDreColorClass, getDreLabel } from '@/lib/categories/dre-colors'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  // DRE Groups disponíveis nas categorias atuais (pra montar opções dinâmicas).
  dreGroupsPresentes: string[]
}

export function CategoryFilters({ filters, onChange, dreGroupsPresentes }: Props) {
  // Input local pra busca + debounce 200ms antes de propagar
  const [searchInput, setSearchInput] = useState(filters.search)
  const debouncedSearch = useDebounce(searchInput, 200)

  // Quando o debounced muda, propaga pro pai. Evita loop checando se mudou.
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ ...filters, search: debouncedSearch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Busca */}
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar categoria por nome"
              />
            </div>
          </div>

          {/* Tipo */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tipo</p>
            <Select
              value={filters.type}
              onValueChange={(v) => onChange({ ...filters, type: v as Filters['type'] })}
            >
              <SelectTrigger className="h-8 w-36 text-sm" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="INCOME">Receitas</SelectItem>
                <SelectItem value="EXPENSE">Despesas</SelectItem>
                <SelectItem value="TRANSFER">Transferências</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DRE Group (dinâmico — só os grupos presentes) */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">DRE Group</p>
            <Select
              value={filters.dreGroup}
              onValueChange={(v) => onChange({ ...filters, dreGroup: v })}
            >
              <SelectTrigger className="h-8 w-52 text-sm" aria-label="Filtrar por DRE Group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os grupos</SelectItem>
                {dreGroupsPresentes.map((g) => (
                  <SelectItem key={g} value={g}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('inline-block h-2.5 w-2.5 rounded-full', getDreColorClass(g))}
                        aria-hidden="true"
                      />
                      {getDreLabel(g)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <Select
              value={filters.status}
              onValueChange={(v) => onChange({ ...filters, status: v as Filters['status'] })}
            >
              <SelectTrigger className="h-8 w-32 text-sm" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativas</SelectItem>
                <SelectItem value="INACTIVE">Inativas</SelectItem>
                <SelectItem value="ALL">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
