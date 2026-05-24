'use client'

import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  Calculator,
  MessageSquare,
  Settings,
  LogOut,
  Clock,
  Wallet,
  Repeat,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { SidebarItem } from './sidebar-item'

interface GlobalSidebarProps {
  userName: string
  userEmail: string
  onNavigate?: () => void
}

export function GlobalSidebar({ userName, userEmail, onNavigate }: GlobalSidebarProps) {
  const pathname = usePathname()

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="w-56 border-r bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <span className="font-bold">Conta IA</span>
        </Link>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Menu principal">
        <SidebarItem
          icon={LayoutDashboard}
          label="Dashboard"
          href="/dashboard"
          isActive={pathname === '/dashboard'}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Building2}
          label="Empresas"
          href="/empresas"
          isActive={pathname.startsWith('/empresas')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={ArrowLeftRight}
          label="Transações"
          href="/transacoes"
          isActive={pathname.startsWith('/transacoes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Clock}
          label="Contas a Pagar"
          href="/contas-a-pagar"
          isActive={pathname.startsWith('/contas-a-pagar')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Wallet}
          label="Contas a Receber"
          href="/contas-a-receber"
          isActive={pathname.startsWith('/contas-a-receber')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Repeat}
          label="Recorrentes"
          href="/recorrentes"
          isActive={pathname.startsWith('/recorrentes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Users}
          label="Clientes"
          href="/clientes"
          isActive={pathname.startsWith('/clientes')}
          onClick={onNavigate}
        />

        {/* Separador */}
        <div className="my-2 border-t" />

        {/* Itens "breve" */}
        <SidebarItem
          icon={Calculator}
          label="Impostos"
          href="#"
          isActive={false}
          isComingSoon
        />
        <SidebarItem
          icon={MessageSquare}
          label="Chat IA"
          href="#"
          isActive={false}
          isComingSoon
        />
      </nav>

      {/* Footer: Configurações + avatar + logout */}
      <div className="border-t">
        <div className="p-3 space-y-1">
          <SidebarItem
            icon={Settings}
            label="Configurações"
            href="/configuracoes"
            isActive={pathname.startsWith('/configuracoes')}
            isComingSoon
            onClick={onNavigate}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-3 border-t min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{userName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{userEmail}</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
