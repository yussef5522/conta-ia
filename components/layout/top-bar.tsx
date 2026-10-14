'use client'

import { Menu } from 'lucide-react'
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
  /**
   * ⭐⭐ O ☰ DO CELULAR MORA AQUI (FRENTE C item 5: *"Celular: trilho vira gaveta pelo ☰ do
   * topo"*). Quem guarda o estado da gaveta é o SHELL — a barra só avisa o toque.
   */
  onAbrirGaveta: () => void
}

/**
 * ⭐⭐ O TOPO — 1:1 com `.topo` de `docs/cara-do-sistema-referencia.html` (14/10/2026).
 *
 * ⛔⛔ **UMA BARRA, DOIS VIEWPORTS.** Até hoje existiam DUAS no DOM: esta (`hidden md:block`) e
 * uma cópia no `dashboard-shell` (`md:hidden`) com os mesmos quatro controles escritos de novo.
 * Duas composições da mesma barra divergem no primeiro ajuste — é a doença que esta casa mais
 * paga, e aqui ela já tinha um guard tentando segurar (*"o sininho tem que estar nas DUAS"*).
 * Com uma barra só, "o sininho é global" deixa de ser combinado e passa a ser **construção**.
 * O que muda entre os viewports é o ☰ aparecer, e isso é CSS (`.menu-m`), não composição.
 *
 * ⚠️ A ORDEM dos controles é a do pedido e a da referência: **sino → 🌙/☀️ → avatar**. O dono
 * procura o sino no mesmo lugar sempre; trocar a ordem por estética custa o reflexo dele.
 *
 * ⛔ A BUSCA ⌘K da referência **NÃO ENTRA** nesta fase — não há registro de telas pra ligar nela
 * e campo morto é proibido (o `registry.parse` decorativo que esta casa já pagou). Fase 2.
 */
export function TopBar({ userName, userEmail, devToolsEnabled = false, tema, onAbrirGaveta }: Props) {
  return (
    <header className="topo sticky top-0 z-30">
      <button type="button" className="icbt menu-m" onClick={onAbrirGaveta} aria-label="Abrir menu">
        <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      <WorkspaceSwitcherDual />

      <div className="acoes">
        <Sininho />
        <BotaoTema temaInicial={tema} />
        <UserMenu userName={userName} userEmail={userEmail} devToolsEnabled={devToolsEnabled} />
      </div>
    </header>
  )
}
