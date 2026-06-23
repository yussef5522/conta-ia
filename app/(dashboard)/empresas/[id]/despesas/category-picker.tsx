'use client'

// Sprint 10 — Seletor de categoria reusável (inline + lote).
//
// Popover compacto: busca no topo + lista agrupada por dreGroup.
// Dark mode, sentence case, click outside fecha.
// Filtra categorias DESPESA (EXPENSE_DRE_GROUPS) por padrão — recategorizar
// uma despesa só faz sentido pra outra despesa.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2, ChevronDown, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface CategoriaPickerItem {
  id: string
  name: string
  type: string | null
  dreGroup: string | null
  color: string | null
}

interface Props {
  open: boolean
  categorias: CategoriaPickerItem[]
  /** Categoria atual (pra destacar e oferecer recategorização). Pode ser undef. */
  currentCategoryId?: string
  loading?: boolean
  onClose: () => void
  onPick: (categoryId: string) => void
  /** Anchor pra posicionar o popover. Se null, centra fixo. */
  anchorRect?: DOMRect | null
}

// Ordem visual dos grupos
const GROUP_ORDER = [
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
]

const GROUP_LABEL: Record<string, string> = {
  CUSTO_PRODUTO_VENDIDO: 'Custo',
  DESPESAS_PESSOAL: 'Pessoal',
  DESPESAS_COMERCIAIS: 'Comercial',
  DESPESAS_ADMINISTRATIVAS: 'Administrativo',
  DESPESAS_FINANCEIRAS: 'Financeiro',
  OUTRAS_DESPESAS: 'Outras',
  IMPOSTOS_SOBRE_LUCRO: 'Impostos',
}

export function CategoryPicker({
  open,
  categorias,
  currentCategoryId,
  loading,
  onClose,
  onPick,
  anchorRect,
}: Props) {
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function escHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Pequeno delay pra evitar capturar o click que abriu o popover
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('keydown', escHandler)
    }, 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    // Aceita só categorias de despesa
    const expenses = categorias.filter(
      (c) => c.dreGroup && GROUP_ORDER.includes(c.dreGroup),
    )
    const term = query.trim().toLowerCase()
    if (!term) return expenses
    return expenses.filter((c) => c.name.toLowerCase().includes(term))
  }, [categorias, query])

  const grouped = useMemo(() => {
    const byGroup = new Map<string, CategoriaPickerItem[]>()
    for (const c of filtered) {
      const g = c.dreGroup ?? 'OUTRAS_DESPESAS'
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g)!.push(c)
    }
    return GROUP_ORDER.map((g) => ({
      group: g,
      label: GROUP_LABEL[g] ?? g,
      items: (byGroup.get(g) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    })).filter((g) => g.items.length > 0)
  }, [filtered])

  if (!open) return null

  // Posicionamento: se temos anchor, posiciona logo abaixo dele.
  // Caso contrário, fixed centro inferior.
  const style: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        top: Math.min(anchorRect.bottom + 4, window.innerHeight - 360),
        left: Math.min(anchorRect.left, window.innerWidth - 320),
        width: 320,
        zIndex: 60,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
        zIndex: 60,
      }

  return (
    <>
      {/* Backdrop sutil */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        style={style}
        className="rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar categoria…"
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {loading ? (
            <div className="py-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aplicando…
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 mx-auto mb-1 opacity-50" />
              Nenhuma categoria encontrada.
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.group} className="px-1 pb-1">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {g.label}
                </div>
                <ul>
                  {g.items.map((c) => {
                    const isCurrent = c.id === currentCategoryId
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => onPick(c.id)}
                          disabled={isCurrent || loading}
                          className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${
                            isCurrent
                              ? 'bg-muted/50 cursor-not-allowed text-muted-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: c.color ?? '#94a3b8' }}
                          />
                          <span className="flex-1 truncate">{c.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-muted-foreground">atual</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/30">
          <ChevronDown className="h-3 w-3 inline mr-1" />
          Mostra só categorias de despesa
        </div>
      </div>
    </>
  )
}
