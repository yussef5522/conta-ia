'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  LayoutDashboard,
  Building2,
  ArrowRightLeft,
  TrendingUp,
  Users,
  Shield,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { SidebarItem } from './sidebar-item'
import { permissionMatches } from '@/lib/auth/permissions'

interface MeResponse {
  user: { id: string; name: string; email: string }
  company: { id: string; name: string; tradeName: string | null; sector: string | null }
  role: { id: string; name: string; isSystemDefault: boolean } | null
  permissions: string[]
}

interface MenuItemDef {
  icon: LucideIcon
  label: string
  hrefSuffix: string
  permission: string | null
  isComingSoon?: boolean
  badge?: string
}

interface MenuGroupDef {
  title: string
  items: MenuItemDef[]
}

const MENU_GROUPS: MenuGroupDef[] = [
  {
    title: 'Principal',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Visão Geral',
        hrefSuffix: '',
        permission: null,
        isComingSoon: true,
      },
      {
        icon: Building2,
        label: 'Contas Bancárias',
        hrefSuffix: '/contas',
        permission: 'bank_account.view',
      },
      {
        icon: ArrowRightLeft,
        label: 'Transações',
        hrefSuffix: '/pendentes',
        permission: 'transaction.view',
      },
      {
        icon: TrendingUp,
        label: 'DRE Gerencial',
        hrefSuffix: '/dre',
        permission: 'dre.view',
        badge: '⭐',
      },
    ],
  },
  {
    title: 'Gestão',
    items: [
      {
        icon: Users,
        label: 'Usuários',
        hrefSuffix: '/usuarios',
        permission: 'user.invite',
      },
      {
        icon: Shield,
        label: 'Permissões',
        hrefSuffix: '/permissoes',
        permission: 'role.view',
      },
      {
        icon: History,
        label: 'Auditoria',
        hrefSuffix: '/auditoria',
        permission: 'audit.view',
      },
    ],
  },
  {
    title: 'Configurações',
    items: [
      {
        icon: Settings,
        label: 'Configurações da Empresa',
        hrefSuffix: '/configuracoes',
        permission: 'company.update',
        isComingSoon: true,
      },
    ],
  },
]

interface Props {
  empresaId: string
  onNavigate?: () => void
}

export function ContextualSidebar({ empresaId, onNavigate }: Props) {
  const pathname = usePathname()
  const [data, setData] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMe = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/me`)
      if (!res.ok) {
        throw new Error('Erro ao carregar dados da empresa')
      }
      const json = (await res.json()) as MeResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  if (isLoading) {
    return (
      <aside className="w-60 border-r bg-card p-4 space-y-4">
        <div className="h-10 animate-pulse rounded bg-muted" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/50" />
        ))}
      </aside>
    )
  }

  if (error || !data) {
    return (
      <aside className="w-60 border-r bg-card p-4">
        <Link
          href="/empresas"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Empresas
        </Link>
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {error ?? 'Erro ao carregar'}
        </div>
      </aside>
    )
  }

  const empresaName = data.company.tradeName ?? data.company.name
  const userPermissions = data.permissions

  return (
    <aside className="w-60 border-r bg-card flex flex-col h-full">
      {/* Header empresa */}
      <div className="p-4 border-b">
        <Link
          href="/empresas"
          onClick={onNavigate}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Empresas
        </Link>

        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm truncate">{empresaName}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {data.role?.name ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Menu da empresa">
        {MENU_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.isComingSoon) return true
            if (item.permission === null) return true
            return permissionMatches(userPermissions, item.permission)
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={group.title} className="space-y-1">
              <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-1">
                {group.title}
              </h3>
              {visibleItems.map((item) => {
                const href = `/empresas/${empresaId}${item.hrefSuffix}`
                const isActive = item.hrefSuffix === ''
                  ? pathname === `/empresas/${empresaId}`
                  : pathname.startsWith(href)

                return (
                  <SidebarItem
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    href={href}
                    isActive={isActive}
                    badge={item.badge}
                    isComingSoon={item.isComingSoon}
                    onClick={onNavigate}
                  />
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t text-[10px] text-muted-foreground/60">
        <p>{data.user.name}</p>
        <p className="truncate">{data.user.email}</p>
      </div>
    </aside>
  )
}
