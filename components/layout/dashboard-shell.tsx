'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { GlobalSidebar } from '@/components/sidebar/global-sidebar'
import { ContextualSidebar } from '@/components/sidebar/contextual-sidebar'

interface DashboardShellProps {
  userName: string
  userEmail: string
  children: React.ReactNode
}

export function DashboardShell({ userName, userEmail, children }: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Detecta se está dentro de uma empresa
  const empresaMatch = pathname.match(/^\/empresas\/([^/]+)/)
  const empresaId = empresaMatch?.[1]

  // Contextual aparece em /empresas/[id]/... mas não em /empresas (lista)
  const showContextual = Boolean(empresaId) && pathname !== '/empresas'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* DESKTOP: Sidebar Global (sempre visível) */}
      <div className="hidden md:block shrink-0">
        <GlobalSidebar userName={userName} userEmail={userEmail} />
      </div>

      {/* DESKTOP: Sidebar Contextual (quando em empresa) */}
      {showContextual && empresaId && (
        <div className="hidden md:block shrink-0">
          <ContextualSidebar empresaId={empresaId} />
        </div>
      )}

      {/* MOBILE: drawer combinado */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-80 max-w-full sm:max-w-md md:max-w-lg">
          <div className="flex h-full">
            <GlobalSidebar
              userName={userName}
              userEmail={userEmail}
              onNavigate={() => setMobileOpen(false)}
            />
            {showContextual && empresaId && (
              <ContextualSidebar
                empresaId={empresaId}
                onNavigate={() => setMobileOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile com botão hambúrguer */}
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold text-sm">Conta IA</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
