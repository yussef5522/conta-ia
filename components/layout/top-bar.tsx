'use client'

// Sprint 4.0.5.a — TopBar sticky com Workspace Switcher + User Menu.

import Link from 'next/link'
import { WorkspaceSwitcherDual } from './workspace-switcher-dual'
import { UserMenu } from './user-menu'
import { BotaoTema } from './botao-tema'
import { Sininho } from '@/components/avisos/sininho'
import type { Tema } from '@/lib/tema/preferencia'

interface Props {
  userName: string
  userEmail: string
  devToolsEnabled?: boolean
  tema: Tema
}

export function TopBar({ userName, userEmail, devToolsEnabled = false, tema }: Props) {
  return (
    /* ⭐ a barra global passou a ler TOKEN (04/10): no escuro ela acompanha a superfície, e no
       claro continua branca — `bg-card` cravado deixaria uma faixa branca no topo do tema
       escuro, que é o jeito mais rápido de um tema parecer quebrado. */
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4"
      style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}
    >
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-primary-foreground font-bold text-xs">C</span>
          </div>
          <span className="font-semibold text-sm hidden sm:inline">CAIXAOS</span>
        </Link>
        <span className="text-muted-foreground">/</span>
        <WorkspaceSwitcherDual />
      </div>

      <div className="flex-1" />

      {/* ⭐ a ordem é a do pedido: SININHO → 🌙/☀️ → ação do usuário */}
      <Sininho />
      <BotaoTema temaInicial={tema} />

      <UserMenu userName={userName} userEmail={userEmail} devToolsEnabled={devToolsEnabled} />
    </header>
  )
}
