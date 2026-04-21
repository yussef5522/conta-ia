'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'

interface DashboardShellProps {
  userName: string
  userEmail: string
  children: React.ReactNode
}

export function DashboardShell({ userName, userEmail, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-30 lg:static lg:z-auto',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <Sidebar userName={userName} userEmail={userEmail} onClose={() => setOpen(false)} />
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 hover:bg-accent transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="font-bold text-sm">Conta IA</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
