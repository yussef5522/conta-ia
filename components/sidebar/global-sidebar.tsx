'use client'

// Sprint 4.0.5.a — Sidebar única organizada por seções.
// User info movido pro TopBar UserMenu.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Calculator,
  MessageSquare,
  Clock,
  Wallet,
  Repeat,
  Users,
  Link2,
  Building2,
  Brain,
  Store,
  History,
  TrendingUp,
  Shield,
  ShieldCheck,
  FileText,
  Settings,
  Bell,
} from 'lucide-react'
import { SidebarItem } from './sidebar-item'
import { useSidebarBadges } from '@/lib/hooks/use-sidebar-badges'
import { useEmpresa } from '@/lib/contexts/empresa-context'

interface GlobalSidebarProps {
  userName?: string
  userEmail?: string
  onNavigate?: () => void
}

export function GlobalSidebar({ onNavigate }: GlobalSidebarProps) {
  const pathname = usePathname()
  const { currentEmpresaId } = useEmpresa()
  const [empresaIdForBadges, setEmpresaIdForBadges] = useState<string | null>(null)

  useEffect(() => {
    setEmpresaIdForBadges(currentEmpresaId)
  }, [currentEmpresaId])

  const badges = useSidebarBadges(empresaIdForBadges)
  const apBadge = badges?.contasAPagar
    ? badges.contasAPagar.vencidas + badges.contasAPagar.vencendoEm3Dias
    : 0
  const apTone: 'red' | 'amber' | 'neutral' = badges?.contasAPagar?.vencidas
    ? 'red'
    : badges?.contasAPagar?.vencendoEm3Dias
      ? 'amber'
      : 'neutral'
  const conciliacaoBadge = badges?.conciliacao?.pendentes ?? 0

  const empresaQs = currentEmpresaId ? `?empresaId=${currentEmpresaId}` : ''
  const empresaPathPrefix = currentEmpresaId ? `/empresas/${currentEmpresaId}` : '/empresas'

  return (
    <aside className="w-60 border-r bg-white flex flex-col h-full overflow-y-auto">
      <nav className="flex-1 py-3 px-2 space-y-0.5" aria-label="Menu principal">
        <SidebarItem
          icon={LayoutDashboard}
          label="Dashboard"
          href="/dashboard"
          isActive={pathname === '/dashboard'}
          onClick={onNavigate}
        />

        <SectionLabel>Financeiro</SectionLabel>
        <SidebarItem
          icon={Clock}
          label="Contas a Pagar"
          href={`/contas-a-pagar${empresaQs}`}
          isActive={pathname.startsWith('/contas-a-pagar')}
          onClick={onNavigate}
          badge={apBadge > 0 ? String(apBadge) : undefined}
          badgeTone={apTone}
        />
        <SidebarItem
          icon={Wallet}
          label="Contas a Receber"
          href={`/contas-a-receber${empresaQs}`}
          isActive={pathname.startsWith('/contas-a-receber')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Repeat}
          label="Recorrentes"
          href={`/recorrentes${empresaQs}`}
          isActive={pathname.startsWith('/recorrentes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Link2}
          label="Conciliação"
          href="/conciliacao"
          isActive={pathname.startsWith('/conciliacao')}
          onClick={onNavigate}
          badge={conciliacaoBadge > 0 ? String(conciliacaoBadge) : undefined}
          badgeTone="neutral"
        />
        <SidebarItem
          icon={ArrowLeftRight}
          label="Movimentações"
          href={`/transacoes${empresaQs}`}
          isActive={pathname.startsWith('/transacoes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={TrendingUp}
          label="DRE Gerencial"
          href={currentEmpresaId ? `${empresaPathPrefix}/dre` : '#'}
          isActive={pathname.includes('/dre')}
          onClick={onNavigate}
        />

        <SectionLabel>Cadastros</SectionLabel>
        <SidebarItem
          icon={Building2}
          label="Empresas"
          href="/empresas"
          isActive={pathname === '/empresas' || /^\/empresas\/[^/]+$/.test(pathname)}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Users}
          label="Clientes"
          href={`/clientes${empresaQs}`}
          isActive={pathname.startsWith('/clientes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Store}
          label="Fornecedores"
          href={currentEmpresaId ? `${empresaPathPrefix}/fornecedores` : '#'}
          isActive={pathname.includes('/fornecedores')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={FileText}
          label="Categorias"
          href={currentEmpresaId ? `${empresaPathPrefix}/categorias` : '#'}
          isActive={pathname.includes('/categorias')}
          onClick={onNavigate}
        />

        <SectionLabel>Inteligência</SectionLabel>
        <SidebarItem
          icon={Brain}
          label="Regras IA"
          href={currentEmpresaId ? `${empresaPathPrefix}/regras` : '#'}
          isActive={pathname.includes('/regras')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={History}
          label="Histórico OFX"
          href={currentEmpresaId ? `${empresaPathPrefix}/imports` : '#'}
          isActive={pathname.includes('/imports')}
          onClick={onNavigate}
        />

        <SectionLabel>Sistema</SectionLabel>
        <SidebarItem
          icon={Shield}
          label="Usuários"
          href={currentEmpresaId ? `${empresaPathPrefix}/usuarios` : '#'}
          isActive={pathname.includes('/usuarios')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={ShieldCheck}
          label="Permissões"
          href={currentEmpresaId ? `${empresaPathPrefix}/permissoes` : '#'}
          isActive={pathname.includes('/permissoes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={FileText}
          label="Auditoria"
          href={currentEmpresaId ? `${empresaPathPrefix}/auditoria` : '#'}
          isActive={pathname.includes('/auditoria')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Bell}
          label="Alertas"
          href="/configuracoes/alertas"
          isActive={pathname.startsWith('/configuracoes/alertas')}
          onClick={onNavigate}
        />

        <SectionLabel>Em breve</SectionLabel>
        <SidebarItem icon={Calculator} label="Impostos" href="#" isActive={false} isComingSoon />
        <SidebarItem icon={MessageSquare} label="Chat IA" href="#" isActive={false} isComingSoon />
        <SidebarItem icon={Settings} label="Configurações" href="#" isActive={false} isComingSoon />
      </nav>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
      {children}
    </p>
  )
}
