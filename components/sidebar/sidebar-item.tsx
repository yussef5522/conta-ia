'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { usePermissaoMenu } from './permissoes-menu'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  href: string
  isActive: boolean
  badge?: string
  // Sprint 4.0.3 — tone semântico pro badge (cor)
  badgeTone?: 'red' | 'amber' | 'neutral'
  isComingSoon?: boolean
  onClick?: () => void
  /**
   * ⭐⭐ A PERMISSÃO QUE ESTE ITEM EXIGE (30/08/2026) — obrigatória.
   *
   * ⚠️ DEFAULT É ESCONDER. A 1ª tentativa filtrou por BLOCKLIST (escondi os itens que eu
   * lembrei) e o resultado foi o esperado de toda blocklist: **Dashboard com faturamento,
   * Tributário, Cadastros, Auditoria e Usuários continuaram visíveis** pra uma operadora
   * de estoque. Agora o item só aparece se o papel tem a chave — e **item novo sem `perm`
   * some pra quem não é dono**, em vez de vazar por esquecimento.
   */
  perm: string
}

/**
 * ⭐⭐ O ITEM DO TRILHO — ROUPA NOVA, LÓGICA INTOCADA (14/10/2026).
 *
 * **Ordem do dono (FRENTE B):** *"pílula índigo cheia no item ativo, badge vermelho vivo (Contas
 * a Pagar) (…) no recolhido o badge vira mini sobre o ícone"* — e, sobre o sprint inteiro:
 * *"É troca de roupa global — nenhuma lógica, rota ou porta muda."*
 *
 * ⛔⛔ **AS CLASSES SÃO `.item` / `.rotulo` / `.badge`, DE PROPÓSITO — e isso NÃO é preferência
 * de estilo.** São elas que o CSS do trilho alcança por SELETOR DE DESCENDENTE pra fazer o
 * recolhido funcionar (`.trilho.rec:not(:hover) .rotulo{display:none}` e
 * `.trilho.rec:not(:hover) .badge{position:absolute…}`). Trocar por classe do Tailwind aqui
 * deixaria o item bonito e **mataria o recolhido**: o nome não sumiria em 64px e o badge sairia
 * do campo visível — que é exatamente o vermelho nº 2 da lista do dono.
 *
 * ⚠️ A permissão, o `href`, o `label` e o `isActive` **não mudaram uma linha**. 17 arquivos de
 * teste leem este componente e a lista do `global-sidebar` por regex (permissão por papel, PF
 * não ver menu de empresa, rota morta não voltar ao menu); mexer no contrato pra trocar a cor
 * seria pagar um risco de regressão de acesso por um ganho de pintura.
 */
export function SidebarItem({
  icon: Icon,
  label,
  href,
  isActive,
  badge,
  badgeTone = 'neutral',
  isComingSoon,
  onClick,
  perm,
}: SidebarItemProps) {
  // ⚠️ o hook vem ANTES de qualquer return (REGRA 9) — este componente tem 2 saídas
  const permitido = usePermissaoMenu(perm)
  if (!permitido) return null

  if (isComingSoon) {
    return (
      <div className="item breve" title={`${label} — em breve`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {/* ⚠️ `.rotulo` embrulha nome E selo: no recolhido os dois somem juntos, senão sobraria
            um "breve" solto debaixo de um ícone sem nome. */}
        <span className="rotulo flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="text-[9px] uppercase tracking-wider">breve</span>
        </span>
      </div>
    )
  }

  return (
    <Link href={href} onClick={onClick} className={`item${isActive ? ' on' : ''}`} aria-current={isActive ? 'page' : undefined}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="rotulo min-w-0 flex-1 truncate">{label}</span>
      {/**
       * ⚠️ O `badgeTone` CONTINUA SENDO LIDO — e os dois tons que sobram têm papel distinto:
       * `red`/`neutral` usam o coral vivo do trilho (o Contas a Pagar, que é dívida vencendo) e
       * `amber` usa o âmbar, que nesta casa quer dizer *"confere isto"*, não *"corre"*. Jogar
       * tudo no coral treinaria o dono a ignorar coral — a lição dos 111 alarmes falsos.
       * ⛔ O `title` existe porque no RECOLHIDO o badge é um número de 9px sem rótulo: sem ele,
       * `22` sobre um ícone não diz 22 DE QUÊ.
       */}
      {badge && (
        <span
          className="badge"
          title={`${label}: ${badge}`}
          style={badgeTone === 'amber' ? { background: 'var(--prod-ambar)' } : undefined}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
