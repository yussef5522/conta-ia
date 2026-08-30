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
  Boxes,
  UtensilsCrossed,
  Factory,
  ShoppingCart,
  Package,
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
  ListChecks,
  Printer,
  Tag,
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
  // Sprint Fix-Badge-Contas-Pagar (05/07/2026): as tx RECEIVABLE ganham badge
  // próprio no menu "Contas a Receber". Antes elas somavam no apBadge (bug).
  // Same tone que ap — mas semanticamente é "aguardando dinheiro entrar",
  // não urgência de saída. Mantemos red/amber pra padrão consistente.
  const arBadge = badges?.contasAReceber
    ? badges.contasAReceber.vencidas + badges.contasAReceber.vencendoEm3Dias
    : 0
  const arTone: 'red' | 'amber' | 'neutral' = badges?.contasAReceber?.vencidas
    ? 'red'
    : badges?.contasAReceber?.vencendoEm3Dias
      ? 'amber'
      : 'neutral'
  const conciliacaoBadge = badges?.conciliacao?.pendentes ?? 0
  const pendentesBadge = badges?.transacoesPendentes ?? 0

  // ⛔ CHOKE-POINT (26/08) — em modo PF NÃO existe empresa ativa.
  //
  // O bug: ao trocar pro PF, `currentEmpresaId` continuava apontando pra última PJ, e
  // como TODO item de empresa é gated por `currentEmpresaId &&`, o menu inteiro da PJ
  // seguia visível e clicável. Clicar em "Cartões" dentro do PF levava à tela de
  // cartões da CAÇULA — cadastrar ali criaria um BusinessCreditCard na empresa errada.
  // O módulo de cartão PF nunca esteve quebrado: só não havia como chegar nele.
  //
  // ⚠️ Já sabiam disso: o efeito acima zera `empresaIdForBadges` no PF pelo MESMO
  // motivo ("badges mostravam dados de empresa que o user nem está visualizando") —
  // corrigiram os badges e deixaram os 30 itens do menu. Uma variável, não 30 ifs.
  const empresaAtiva = workspaceType === 'pf' ? null : currentEmpresaId
  const empresaQs = empresaAtiva ? `?empresaId=${empresaAtiva}` : ''

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
        {/* ⚠️ PJ-only: estes 4 leem a EMPRESA (contas a pagar/receber, conciliação e a
            fila de pendentes são do CNPJ). No PF eles apareciam apontando pra última
            empresa — agora somem, e a seção PF abaixo toma o lugar. */}
        {workspaceType !== 'pf' && (
        <>
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
          badge={arBadge > 0 ? String(arBadge) : undefined}
          badgeTone={arTone}
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
        </>
        )}
        {/* Sprint Central de Transferências — sidebar item dedicado */}
        {empresaAtiva && (
          <SidebarItem
            icon={ArrowLeftRight}
            label="Transferências"
            href={`/empresas/${empresaAtiva}/transferencias`}
            isActive={/^\/empresas\/[^/]+\/transferencias(\/|$)/.test(pathname) || pathname === '/transferencias'}
            onClick={onNavigate}
          />
        )}
        {empresaAtiva && (
          <SidebarItem
            icon={Store}
            label="Vendas"
            href={`/empresas/${empresaAtiva}/vendas`}
            isActive={/^\/empresas\/[^/]+\/vendas(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {empresaAtiva && (
          <SidebarItem
            icon={Wallet}
            label="Fluxo de caixa"
            href={`/empresas/${empresaAtiva}/fluxo-caixa`}
            isActive={/^\/empresas\/[^/]+\/fluxo-caixa(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {empresaAtiva && (
          <SidebarItem
            icon={HandCoins}
            label="Empréstimos"
            href={`/empresas/${empresaAtiva}/emprestimos`}
            isActive={/^\/empresas\/[^/]+\/emprestimos(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {empresaAtiva && (
          <SidebarItem
            icon={CreditCard}
            label="Cartões"
            href={`/empresas/${empresaAtiva}/cartoes`}
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
        {empresaAtiva && (
          <SidebarItem
            icon={TrendingDown}
            label="Despesas"
            href={`/empresas/${empresaAtiva}/despesas`}
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
        {/* ⭐ CARTÕES DO PF (26/08) — o item que FALTAVA. O módulo existe desde a
            Fatia 2 (`CreditCard` + `CreditCardInvoice`, com status de fatura de
            verdade) e estava 100% funcional, mas NENHUMA entrada de menu levava a
            ele: no PF o menu mostrava o "Cartões" da EMPRESA. */}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={CreditCard}
            label="Cartões"
            href={`/perfis/${currentProfileId}/cartoes`}
            isActive={/^\/perfis\/[^/]+\/cartoes(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={Landmark}
            label="Contas"
            href={`/perfis/${currentProfileId}/contas`}
            isActive={/^\/perfis\/[^/]+\/contas(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={ArrowLeftRight}
            label="Movimentações"
            href={`/perfis/${currentProfileId}/transacoes`}
            isActive={/^\/perfis\/[^/]+\/transacoes(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={Sparkles}
            label="Insights"
            href={`/perfis/${currentProfileId}/insights`}
            isActive={/^\/perfis\/[^/]+\/insights(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {workspaceType === 'pf' && currentProfileId && (
          <SidebarItem
            icon={History}
            label="Importar extrato"
            href={`/perfis/${currentProfileId}/importar`}
            isActive={/^\/perfis\/[^/]+\/(importar|imports)(\/|$)/.test(pathname)}
            onClick={onNavigate}
          />
        )}
        {/* Hotfix 5.0.4.0a-fix — Relatórios substituiu DRE Gerencial.
            Index per-empresa contém DRE + Categorias + Comparativo. */}
        <SidebarItem
          icon={BarChart3}
          label="Relatórios"
          href={empresaAtiva ? `/empresas/${empresaAtiva}/relatorios` : '/relatorios'}
          isActive={
            pathname === '/relatorios' ||
            pathname.startsWith('/relatorios/') ||
            /^\/empresas\/[^/]+\/relatorios(\/|$)/.test(pathname)
          }
          onClick={onNavigate}
        />

        {/* Estoque — módulo NOVO, seção própria (não dentro de Financeiro). FASE 0:
            só o Certificado. Cresce com Recebimentos/Estoque/Produção nas fases. */}
        {empresaAtiva && (
          <>
            <SectionLabel>Estoque</SectionLabel>
            {/* ⭐ CARDÁPIO NO TOPO (27/08) — é o hub do dono: a lista do que se VENDE, com
                receita, custo e margem. Ponto de partida de tudo (padrão menu-first dos
                líderes), por isso vem antes das telas de operação. */}
            <SidebarItem
              icon={UtensilsCrossed}
              label="Cardápio"
              href={`/empresas/${empresaAtiva}/estoque/cardapio`}
              isActive={/^\/empresas\/[^/]+\/estoque\/cardapio/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Inbox}
              label="Recebimentos"
              href={`/empresas/${empresaAtiva}/estoque/recebimentos`}
              isActive={/^\/empresas\/[^/]+\/estoque\/recebimentos/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Boxes}
              label="Posição"
              href={`/empresas/${empresaAtiva}/estoque/posicao`}
              isActive={/^\/empresas\/[^/]+\/estoque\/posicao/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Package}
              label="Catálogo"
              href={`/empresas/${empresaAtiva}/estoque/itens`}
              isActive={/^\/empresas\/[^/]+\/estoque\/itens$/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={ArrowLeftRight}
              label="Movimentos"
              href={`/empresas/${empresaAtiva}/estoque/movimentos`}
              isActive={/^\/empresas\/[^/]+\/estoque\/movimentos/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={ListChecks}
              label="Contagem"
              href={`/empresas/${empresaAtiva}/estoque/contagem`}
              isActive={/^\/empresas\/[^/]+\/estoque\/contag/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Scale}
              label="Real vs Teórico"
              href={`/empresas/${empresaAtiva}/estoque/real-vs-teorico`}
              isActive={/^\/empresas\/[^/]+\/estoque\/real-vs-teorico/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Receipt}
              label="Boletos p/ pagar"
              href={`/empresas/${empresaAtiva}/estoque/contas-a-pagar`}
              isActive={/^\/empresas\/[^/]+\/estoque\/contas-a-pagar/.test(pathname)}
              onClick={onNavigate}
            />
            {/* ⚠️ "Fichas técnicas" SAIU da sidebar (27/08) — era uma lista MISTA (produto
                vendido + intermediário de cozinha) que atendia mal os dois. Cada mundo abre
                a sua: o dono pelo Cardápio, a cozinha por Produção → Receitas. A rota
                /estoque/fichas continua viva pra links antigos não quebrarem. */}
            <SidebarItem
              icon={Factory}
              label="Produção"
              href={`/empresas/${empresaAtiva}/estoque/producao`}
              isActive={/^\/empresas\/[^/]+\/estoque\/producao(?!\/cadastros)/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={ShoppingCart}
              label="Vendas (Suitable)"
              href={`/empresas/${empresaAtiva}/estoque/vendas`}
              isActive={/^\/empresas\/[^/]+\/estoque\/vendas/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Tag}
              label="Etiquetas"
              href={`/empresas/${empresaAtiva}/estoque/etiquetas`}
              isActive={/^\/empresas\/[^/]+\/estoque\/etiquetas/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={Printer}
              label="Impressão"
              href={`/empresas/${empresaAtiva}/estoque/impressao`}
              isActive={/^\/empresas\/[^/]+\/estoque\/impressao/.test(pathname)}
              onClick={onNavigate}
            />
            <SidebarItem
              icon={ShieldCheck}
              label="Certificado"
              href={`/empresas/${empresaAtiva}/estoque/certificado`}
              isActive={/^\/empresas\/[^/]+\/estoque\/certificado/.test(pathname)}
              onClick={onNavigate}
            />
          </>
        )}

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
            empresaAtiva
              ? `/empresas/${empresaAtiva}/contas`
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
        {empresaAtiva && (
          <SidebarItem
            icon={Users}
            label="Sócios"
            href={`/empresas/${empresaAtiva}/socios`}
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
