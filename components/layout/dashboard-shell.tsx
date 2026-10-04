'use client'

// Sprint 4.0.5.a/c — layout shell.
// Desktop: TopBar 56px + Sidebar fixa 240px.
// Mobile: TopBar 56px com hambúrguer + WorkspaceSwitcher + UserMenu;
//         Sidebar via Sheet drawer.

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { GlobalSidebar } from '@/components/sidebar/global-sidebar'
import { TopBar } from './top-bar'
import { WorkspaceSwitcherDual } from './workspace-switcher-dual'
import { UserMenu } from './user-menu'
import { EmpresaProvider } from '@/lib/contexts/empresa-context'
// Sprint PF Fatia 1 — dual workspace (PJ + PF)
import { WorkspaceProvider } from '@/lib/contexts/workspace-context'
import { BotaoTema } from './botao-tema'
import { Sininho } from '@/components/avisos/sininho'
import type { Tema } from '@/lib/tema/preferencia'

interface DashboardShellProps {
  userName: string
  userEmail: string
  /** Sprint post-3B: passa pro UserMenu mostrar dev tools só em sandbox. */
  devToolsEnabled?: boolean
  /** ⭐ o tema resolvido no SERVIDOR — o botão nasce com o ícone certo, sem piscar */
  tema: Tema
  children: React.ReactNode
}

export function DashboardShell({ userName, userEmail, devToolsEnabled = false, tema, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <EmpresaProvider>
      <WorkspaceProvider>
      {/* ⭐⭐ O CANVAS DA CASA PASSOU A SER TOKEN (04/10) — era `bg-muted` (#fafafa) cravado.
       * O dono pediu o slate frio `#F8FAFC` no claro e `#16151D` no escuro, e a decisão de
       * 10/09 (*"trocar o shell mudaria todas as telas por causa de uma"*) foi **superada**:
       * agora é exatamente isso que ele quer — uma casa, um chão.
       * ⚠️ E este `h-screen` cobre a viewport inteira, então é ELE que o olho vê como fundo;
       * deixá-lo em zinc deixaria o tema escuro com um chão claro por baixo de tudo. */}
      <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--prod-bg)' }}>
        {/* TopBar global (desktop) */}
        <div className="hidden md:block">
          <TopBar userName={userName} userEmail={userEmail} devToolsEnabled={devToolsEnabled} tema={tema} />
        </div>

        {/* TopBar mobile: hambúrguer + workspace switcher + user menu */}
        <header
          className="flex h-14 items-center gap-2 border-b px-3 md:hidden sticky top-0 z-30"
          style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="flex items-center justify-center h-11 w-11 -ml-2 rounded-md text-foreground hover:bg-accent active:scale-95 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <WorkspaceSwitcherDual />
          </div>
          {/* ⭐ REGRA 12: os mesmos gestos no celular — e são OS MESMOS componentes, não uma 2ª
              composição (duas divergiriam no 1º ajuste, a doença que esta casa mais paga). */}
          <Sininho />
          <BotaoTema temaInicial={tema} />
          <UserMenu userName={userName} userEmail={userEmail} devToolsEnabled={devToolsEnabled} />
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* DESKTOP: Sidebar única */}
          <div className="hidden md:block shrink-0">
            <GlobalSidebar userName={userName} userEmail={userEmail} />
          </div>

          {/* MOBILE: drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-72 max-w-[85vw]">
              <GlobalSidebar
                userName={userName}
                userEmail={userEmail}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* CONTEÚDO */}
          {/* Passe de densidade (23/08/2026) — o molde. Era max-w-6xl (1152px),
           * que somado ao max-w próprio das telas dava 60-70% de aproveitamento
           * no notebook. Agora largura total com teto ALTO (1600px): no notebook
           * é largura total de fato; o teto só morde em monitor ultrawide, pra
           * tabela não esticar a 2500px e virar linha ilegível.
           * TELA DE DADOS = largura total; formulário/documento mantém max-w
           * próprio (certificado, ficha nova, recibo, etiqueta Zebra). */}
          <main className="flex-1 overflow-y-auto" style={{ background: 'var(--prod-bg)' }}>
            <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
      </WorkspaceProvider>
    </EmpresaProvider>
  )
}
