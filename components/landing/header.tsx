'use client'

// Sprint Landing Page (30/05/2026) — Header sticky com nav + CTA.
// Aparece scrolled (sombra + bg blur) após 8px de scroll.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { CaixaosLogo } from './logo'

const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '/planos', label: 'Planos' },
] as const

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_0_rgba(15,23,42,0.04)]'
          : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 -ml-1">
            <CaixaosLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-md"
              >
                {link.label}
              </Link>
            ))}
            <div className="ml-2 flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 transition-all hover:bg-violet-700 hover:shadow-md hover:shadow-violet-600/25 active:scale-[0.98]"
              >
                Teste grátis
              </Link>
            </div>
          </nav>

          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-slate-700 hover:bg-slate-100"
            onClick={() => setMobileOpen((s) => !s)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-5 pt-2 border-t border-slate-100">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 rounded-md"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-slate-100 my-2" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                onClick={() => setMobileOpen(false)}
                className="mt-1 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-3 text-base font-medium text-white shadow-sm"
              >
                Teste grátis
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
