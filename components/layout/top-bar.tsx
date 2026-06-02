'use client'

// Sprint 4.0.5.a — TopBar sticky com Workspace Switcher + User Menu.

import Link from 'next/link'
import { WorkspaceSwitcherDual } from './workspace-switcher-dual'
import { UserMenu } from './user-menu'

interface Props {
  userName: string
  userEmail: string
  devToolsEnabled?: boolean
}

export function TopBar({ userName, userEmail, devToolsEnabled = false }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-primary-foreground font-bold text-xs">C</span>
          </div>
          <span className="font-semibold text-sm hidden sm:inline">CAIXAOS</span>
        </Link>
        <span className="text-zinc-300">/</span>
        <WorkspaceSwitcherDual />
      </div>

      <div className="flex-1" />

      <UserMenu userName={userName} userEmail={userEmail} devToolsEnabled={devToolsEnabled} />
    </header>
  )
}
