'use client'

// Sprint 4.0.5.a — EmpresaContext global.
//
// Compartilha currentEmpresaId entre toda a app. Persistido em localStorage
// pra sobreviver refresh. Sincronizado com:
//   - path /empresas/[id]/* (URL ganha)
//   - query ?empresaId= (URL ganha)
//   - localStorage (fallback)
//   - 1ª empresa do user (último fallback se nada definido)
//
// Provider envolto pelo layout dashboard pra estar disponível em toda página.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

export interface EmpresaMini {
  id: string
  name: string
  tradeName: string | null
}

interface EmpresaContextValue {
  currentEmpresaId: string | null
  currentEmpresa: EmpresaMini | null
  empresas: EmpresaMini[]
  loading: boolean
  setCurrentEmpresa: (id: string) => void
  reloadEmpresas: () => Promise<void>
}

const STORAGE_KEY = 'caixaos:empresa-context:current'

const Ctx = createContext<EmpresaContextValue | null>(null)

const PATH_EMPRESA_RE = /^\/empresas\/([a-z0-9]{20,30})(\/|$)/i

function getInitialFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [empresas, setEmpresas] = useState<EmpresaMini[]>([])
  const [loading, setLoading] = useState(true)
  const [currentEmpresaId, setCurrentEmpresaIdState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Carrega lista de empresas 1x ao montar
  const reloadEmpresas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/empresas', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const list: EmpresaMini[] = (data.empresas ?? []).map(
        (e: { id: string; name: string; tradeName: string | null }) => ({
          id: e.id,
          name: e.name,
          tradeName: e.tradeName,
        }),
      )
      setEmpresas(list)
    } catch {
      // silent — sem empresas é estado válido
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadEmpresas()
  }, [reloadEmpresas])

  // Hidrata currentEmpresaId na ordem de prioridade:
  //   1. path /empresas/[id]/*
  //   2. ?empresaId=
  //   3. localStorage
  //   4. 1ª empresa do user
  useEffect(() => {
    if (hydrated && empresas.length === 0) return
    const pathMatch = pathname.match(PATH_EMPRESA_RE)
    const fromPath = pathMatch ? pathMatch[1] : null
    const fromQuery = searchParams.get('empresaId')
    const fromStorage = getInitialFromStorage()

    let next: string | null = fromPath ?? fromQuery ?? fromStorage ?? null
    // Se next existe MAS não está na lista, descarta
    if (next && empresas.length > 0 && !empresas.some((e) => e.id === next)) {
      next = null
    }
    if (!next && empresas.length > 0) {
      next = empresas[0].id
    }

    if (next && next !== currentEmpresaId) {
      setCurrentEmpresaIdState(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore quota errors
      }
      // Sprint 4.0.5.b — sincroniza cookie httpOnly pra server pages globais lerem
      void fetch('/api/empresas/atual', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: next }),
      }).catch(() => {})
    }
    if (!hydrated) setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, empresas])

  const setCurrentEmpresa = useCallback((id: string) => {
    setCurrentEmpresaIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore
    }
    // Sprint 4.0.5.b — sincroniza cookie httpOnly pra server pages globais
    void fetch('/api/empresas/atual', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: id }),
    }).catch(() => {})

    // Sprint 5.0.3.2 — Navegação reativa ao trocar empresa.
    // Antes: contexto atualizava state mas página atual continuava lendo
    // `?empresaId=` ou `?empresa=` antigo da URL → stale data até reload manual.
    //
    // 3 caminhos pra refletir mudança:
    //   1. Path `/empresas/[oldId]/...` → navega pra `/empresas/[newId]/...`
    //   2. URL tem `?empresaId=` ou `?empresa=` → substitui pelo novo ID
    //   3. Página global sem empresa na URL → router.refresh()
    const pathMatch = pathname.match(PATH_EMPRESA_RE)
    if (pathMatch) {
      const oldId = pathMatch[1]
      if (oldId !== id) {
        const newPath = pathname.replace(oldId, id)
        const qs = searchParams.toString()
        router.push(qs ? `${newPath}?${qs}` : newPath)
      }
    } else {
      const params = new URLSearchParams(searchParams.toString())
      const hasEmpresaId = params.has('empresaId')
      const hasEmpresa = params.has('empresa')
      if (hasEmpresaId || hasEmpresa) {
        if (hasEmpresaId) params.set('empresaId', id)
        if (hasEmpresa) params.set('empresa', id)
        router.replace(`${pathname}?${params.toString()}`)
      } else {
        // Página global sem empresa na URL — força re-render do server
        router.refresh()
      }
    }
  }, [pathname, searchParams, router])

  const currentEmpresa = empresas.find((e) => e.id === currentEmpresaId) ?? null

  const value: EmpresaContextValue = {
    currentEmpresaId,
    currentEmpresa,
    empresas,
    loading,
    setCurrentEmpresa,
    reloadEmpresas,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('useEmpresa precisa estar dentro de <EmpresaProvider>')
  }
  return ctx
}

// Pra testes: extração da regex de path
export const __test = { PATH_EMPRESA_RE }
