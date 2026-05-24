'use client'

// Sprint 4.0.5.a — UserMenu (avatar + dropdown).

import { useRouter } from 'next/navigation'
import { LogOut, Settings, Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface Props {
  userName: string
  userEmail: string
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function UserMenu({ userName, userEmail }: Props) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-700 transition-colors"
          aria-label="Menu do usuário"
        >
          {initials(userName)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
        </div>
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onSelect={() => router.push('/configuracoes/alertas')}
        >
          <Bell className="mr-2 h-4 w-4" />
          Alertas por email
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-sm" disabled>
          <Settings className="mr-2 h-4 w-4" />
          Configurações
          <span className="ml-auto text-[10px] text-zinc-400">breve</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm text-red-600 focus:text-red-700"
          onSelect={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
