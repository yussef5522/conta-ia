'use client'

// Sprint 4.0.5.a/c — layout shell.
// Desktop: TopBar 56px + Sidebar fixa 240px.
// Mobile: TopBar 56px com hambúrguer + WorkspaceSwitcher + UserMenu;
//         Sidebar via Sheet drawer.

import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { GlobalSidebar } from '@/components/sidebar/global-sidebar'
import { TopBar } from './top-bar'
import { EmpresaProvider } from '@/lib/contexts/empresa-context'
// Sprint PF Fatia 1 — dual workspace (PJ + PF)
import { WorkspaceProvider } from '@/lib/contexts/workspace-context'
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
       * O dono pediu um slate frio no claro e um canvas quase-preto no escuro, e a decisão de
       * 10/09 (*"trocar o shell mudaria todas as telas por causa de uma"*) foi **superada**:
       * agora é exatamente isso que ele quer — uma casa, um chão.
       * ⚠️ Os TONS que estavam escritos aqui (`#F8FAFC`/`#16151D`, o pedido em prosa de 04/10)
       * saíram deste comentário em 14/10: quem os declara é `--prod-bg`, e quem manda neles é
       * `docs/cara-do-sistema-referencia.html`. Hex num comentário envelhece calado e vira a
       * segunda fonte de verdade sobre a cor — a leitura certa é o token, nunca esta linha.
       * ⚠️ E este `h-screen` cobre a viewport inteira, então é ELE que o olho vê como fundo;
       * deixá-lo em zinc deixaria o tema escuro com um chão claro por baixo de tudo. */}
      <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--prod-bg)' }}>
        {/* ⭐⭐ UMA BARRA, DOIS VIEWPORTS (14/10) — a 2ª composição `md:hidden` que vivia aqui
            MORREU. Ela repetia os quatro controles do topo à mão, e duas cópias da mesma barra
            divergem no 1º ajuste. O ☰ da gaveta agora mora DENTRO do topo e o CSS (`.menu-m`) o
            esconde no desktop, onde o trilho já está na tela. REGRA 12 por construção. */}
        <TopBar
          userName={userName}
          userEmail={userEmail}
          devToolsEnabled={devToolsEnabled}
          tema={tema}
          onAbrirGaveta={() => setMobileOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* DESKTOP: Sidebar única */}
          {/**
            * ⛔⛔ `md:flex`, NÃO `md:block` (14/10, tarde) — e esta linha é metade do conserto da
            * rolagem. O wrapper em `block` não dava altura definida ao `.trilho`, então o nav
            * crescia com os itens além da viewport e o pedaço de baixo era cortado pelo
            * `overflow-hidden` desta row: *"lista aparace ate relatorios so e nao consigo ir
            * para baixou"*. Como flex, o nav estica por `align-items:stretch` e aí o
            * `overflow-y:auto` da `.lista` tem altura pra estourar.
            */}
          <div className="hidden md:flex shrink-0">
            <GlobalSidebar userName={userName} userEmail={userEmail} />
          </div>

          {/* MOBILE: drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            {/* ⚠️ `bg-transparent` porque o TRILHO pinta o próprio chão escuro: sem isto a
                gaveta ficaria com a superfície clara do Sheet por baixo e um fio branco na
                borda, nos dois temas. */}
            <SheetContent side="left" className="w-72 max-w-[85vw] border-0 bg-transparent p-0">
              {/* ⛔ `naGaveta`: aqui o trilho é SEMPRE aberto — no toque não existe `:hover`, e
                  recolhido seriam 64px de ícones sem rótulo e sem gesto nenhum pra ver os nomes
                  (a "porta sem maçaneta" em forma de menu). No desktop o mouse existe, e é ele
                  que cresce o trilho.
                  ⭐ E a gaveta ROLA pela MESMA regra do desktop (`.trilho .lista`): o
                  `SheetContent` é `inset-y-0 h-full`, então o nav tem altura e a lista estoura
                  nela. Uma composição, não duas. */}
              <GlobalSidebar
                userName={userName}
                userEmail={userEmail}
                naGaveta
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
