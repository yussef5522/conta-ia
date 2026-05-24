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
import { WorkspaceSwitcher } from './workspace-switcher'
import { UserMenu } from './user-menu'
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
        {/* TopBar global (desktop) */}
        <div className="hidden md:block">
          <TopBar userName={userName} userEmail={userEmail} />
        </div>

        {/* TopBar mobile: hambúrguer + workspace switcher + user menu */}
        <header className="flex h-14 items-center gap-2 border-b bg-white px-3 md:hidden sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="flex items-center justify-center h-11 w-11 -ml-2 rounded-md text-zinc-700 hover:bg-zinc-100 active:scale-95 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <WorkspaceSwitcher />
          </div>
          <UserMenu userName={userName} userEmail={userEmail} />
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
          <main className="flex-1 overflow-y-auto bg-zinc-50">
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </EmpresaProvider>
  )
}
