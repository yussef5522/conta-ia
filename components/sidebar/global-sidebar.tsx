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
  BarChart3,
  Shield,
  ShieldCheck,
  FileText,
  Settings,
  Bell,
  Receipt,
  Scale,
  BookOpen,
  Sparkles,
  Landmark,
  Inbox,
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
  const pendentesBadge = badges?.transacoesPendentes ?? 0

  const empresaQs = currentEmpresaId ? `?empresaId=${currentEmpresaId}` : ''

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
          icon={Landmark}
          label="Bancos"
          href={`/bancos${empresaQs}`}
          isActive={pathname.startsWith('/bancos')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={Inbox}
          label="Pendentes"
          href={`/pendentes${empresaQs}`}
          isActive={pathname.startsWith('/pendentes')}
          onClick={onNavigate}
          badge={pendentesBadge > 0 ? String(pendentesBadge) : undefined}
          badgeTone="amber"
        />
        <SidebarItem
          icon={Users}
          label="Pessoas Vinculadas"
          href={`/pessoas-vinculadas${empresaQs}`}
          isActive={pathname.startsWith('/pessoas-vinculadas')}
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
        {/* Hotfix 5.0.4.0a-fix — Relatórios substituiu DRE Gerencial.
            Index per-empresa contém DRE + Categorias + Comparativo. */}
        <SidebarItem
          icon={BarChart3}
          label="Relatórios"
          href={currentEmpresaId ? `/empresas/${currentEmpresaId}/relatorios` : '/relatorios'}
          isActive={
            pathname === '/relatorios' ||
            pathname.startsWith('/relatorios/') ||
            /^\/empresas\/[^/]+\/relatorios(\/|$)/.test(pathname)
          }
          onClick={onNavigate}
        />

        <SectionLabel>Tributário</SectionLabel>
        <SidebarItem
          icon={Receipt}
          label="Tributário"
          href="/tributario"
          isActive={pathname.startsWith('/tributario')}
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
          href="/fornecedores"
          isActive={pathname.startsWith('/fornecedores')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={FileText}
          label="Categorias"
          href="/categorias"
          isActive={pathname.startsWith('/categorias')}
          onClick={onNavigate}
        />

        <SectionLabel>Inteligência</SectionLabel>
        <SidebarItem
          icon={Brain}
          label="Regras IA"
          href="/regras"
          isActive={pathname.startsWith('/regras')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={History}
          label="Histórico OFX"
          href="/imports"
          isActive={pathname.startsWith('/imports')}
          onClick={onNavigate}
        />

        <SectionLabel>Sistema</SectionLabel>
        <SidebarItem
          icon={Shield}
          label="Usuários"
          href="/usuarios"
          isActive={pathname.startsWith('/usuarios')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={ShieldCheck}
          label="Permissões"
          href="/permissoes"
          isActive={pathname.startsWith('/permissoes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={FileText}
          label="Auditoria"
          href="/auditoria"
          isActive={pathname.startsWith('/auditoria')}
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
