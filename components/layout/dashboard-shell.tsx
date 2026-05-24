'use client'

// Sprint 4.0.5.a — refactor: remove ContextualSidebar (sidebar dupla),
// adiciona TopBar com WorkspaceSwitcher.
//
// Layout final:
//   ┌──── TopBar (56px, sticky) ────────────────────┐
//   │  [Logo] / [Cacula Mix ▼]              [👤]   │
//   ├────────┬───────────────────────────────────────┤
//   │ Side   │                                       │
//   │ bar    │           Conteúdo                    │
//   │ 240px  │                                       │
//   └────────┴───────────────────────────────────────┘

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { GlobalSidebar } from '@/components/sidebar/global-sidebar'
import { TopBar } from './top-bar'
import { EmpresaProvider } from '@/lib/contexts/empresa-context'

interface DashboardShellProps {
  userName: string
  userEmail: string
  children: React.ReactNode
}

export function DashboardShell({ userName, userEmail, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <EmpresaProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
        {/* TopBar global (desktop + mobile) */}
        <div className="hidden md:block">
          <TopBar userName={userName} userEmail={userEmail} />
        </div>

        {/* TopBar mobile com hamburguer */}
        <header className="flex h-14 items-center gap-3 border-b bg-white px-4 md:hidden sticky top-0 z-30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm">Conta IA</span>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* DESKTOP: Sidebar única */}
          <div className="hidden md:block shrink-0">
            <GlobalSidebar userName={userName} userEmail={userEmail} />
          </div>

          {/* MOBILE: drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-72 max-w-full">
              <GlobalSidebar
                userName={userName}
                userEmail={userEmail}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* CONTEÚDO */}
          <main className="flex-1 overflow-y-auto bg-zinc-50">
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </EmpresaProvider>
  )
}
