'use client'

// Sprint 4.0.5.a — UserMenu (avatar + dropdown).

import { useRouter } from 'next/navigation'
import { LogOut, Settings, Bell, UserCircle, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
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
  /** Sprint post-3B: mostra "Simular trial expirado" SÓ em sandbox. */
  devToolsEnabled?: boolean
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

export function UserMenu({ userName, userEmail, devToolsEnabled = false }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [devBusy, setDevBusy] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    // Sprint post-3B: logout vai pra landing pública (padrão Stripe/
    // Netflix/GitHub) em vez de /login. UX consistente + chance de
    // re-engagement.
    router.push('/')
  }

  // 🧪 DEV: roda só quando devToolsEnabled (sandbox). Em prod o backend
  // retorna 404 mesmo se alguém forjar a request.
  async function devExpireTrial() {
    setDevBusy(true)
    try {
      const r = await fetch('/api/dev/expire-trial', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await r.json()
      if (!r.ok) {
        toast({ title: 'Erro', description: data.erro ?? 'Falhou', variant: 'destructive' })
        return
      }
      toast({
        title: '🧪 Trial expirado',
        description: 'Atualizando pra cair em /assinar...',
      })
      // Refresh força middleware re-verificar → vai mandar pra /assinar
      // SE o JWT carrega subscriptionExpired stale, precisa relogar. Mas
      // como o middleware lê só o JWT, vamos forçar relogin pra estado
      // determinístico:
      setTimeout(() => {
        window.location.href = '/api/auth/logout'
      }, 1200)
    } finally {
      setDevBusy(false)
    }
  }

  async function devRestoreTrial() {
    setDevBusy(true)
    try {
      const r = await fetch('/api/dev/restore-trial', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await r.json()
      if (!r.ok) {
        toast({ title: 'Erro', description: data.erro ?? 'Falhou', variant: 'destructive' })
        return
      }
      toast({
        title: '🧪 Trial restaurado (14d)',
        description: 'Relogue pra normalizar a sessão.',
      })
      setTimeout(() => {
        window.location.href = '/api/auth/logout'
      }, 1200)
    } finally {
      setDevBusy(false)
    }
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
          onSelect={() => router.push('/minha-conta')}
        >
          <UserCircle className="mr-2 h-4 w-4" />
          Minha conta
        </DropdownMenuItem>
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

        {/* 🧪 Dev tools — só aparece em sandbox (server passa devToolsEnabled) */}
        {devToolsEnabled && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-1.5">
              <p className="text-[9px] uppercase tracking-wider font-bold text-amber-600">
                🧪 Sandbox · Dev tools
              </p>
            </div>
            <DropdownMenuItem
              className="cursor-pointer text-sm text-amber-700 focus:text-amber-800"
              disabled={devBusy}
              onSelect={(e) => {
                e.preventDefault()
                devExpireTrial()
              }}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Simular trial expirado
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm text-amber-700 focus:text-amber-800"
              disabled={devBusy}
              onSelect={(e) => {
                e.preventDefault()
                devRestoreTrial()
              }}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Restaurar trial (14d)
            </DropdownMenuItem>
          </>
        )}

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
