'use client'

// Sprint PF FATIA 1 — WorkspaceContext (evolução do EmpresaContext).
//
// Adiciona suporte ao tipo PERFIL PESSOAL FÍSICO além das empresas PJ.
// O EmpresaContext antigo continua existindo (não quebramos páginas PJ
// existentes). Este context É SUPLEMENTAR — usado por:
//   - WorkspaceSwitcher (dual PJ/PF)
//   - Páginas /perfis/[id]/*
//   - Sidebar adaptativa (detecta contexto ativo)
//
// Persistência:
//   - localStorage: caixaos:workspace:type ('pj' | 'pf') + id atual
//   - URL ganha (path /empresas/[id] ou /perfis/[id])
//
// 🟦 PJ = azul (Building2)  ·  🟢 PF = verde (Users)

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export type WorkspaceType = 'pj' | 'pf'

export interface ProfileMini {
  id: string
  name: string
  cpf: string | null
  type: string // OWN | DEPENDENT
  isSelf: boolean
  role: string
}

interface WorkspaceContextValue {
  /** Tipo do workspace ativo */
  workspaceType: WorkspaceType
  /** Lista de perfis PF que o user tem acesso */
  profiles: ProfileMini[]
  /** Loading da fetch inicial dos perfis */
  loadingProfiles: boolean
  /** Refetch perfis (chama após criar/editar) */
  reloadProfiles: () => Promise<void>
  /** Define workspace ativo (atualiza localStorage + cookie) */
  setWorkspace: (type: WorkspaceType, id?: string | null) => Promise<void>
  /** ID do perfil PF atual (null se workspace=pj) */
  currentProfileId: string | null
  /** Perfil PF atual (null se workspace=pj) */
  currentProfile: ProfileMini | null
}

const Ctx = createContext<WorkspaceContextValue | null>(null)

const STORAGE_TYPE = 'caixaos:workspace:type'
const STORAGE_PROFILE = 'caixaos:workspace:profileId'
const PATH_PROFILE_RE = /^\/perfis\/([a-z0-9]{20,30})(\/|$)/i

function getInitialType(): WorkspaceType {
  if (typeof window === 'undefined') return 'pj'
  try {
    const v = window.localStorage.getItem(STORAGE_TYPE)
    return v === 'pf' ? 'pf' : 'pj'
  } catch {
    return 'pj'
  }
}

function getInitialProfile(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_PROFILE)
  } catch {
    return null
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [profiles, setProfiles] = useState<ProfileMini[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('pj')
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)

  const reloadProfiles = useCallback(async () => {
    setLoadingProfiles(true)
    try {
      const res = await fetch('/api/perfis', { credentials: 'include' })
      if (!res.ok) {
        setProfiles([])
        return
      }
      const data = await res.json()
      setProfiles((data.profiles ?? []) as ProfileMini[])
    } catch {
      setProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }, [])

  // Mount: hidrata estado + busca perfis
  useEffect(() => {
    setWorkspaceType(getInitialType())
    setCurrentProfileId(getInitialProfile())
    void reloadProfiles()
  }, [reloadProfiles])

  // URL é source-of-truth: path /perfis/[id] força workspace=pf + id
  useEffect(() => {
    const match = pathname.match(PATH_PROFILE_RE)
    if (match) {
      const fromPath = match[1]
      if (workspaceType !== 'pf' || currentProfileId !== fromPath) {
        setWorkspaceType('pf')
        setCurrentProfileId(fromPath)
        try {
          window.localStorage.setItem(STORAGE_TYPE, 'pf')
          window.localStorage.setItem(STORAGE_PROFILE, fromPath)
        } catch {
          // quota
        }
      }
    }
    // path /empresas/[id] força workspace=pj (mas EmpresaContext já lida)
    else if (pathname.startsWith('/empresas/') && workspaceType !== 'pj') {
      setWorkspaceType('pj')
      try {
        window.localStorage.setItem(STORAGE_TYPE, 'pj')
      } catch {
        // quota
      }
    }
  }, [pathname, workspaceType, currentProfileId])

  const setWorkspace = useCallback(
    async (type: WorkspaceType, id?: string | null): Promise<void> => {
      setWorkspaceType(type)
      try {
        window.localStorage.setItem(STORAGE_TYPE, type)
      } catch {
        // quota
      }
      // Bug 2 fix: sempre sincronizar cookie de workspace type pra
      // Server Components decidirem redirect (PF→/perfis, PJ→/dashboard).
      try {
        await fetch('/api/workspace/atual', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
      } catch {
        // ignore
      }
      if (type === 'pf' && id) {
        setCurrentProfileId(id)
        try {
          window.localStorage.setItem(STORAGE_PROFILE, id)
        } catch {
          // quota
        }
        // Sync cookie httpOnly pra Server Components lerem
        try {
          await fetch('/api/perfis/atual', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: id }),
          })
        } catch {
          // ignore
        }
      }
    },
    [],
  )

  const currentProfile =
    profiles.find((p) => p.id === currentProfileId) ?? null

  const value: WorkspaceContextValue = {
    workspaceType,
    profiles,
    loadingProfiles,
    reloadProfiles,
    setWorkspace,
    currentProfileId,
    currentProfile,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('useWorkspace precisa estar dentro de <WorkspaceProvider>')
  }
  return ctx
}

// Pra testes
export const __test = { PATH_PROFILE_RE }
