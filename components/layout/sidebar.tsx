'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
  LayoutDashboard,
  Building2,
  Landmark,
  ArrowLeftRight,
  BarChart3,
  Calculator,
  MessageSquareText,
  Settings,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n/pt-BR'
import { Badge } from '@/components/ui/badge'

const navItems = [
  {
    label: t.nav.dashboard,
    href: '/dashboard',
    icon: LayoutDashboard,
    available: true,
  },
  {
    label: t.nav.empresas,
    href: '/empresas',
    icon: Building2,
    available: true,
  },
  {
    label: t.nav.contasBancarias,
    href: '/contas-bancarias',
    icon: Landmark,
    available: true,
  },
  {
    label: t.nav.transacoes,
    href: '/transacoes',
    icon: ArrowLeftRight,
    available: true,
  },
  {
    label: t.nav.relatorios,
    href: '/relatorios',
    icon: BarChart3,
    available: false,
  },
  {
    label: t.nav.impostos,
    href: '/impostos',
    icon: Calculator,
    available: false,
  },
  {
    label: t.nav.chatIA,
    href: '/chat-ia',
    icon: MessageSquareText,
    available: false,
  },
]

interface SidebarProps {
  userName: string
  userEmail: string
  onClose?: () => void
}

export function Sidebar({ userName, userEmail, onClose }: SidebarProps) {
  const pathname = usePathname()

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    onClose?.()
  }, [pathname])

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white flex-1">Conta IA</span>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-foreground/60 hover:text-white transition-colors p-1 rounded"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isAvailable = item.available

          if (!isAvailable) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-40 cursor-not-allowed"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-sidebar-border text-sidebar-foreground/60"
                >
                  breve
                </Badge>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-sidebar-foreground/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Configurações + Usuário */}
      <div className="border-t border-sidebar-border">
        <Link
          href="/configuracoes"
          className={cn(
            'flex items-center gap-3 px-6 py-3 text-sm transition-colors',
            pathname === '/configuracoes'
              ? 'text-white'
              : 'text-sidebar-foreground/60 hover:text-white'
          )}
        >
          <Settings className="h-4 w-4" />
          <span>{t.nav.configuracoes}</span>
        </Link>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sidebar-foreground/60 hover:text-white transition-colors p-1 rounded"
              title={t.nav.sair}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
