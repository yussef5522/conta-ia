'use client'

// Sprint 5.0.2.c — Picker visual de CNAE com chips de ramo, search e cards.
//
// Substitui o autocomplete simples (dropdown) por interface visual que
// resolve o feedback do Yussef: "nem aparece restaurante ou academia".
// Mostra TODOS os 19 CNAEs sempre visíveis, com filtros e ícones.

import { useEffect, useMemo, useState } from 'react'
import { Search, Sparkles, X, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface CNAEPickerResult {
  code: string
  name: string
  ramo: string
  ramoLabel: string
  anexo: string
  icon: string
  aliases: string[]
}

interface RamoChip {
  key: string
  icon: string
  label: string
  count: number
}

interface Props {
  value?: string
  onChange: (cnae: CNAEPickerResult) => void
}

export function CNAESearchPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [ramo, setRamo] = useState<string | null>(null)
  const [results, setResults] = useState<CNAEPickerResult[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  // Carga inicial: pega todos pra mostrar chips com contagem correta
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (ramo) params.set('ramo', ramo)
    params.set('limit', '50')

    const t = setTimeout(() => {
      fetch(`/api/cnae/search?${params.toString()}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          setResults(d.results ?? [])
          if (d.countByRamo) setCounts(d.countByRamo)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 150)

    return () => clearTimeout(t)
  }, [search, ramo])

  const chips: RamoChip[] = useMemo(
    () => [
      { key: 'RESTAURANTE', icon: '🍔', label: 'Restaurantes', count: counts.RESTAURANTE ?? 8 },
      { key: 'ACADEMIA', icon: '💪', label: 'Academias / Fitness', count: counts.ACADEMIA ?? 5 },
      { key: 'COMERCIO_ROUPA', icon: '🛒', label: 'Comércio de Roupas', count: counts.COMERCIO_ROUPA ?? 6 },
    ],
    [counts],
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          Atividade da empresa (CNAE)
        </label>
        <p className="text-xs text-zinc-500 mt-0.5">
          Escolha o ramo pra desbloquear análise especializada — sistema cobre 19 CNAEs em 3 setores
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <Input
          type="search"
          placeholder="Buscar atividade — ex: restaurante, academia, loja roupa, pizza, crossfit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-10 text-base"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Chips */}
      <div className="flex gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setRamo(ramo === c.key ? null : c.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              ramo === c.key
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300',
            )}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px]',
                ramo === c.key ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600',
              )}
            >
              {c.count}
            </span>
          </button>
        ))}
        {ramo && (
          <button
            type="button"
            onClick={() => setRamo(null)}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 px-2"
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Status */}
      <div className="text-xs text-zinc-500">
        {loading ? 'Buscando…' : `${results.length} atividade${results.length === 1 ? '' : 's'} encontrada${results.length === 1 ? '' : 's'}`}
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {results.map((r) => (
          <CNAECard key={r.code} cnae={r} selected={value === r.code} onSelect={() => onChange(r)} />
        ))}
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center py-10 border-2 border-dashed border-zinc-200 rounded-lg">
          <p className="text-sm text-zinc-600 font-medium">Nenhuma atividade encontrada</p>
          <p className="text-xs text-zinc-500 mt-1">
            Sistema cobre 3 ramos: Restaurantes, Academias, Comércio de Roupas.
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Outros ramos serão adicionados sob demanda — fale com Yussef.
          </p>
        </div>
      )}
    </div>
  )
}

interface CardProps {
  cnae: CNAEPickerResult
  selected: boolean
  onSelect: () => void
}

function CNAECard({ cnae, selected, onSelect }: CardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'p-3 rounded-lg border-2 text-left transition-all group',
        selected
          ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-100'
          : 'border-zinc-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0 leading-none mt-0.5">{cnae.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900 truncate">{cnae.name}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{cnae.code}</span>
            <span className="text-zinc-300">·</span>
            <span>Anexo {cnae.anexo}</span>
          </div>
        </div>
        {selected && (
          <div className="shrink-0 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
    </button>
  )
}
