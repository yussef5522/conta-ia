'use client'

// Sprint Category-Combobox (29/06/2026) — seletor único Ramp/Mercury-grade.
//
// Substitui TODOS os dropdowns shadcn de categoria pelo combobox pesquisável.
// Características:
// - INPUT de busca: normaliza acento + case ("mater" acha "Matéria-Prima").
// - SUGESTÃO IA no topo (suggestedCategoryId, prop opcional) com selo.
// - AGRUPADO por dreGroup com label + bolinha colorida semântica.
// - TECLADO: setas ↑/↓ navegam, Enter seleciona, Esc fecha. Foco no input.
// - CRIAR INLINE: opção "Criar 'texto'" quando query não casa nada (callback
//   opcional onCreate; se ausente, esconde a opção).
// - Performance: client-side, lista típica < 200 categorias = OK sem virtualizar.
//
// Design system: shadcn Popover + Command (já no projeto). Sem gradient,
// radius-lg, 2 pesos de fonte, sentence case nos labels.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  CategoryLite,
  filterCategories,
  groupCategories,
  groupColor,
  normalizeText,
} from '@/lib/transacoes/category-search'
import {
  BridgeConviteModal,
  type BridgeConviteTxContext,
} from '@/components/bridges/BridgeConviteModal'

export interface CategoryComboboxProps {
  /** Categoria atualmente selecionada (null = nenhuma). */
  value: string | null
  /** Lista completa de categorias disponíveis (filtragem é client-side). */
  categorias: CategoryLite[]
  /** Categoria sugerida pela IA — exibida com selo no topo. Opcional. */
  suggestedCategoryId?: string | null
  /** Callback quando user escolhe. null = "sem categoria". */
  onChange: (categoryId: string | null) => void | Promise<void>
  /**
   * Callback quando user cria categoria nova inline. Recebe o nome digitado.
   * Se omitido, a opção "Criar" não aparece.
   */
  onCreate?: (name: string) => Promise<CategoryLite | null>
  /** Loader externo (ex: PATCH em andamento) — bloqueia interação. */
  disabled?: boolean
  /** Saving state interno do caller (ex: pós-onChange). */
  saving?: boolean
  /** Texto quando nada selecionado. */
  placeholder?: string
  /** Permite selecionar "Sem categoria" (vira null). Default: true. */
  allowClear?: boolean
  /** Classe externa pro botão trigger. */
  className?: string
  /** Aria label customizado. */
  ariaLabel?: string
  /**
   * Sprint Fluxo-Unificado-Retirada (30/06/2026) — convite pós-categorização.
   * Quando `askIfBridge=true` E o user escolhe uma categoria com
   * `dreGroup==='DISTRIBUICAO_LUCROS'` (ou nome Pró-labore), abre um modal
   * perguntando "Mandar pro PF?". Opt-in — telas que passam esse par de
   * props funcionam idêntico ao antes.
   */
  askIfBridge?: boolean
  /** Contexto da tx sendo categorizada — usado pelo modal do convite. */
  bridgeContext?: {
    txId: string
    amount: number
    description: string
    date: string
    empresaId: string
    /** SocioPF sugerido (se empresa tem 1 só, passa direto). */
    defaultSocioPFId?: string | null
  }
  /** Callback pós-criação da ponte no modal (refetch, etc). */
  onBridgeCreated?: (bridgeId: string) => void
}

export function CategoryCombobox({
  value,
  categorias,
  suggestedCategoryId,
  onChange,
  onCreate,
  disabled,
  saving,
  placeholder = 'Escolher categoria…',
  allowClear = true,
  className,
  ariaLabel = 'Escolher categoria',
  askIfBridge,
  bridgeContext,
  onBridgeCreated,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [focusIdx, setFocusIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Sprint Fluxo-Unificado-Retirada (30/06/2026): convite pós-categorização.
  const [conviteFor, setConviteFor] = useState<BridgeConviteTxContext | null>(null)

  const current = useMemo(
    () => categorias.find((c) => c.id === value) ?? null,
    [categorias, value],
  )
  const suggested = useMemo(
    () =>
      suggestedCategoryId
        ? categorias.find((c) => c.id === suggestedCategoryId) ?? null
        : null,
    [categorias, suggestedCategoryId],
  )

  // Filtragem + agrupamento
  const filtered = useMemo(
    () => filterCategories(categorias, query),
    [categorias, query],
  )
  const groups = useMemo(() => groupCategories(filtered), [filtered])

  // Lista linear de IDs pra navegação por teclado (Sugestão + agrupado).
  // Inclui o "Sem categoria" no topo se allowClear=true e query vazia.
  const linearIds = useMemo(() => {
    const ids: string[] = []
    if (allowClear && !query) ids.push('__NONE__')
    if (suggested && !query) ids.push(`__SUG__${suggested.id}`)
    for (const g of groups) {
      for (const item of g.items) {
        ids.push(item.cat.id)
      }
    }
    return ids
  }, [allowClear, query, suggested, groups])

  // Reset focus index quando muda a query
  useEffect(() => {
    setFocusIdx(0)
  }, [query])

  // Foco no input ao abrir
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
      setFocusIdx(0)
    }
  }, [open])

  async function pick(catId: string | null) {
    setOpen(false)
    setQuery('')
    if ((catId ?? null) === (current?.id ?? null)) return
    await onChange(catId)
    // Sprint Fluxo-Unificado-Retirada (30/06/2026): após salvar, se opt-in
    // e a categoria escolhida for DISTRIBUICAO_LUCROS ou Pró-labore, abre o
    // convite. Detecção via dreGroup + name (mesmo critério da fila).
    if (!askIfBridge || !catId || !bridgeContext) return
    const chosen = categorias.find((c) => c.id === catId)
    if (!chosen) return
    const isRetirada =
      chosen.dreGroup === 'DISTRIBUICAO_LUCROS' ||
      (chosen.dreGroup === 'DESPESAS_PESSOAL' &&
        /pro-labore|pro labore|prolabore/.test(
          normalizeText(chosen.name),
        ))
    if (isRetirada) {
      setConviteFor({
        txId: bridgeContext.txId,
        amount: bridgeContext.amount,
        description: bridgeContext.description,
        date: bridgeContext.date,
      })
    }
  }

  async function handleCreate() {
    if (!onCreate || !query.trim()) return
    setCreating(true)
    try {
      const nova = await onCreate(query.trim())
      if (nova) {
        await pick(nova.id)
      }
    } finally {
      setCreating(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(linearIds.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const id = linearIds[focusIdx]
      if (id === '__NONE__') {
        pick(null)
      } else if (id?.startsWith('__SUG__')) {
        pick(id.replace('__SUG__', ''))
      } else if (id) {
        pick(id)
      } else if (
        onCreate &&
        query.trim() &&
        filtered.length === 0
      ) {
        handleCreate()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const showCreate =
    !!onCreate &&
    query.trim().length > 0 &&
    !filtered.some(
      (s) => normalizeText(s.cat.name) === normalizeText(query),
    )

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled || saving}
          className={cn(
            'h-7 px-2 py-0 text-xs gap-1.5 bg-transparent border-dashed border-transparent hover:border-border hover:bg-muted/40 max-w-[280px] min-w-[140px] justify-between font-normal',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : current ? (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    current.color ?? groupColor(current.dreGroup),
                }}
              />
            ) : null}
            <span className="truncate">
              {current ? current.name : placeholder}
            </span>
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[320px]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-2 py-1.5">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar categoria…"
            className="w-full h-7 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
            aria-label="Buscar categoria"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {/* Sem categoria (limpar) */}
          {allowClear && !query && (
            <button
              type="button"
              onClick={() => pick(null)}
              onMouseEnter={() => setFocusIdx(linearIds.indexOf('__NONE__'))}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted',
                linearIds[focusIdx] === '__NONE__' && 'bg-muted',
              )}
            >
              <span className="h-2 w-2 rounded-full border border-muted-foreground/40 shrink-0" />
              <span className="text-muted-foreground italic">Sem categoria</span>
              {!value && <Check className="h-3 w-3 ml-auto text-primary" />}
            </button>
          )}

          {/* Sugestão IA destacada */}
          {suggested && !query && (
            <div className="border-y bg-primary/5">
              <div className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wide text-primary/70 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Sugestão da IA
              </div>
              <button
                type="button"
                onClick={() => pick(suggested.id)}
                onMouseEnter={() =>
                  setFocusIdx(linearIds.indexOf(`__SUG__${suggested.id}`))
                }
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/10',
                  linearIds[focusIdx] === `__SUG__${suggested.id}` &&
                    'bg-primary/10',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      suggested.color ?? groupColor(suggested.dreGroup),
                  }}
                />
                <span className="font-medium">{suggested.name}</span>
                {value === suggested.id && (
                  <Check className="h-3 w-3 ml-auto text-primary" />
                )}
              </button>
            </div>
          )}

          {/* Grupos */}
          {groups.length === 0 && !showCreate && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhuma categoria encontrada
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key} className="pt-1">
              <div className="px-3 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {g.label}
              </div>
              {g.items.map((s) => {
                const idx = linearIds.indexOf(s.cat.id)
                const focused = idx === focusIdx && idx !== -1
                return (
                  <button
                    key={s.cat.id}
                    type="button"
                    onClick={() => pick(s.cat.id)}
                    onMouseEnter={() => setFocusIdx(idx)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted',
                      focused && 'bg-muted',
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          s.cat.color ?? groupColor(s.cat.dreGroup),
                      }}
                    />
                    <span className="truncate">
                      {/* highlight do trecho que bateu */}
                      {s.matchStart >= 0 ? (
                        <>
                          {s.cat.name.slice(0, s.matchStart)}
                          <span className="font-medium underline decoration-primary/40 underline-offset-2">
                            {s.cat.name.slice(s.matchStart, s.matchEnd)}
                          </span>
                          {s.cat.name.slice(s.matchEnd)}
                        </>
                      ) : (
                        s.cat.name
                      )}
                    </span>
                    {value === s.cat.id && (
                      <Check className="h-3 w-3 ml-auto text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {/* Criar inline */}
          {showCreate && (
            <div className="border-t mt-1 pt-1">
              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Criar &quot;{query.trim()}&quot;
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
    {/* Sprint Fluxo-Unificado-Retirada (30/06/2026): convite pós-categorização. */}
    {conviteFor && bridgeContext && (
      <BridgeConviteModal
        open={!!conviteFor}
        onClose={() => setConviteFor(null)}
        empresaId={bridgeContext.empresaId}
        defaultSocioPFId={bridgeContext.defaultSocioPFId ?? null}
        txContext={conviteFor}
        onBridgeCreated={onBridgeCreated}
      />
    )}
    </>
  )
}
