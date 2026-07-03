'use client'

// Sprint 4.0.5.a — Sidebar única organizada por seções.
// User info movido pro TopBar UserMenu.
// Sprint Brand CAIXAOS (29/05/2026) — logo horizontal no header.
// Hotfix sidebar-remove-logo (29/05/2026) — logo do header REMOVIDO
// (duplicava o breadcrumb do TopBar).

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
  TrendingDown,
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
  HandCoins,
  CreditCard,
  Inbox,
  Workflow,
} from 'lucide-react'
import { SidebarItem } from './sidebar-item'
import { useSidebarBadges } from '@/lib/hooks/use-sidebar-badges'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { useWorkspace } from '@/lib/contexts/workspace-context'

interface GlobalSidebarProps {
  userName?: string
  userEmail?: string
  onNavigate?: () => void
}

export function GlobalSidebar({ onNavigate }: GlobalSidebarProps) {
  const pathname = usePathname()
  const { currentEmpresaId } = useEmpresa()
  const { workspaceType, currentProfileId } = useWorkspace()
  const [empresaIdForBadges, setEmpresaIdForBadges] = useState<string | null>(null)

  // Sprint Sidebar-Badges-Sync: zera badges quando workspace é PF (badges são
  // PJ-only — Contas a Pagar/Receber, Conciliação, Pendentes referem a empresa).
  // Antes: ao trocar pra PF, currentEmpresaId continuava apontando pra última
  // PJ → badges mostravam dados de empresa que o user nem está visualizando.
  useEffect(() => {
    if (workspaceType === 'pf') {
      setEmpresaIdForBadges(null)
    } else {
      setEmpresaIdForBadges(currentEmpresaId)
    }
  }, [currentEmpresaId, workspaceType])

  const badges = useSidebarBadges(empresaIdForBadges)

  // Sprint Fluxo-Unificado-Retirada (30/06/2026): contador da fila de
  // retiradas pendentes (badge no item Sócios). Fetch 1x por empresa
  // (endpoint tem cache 60s). Silencioso — badges são best-effort.
  const [retiradasPendentesCount, setRetiradasPendentesCount] = useState<number | null>(null)
  useEffect(() => {
    if (!empresaIdForBadges) {
      setRetiradasPendentesCount(null)
      return
    }
    let cancelled = false
    fetch(`/api/empresas/${empresaIdForBadges}/retiradas-pendentes`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j && typeof j.total === 'number') {
          setRetiradasPendentesCount(j.total)
        }
      })
      .catch(() => {
        /* silent */
      })
    return () => {
      cancelled = true
    }
  }, [empresaIdForBadges])
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
      {/* Hotfix sidebar-remove-logo (29/05/2026): bloco do logo do header
          REMOVIDO. Logo já aparece no breadcrumb do TopBar — 2 logos
          empilhados poluem. Mantém só o padding pra não colar Dashboard
          na borda superior. */}
      <nav className="flex-1 py-3 px-2 space-y-0.5" aria-label="Menu principal">
        <SidebarItem
          icon={LayoutDashboard}
          label="Dashboard"
          href="/dashboard"
          isActive={pathname === '/dashboard'}
          onClick={onNavigate}
        />

        {/* Sprint Sidebar-Reorder — ordem segue fluxo de trabalho real:
            cadastrar contas → conciliar → categorizar → conferir relatório.
            Bancos virou Cadastro (configura uma vez); Relatórios por último. */}
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
          icon={Link2}
          label="Conciliação"
          href="/conciliacao"
          isActive={pathname.startsWith('/conciliacao')}
          onClick={onNavigate}
          badge={conciliacaoBadge > 0 ? String(conciliacaoBadge) : undefined}
          badgeTone="neutral"
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
        {/* Sprint Central de Transferências — sidebar item dedicado */}
        {currentEmpresaId && (
          <SidebarItem
            icon={ArrowLeftRight}
            label="Transferências"
            href={`/empresas/${currentEmpresaId}/transferencias`}
            isActive={/^\/empresas\/[^/]+\/transferencias(\/|$)/.test(pathname) || pathname === '/transferencias'}
            onClick={onNavigate}
          />
        )}
        {currentEmpresaId && (
          <SidebarItem
            icon={HandCoins}
            label="Empréstimos"
            href={`/empresas/${currentEmpresaId}/emprestimos`}
            isActive={/^\/empresas\/[^/]+\/emprestimos(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {currentEmpresaId && (
          <SidebarItem
            icon={CreditCard}
            label="Cartões"
            href={`/empresas/${currentEmpresaId}/cartoes`}
            isActive={/^\/empresas\/[^/]+\/cartoes(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        <SidebarItem
          icon={Repeat}
          label="Recorrentes"
          href={`/recorrentes${empresaQs}`}
          isActive={pathname.startsWith('/recorrentes')}
          onClick={onNavigate}
        />
        <SidebarItem
          icon={ArrowLeftRight}
          label="Movimentações"
          href={`/transacoes${empresaQs}`}
          isActive={pathname.startsWith('/transacoes')}
          onClick={onNavigate}
        />
        {/* Sprint 6 — Despesas (drill-down do Top 5 do dashboard). Mesma
            fonte do motor único; total bate com despesaOperacional do
            dashboard ao centavo. */}
        {currentEmpresaId && (
          <SidebarItem
            icon={TrendingDown}
            label="Despesas"
            href={`/empresas/${currentEmpresaId}/despesas`}
            isActive={/^\/empresas\/[^/]+\/despesas(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {/* Sprint Despesas-PF (02/07/2026): tela dedicada de despesas do
            perfil pessoal. Antes o botão "Nova despesa" ficava enterrado
            em /perfis/[id]/transacoes. Agora Despesas é lugar próprio no
            workspace PF — visual Monarch/Copilot + marcador Retirada PJ. */}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={TrendingDown}
            label="Despesas"
            href={`/perfis/${currentProfileId}/despesas`}
            isActive={/^\/perfis\/[^/]+\/despesas(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {/* Sprint Receitas-PF (02/07/2026): irmã de Despesas. Visão
            unificada do que entrou (retiradas PJ + rendas externas) com
            selo de origem por empresa — diferencial único CAIXAOS. */}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={TrendingUp}
            label="Receitas"
            href={`/perfis/${currentProfileId}/receitas`}
            isActive={/^\/perfis\/[^/]+\/receitas(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
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
        {/* Sprint Unificar-Contas (08/06/2026): item Bancos REATIVO ao
            workspace. PJ → /empresas/[id]/contas (tela completa unificada,
            cobre bancos + Caixa); fallback /empresas se sem contexto.
            Mesma técnica do item Categorias (Sprint Categorias-PF-Nav). */}
        <SidebarItem
          icon={Landmark}
          label="Bancos"
          href={
            currentEmpresaId
              ? `/empresas/${currentEmpresaId}/contas`
              : '/empresas'
          }
          isActive={
            /^\/empresas\/[^/]+\/contas(\/|$)/.test(pathname) ||
            pathname.startsWith('/bancos') ||
            pathname === '/contas-bancarias'
          }
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
        {/* Sprint Categorias-PF-Nav (07/06/2026): item REATIVO ao workspace.
            Em PF, vai pras categorias do PERFIL (plano pessoal); em PJ,
            vai pro Plano de Contas da EMPRESA. Antes dava sempre /categorias
            (PJ) — confundia cliente que estava em PF. */}
        <SidebarItem
          icon={FileText}
          label="Categorias"
          href={
            workspaceType === 'pf' && currentProfileId
              ? `/perfis/${currentProfileId}/categorias`
              : '/categorias'
          }
          isActive={
            workspaceType === 'pf'
              ? /^\/perfis\/[^/]+\/categorias(\/|$)/.test(pathname)
              : pathname.startsWith('/categorias')
          }
          onClick={onNavigate}
        />
        {/* Sprint Unificar Sócios (03/06/2026) — substitui "Pessoas Vinculadas"
            + "Pontes PJ→PF". 1 item só com 2 abas: Sócios PF | Empresas do Grupo.
            Privacidade Fatia 4 mantida (queries filtradas por user).
            Sprint Sidebar-Reorder — movido de Financeiro pra Cadastros. */}
        {currentEmpresaId && (
          <SidebarItem
            icon={Users}
            label="Sócios"
            href={`/empresas/${currentEmpresaId}/socios`}
            isActive={
              /^\/empresas\/[^/]+\/socios(\/|$)/.test(pathname) ||
              /^\/empresas\/[^/]+\/pontes(\/|$)/.test(pathname) ||
              pathname.startsWith('/pontes/') ||
              pathname.startsWith('/pessoas-vinculadas')
            }
            /* Sprint Fluxo-Unificado-Retirada (30/06/2026): badge âmbar
               destaca fila de retiradas pendentes. Neutro/omitido quando 0. */
            badge={
              retiradasPendentesCount !== null && retiradasPendentesCount > 0
                ? String(retiradasPendentesCount)
                : undefined
            }
            badgeTone="amber"
            onClick={onNavigate}
          />
        )}

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
