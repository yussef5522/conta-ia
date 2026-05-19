// Sidebar dark do painel admin — Sprint 1.6.
// Vibe Linear: compacta, mono, hover sutil.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users as UsersIcon,
  Ticket,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface SidebarItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  comingSoon?: boolean
}

const ITEMS: SidebarItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clientes', label: 'Clientes', icon: UsersIcon, comingSoon: true },
  { href: '/admin/cupons', label: 'Cupons', icon: Ticket },
  { href: '/admin/metricas', label: 'Métricas', icon: BarChart3, comingSoon: true },
]

export function AdminSidebar({ gerenciadorName }: { gerenciadorName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <aside
      className="flex flex-col"
      style={{
        width: '220px',
        background: '#0a0a0a',
        borderRight: '1px solid #1a1a1a',
        minHeight: '100vh',
      }}
    >
      {/* Brand */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <p
          className="font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: '#737373' }}
        >
          CAIXAOS
        </p>
        <p
          className="font-mono mt-0.5 text-[10px] uppercase tracking-[0.3em]"
          style={{ color: '#525252' }}
        >
          admin
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/admin/dashboard' &&
              pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.comingSoon ? '#' : item.href}
              onClick={item.comingSoon ? (e) => e.preventDefault() : undefined}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors"
              style={{
                color: active
                  ? '#fafafa'
                  : item.comingSoon
                    ? '#404040'
                    : '#a3a3a3',
                background: active ? '#171717' : 'transparent',
                cursor: item.comingSoon ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (item.comingSoon || active) return
                e.currentTarget.style.background = '#141414'
                e.currentTarget.style.color = '#e5e5e5'
              }}
              onMouseLeave={(e) => {
                if (item.comingSoon || active) return
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#a3a3a3'
              }}
            >
              <item.icon className="h-3.5 w-3.5" />
              <span className="flex-1">{item.label}</span>
              {item.comingSoon && (
                <span
                  className="text-[9px] uppercase tracking-wider"
                  style={{ color: '#525252' }}
                >
                  Soon
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer com user + logout */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid #1a1a1a' }}>
        <div className="px-1 mb-2">
          <p className="text-xs font-medium" style={{ color: '#e5e5e5' }}>
            {gerenciadorName}
          </p>
          <p
            className="text-[10px] font-mono uppercase tracking-wider mt-0.5"
            style={{ color: '#525252' }}
          >
            OPERADOR
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
          style={{ color: '#a3a3a3' }}
          onMouseEnter={(e) => {
            if (loggingOut) return
            e.currentTarget.style.background = '#141414'
            e.currentTarget.style.color = '#fca5a5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#a3a3a3'
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          {loggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </aside>
  )
}
