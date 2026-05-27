'use client'

// Sprint 5.0.3.0c (c2) — Hook que gerencia preferências de tabela em localStorage.
//
// Preferências:
//   - density: 'compact' | 'normal' | 'comfortable'
//   - columnOrder: ordem das colunas (array de IDs)
//   - columnHidden: IDs das colunas escondidas
//
// SSR-safe — hidrata em useEffect (não acessa window na render server).
// Mobile (<768px) força density='compact' independente do localStorage.

import { useEffect, useState, useCallback } from 'react'

export type DensityLevel = 'compact' | 'normal' | 'comfortable'

export const DENSITY_LEVELS: ReadonlyArray<DensityLevel> = [
  'compact',
  'normal',
  'comfortable',
]

export const DENSITY_HEIGHTS: Record<DensityLevel, number> = {
  compact: 36,
  normal: 48,
  comfortable: 60,
}

export interface TablePreferences {
  density: DensityLevel
  columnOrder: string[]
  columnHidden: string[]
}

interface UseTablePreferencesArgs {
  /** Chave única no localStorage. Default: 'caixaos:contas-pagar:prefs'. */
  storageKey?: string
  /** IDs das colunas que NÃO podem ser escondidas. */
  alwaysVisible?: string[]
  /** IDs default na ordem original. Usado pra reset. */
  defaultColumnOrder?: string[]
  /** Default hidden colunas (ocultas por padrão). */
  defaultHidden?: string[]
}

const DEFAULT_STORAGE_KEY = 'caixaos:contas-pagar:prefs'
const MOBILE_BREAKPOINT = 768

const DEFAULT_PREFS: TablePreferences = {
  density: 'normal',
  columnOrder: [],
  columnHidden: [],
}

/**
 * Lê do localStorage de forma SSR-safe.
 * Retorna null se não tiver value OU se window.localStorage não existir
 * (SSR / private mode).
 */
function readFromStorage(key: string): TablePreferences | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validação shallow
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      DENSITY_LEVELS.includes(parsed.density) &&
      Array.isArray(parsed.columnOrder) &&
      Array.isArray(parsed.columnHidden)
    ) {
      return parsed as TablePreferences
    }
    return null
  } catch {
    return null
  }
}

function writeToStorage(key: string, prefs: TablePreferences): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(prefs))
  } catch {
    /* quota / private mode — falha silenciosa */
  }
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
}

export function useTablePreferences(
  args: UseTablePreferencesArgs = {},
): {
  prefs: TablePreferences
  setDensity: (d: DensityLevel) => void
  setColumnOrder: (order: string[]) => void
  setColumnHidden: (hidden: string[]) => void
  toggleColumnHidden: (columnId: string) => void
  isMobile: boolean
  /** density EFETIVA (force compact em mobile mesmo se user preferiu outra). */
  effectiveDensity: DensityLevel
  resetPrefs: () => void
} {
  const storageKey = args.storageKey ?? DEFAULT_STORAGE_KEY
  const alwaysVisible = args.alwaysVisible ?? []
  const defaultOrder = args.defaultColumnOrder ?? []
  const defaultHidden = args.defaultHidden ?? []

  const [prefs, setPrefs] = useState<TablePreferences>({
    ...DEFAULT_PREFS,
    columnOrder: defaultOrder,
    columnHidden: defaultHidden,
  })
  const [isMobile, setIsMobile] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage (após mount — SSR safe)
  useEffect(() => {
    const stored = readFromStorage(storageKey)
    if (stored) {
      setPrefs({
        density: stored.density,
        columnOrder: stored.columnOrder.length
          ? stored.columnOrder
          : defaultOrder,
        // Filtra alwaysVisible — defesa em profundidade
        columnHidden: stored.columnHidden.filter(
          (id) => !alwaysVisible.includes(id),
        ),
      })
    }
    setHydrated(true)
    setIsMobile(isMobileViewport())

    // Listen pra viewport changes
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Persist sempre que prefs mudar (depois de hydratar — evita overwrite)
  useEffect(() => {
    if (!hydrated) return
    writeToStorage(storageKey, prefs)
  }, [hydrated, storageKey, prefs])

  const setDensity = useCallback((d: DensityLevel) => {
    setPrefs((p) => ({ ...p, density: d }))
  }, [])

  const setColumnOrder = useCallback((order: string[]) => {
    setPrefs((p) => ({ ...p, columnOrder: order }))
  }, [])

  const setColumnHidden = useCallback(
    (hidden: string[]) => {
      // Filtra alwaysVisible
      const filtered = hidden.filter((id) => !alwaysVisible.includes(id))
      setPrefs((p) => ({ ...p, columnHidden: filtered }))
    },
    [alwaysVisible],
  )

  const toggleColumnHidden = useCallback(
    (columnId: string) => {
      if (alwaysVisible.includes(columnId)) return // defesa
      setPrefs((p) => {
        const set = new Set(p.columnHidden)
        if (set.has(columnId)) set.delete(columnId)
        else set.add(columnId)
        return { ...p, columnHidden: Array.from(set) }
      })
    },
    [alwaysVisible],
  )

  const resetPrefs = useCallback(() => {
    setPrefs({
      density: 'normal',
      columnOrder: defaultOrder,
      columnHidden: defaultHidden,
    })
  }, [defaultOrder, defaultHidden])

  // Effective density: mobile força compact
  const effectiveDensity: DensityLevel = isMobile ? 'compact' : prefs.density

  return {
    prefs,
    setDensity,
    setColumnOrder,
    setColumnHidden,
    toggleColumnHidden,
    isMobile,
    effectiveDensity,
    resetPrefs,
  }
}
