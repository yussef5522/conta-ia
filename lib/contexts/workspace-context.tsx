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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
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

  // URL é source-of-truth APENAS em NAVEGAÇÃO REAL.
  //
  // Sprint workspace-fix (bug PF→PJ indicador preso): o effect anterior tinha
  // `workspaceType` e `currentProfileId` nas deps, o que fazia o effect rodar
  // quando o switcher chamava `setWorkspace('pj')`. Como `router.push` é
  // async, na próxima render o pathname AINDA era `/perfis/[id]` → o regex
  // casava → effect REVERTIA o state pra 'pf'. Só pathname deve disparar
  // esse effect — quando o usuário navega de verdade.
  //
  // Pra evitar lint warning sobre deps faltantes, rastreamos o pathname
  // anterior numa ref. O effect roda só quando pathname mudou.
  const lastProcessedPath = useRef<string | null>(null)
  useEffect(() => {
    if (lastProcessedPath.current === pathname) return
    lastProcessedPath.current = pathname

    const match = pathname.match(PATH_PROFILE_RE)
    if (match) {
      // Entrou em /perfis/[id] → força pf + id (cobre links externos /
      // back/forward que pulam o switcher)
      const fromPath = match[1]
      setWorkspaceType('pf')
      setCurrentProfileId(fromPath)
      try {
        window.localStorage.setItem(STORAGE_TYPE, 'pf')
        window.localStorage.setItem(STORAGE_PROFILE, fromPath)
      } catch {
        // quota
      }
    } else if (pathname.startsWith('/empresas/')) {
      // Entrou em /empresas/[id] → força pj (mesma razão acima)
      setWorkspaceType('pj')
      try {
        window.localStorage.setItem(STORAGE_TYPE, 'pj')
      } catch {
        // quota
      }
    }
    // Outras rotas (/dashboard, /transacoes, etc): NÃO força nada.
    // Respeita o último setWorkspace do switcher.
  }, [pathname])

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
