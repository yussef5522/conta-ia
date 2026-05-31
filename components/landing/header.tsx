'use client'

// Sprint Landing v3 (30/05/2026) — Header sticky adaptativo.
// Detecta se a página atual tem hero DARK (/) — quando true e NÃO
// scrollado, usa texto branco/light. Quando scrollado vira sempre
// glassmorphism branco com texto escuro.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ArrowRight } from 'lucide-react'
import { CaixaosLogo } from './logo'

const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#comparativo', label: 'Comparar' },
  { href: '/planos', label: 'Planos' },
] as const

// Páginas com hero DARK imersivo no topo
const DARK_HERO_PATHS = ['/']

export function LandingHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onDarkHero = DARK_HERO_PATHS.includes(pathname) && !scrolled

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-white/75 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200/40 shadow-[0_1px_0_rgba(15,23,42,0.04),0_6px_24px_-12px_rgba(91,33,182,0.18)]'
          : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-[68px] items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 -ml-1 transition-opacity hover:opacity-80"
          >
            <CaixaosLogo variant={onDarkHero ? 'light-text' : 'dark-text'} />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'relative px-3.5 py-2 text-sm font-medium transition-colors rounded-md group',
                  onDarkHero
                    ? 'text-white/75 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                <span className="relative">
                  {link.label}
                  <span
                    className={[
                      'absolute -bottom-0.5 left-0 h-[1.5px] w-0 transition-all duration-300 group-hover:w-full',
                      onDarkHero ? 'bg-violet-300' : 'bg-violet-600',
                    ].join(' ')}
                  />
                </span>
              </Link>
            ))}
            <div
              className={[
                'ml-3 flex items-center gap-2 pl-3 border-l',
                onDarkHero ? 'border-white/15' : 'border-slate-200/70',
              ].join(' ')}
            >
              <Link
                href="/login"
                className={[
                  'px-4 py-2 text-sm font-medium transition-colors',
                  onDarkHero ? 'text-white/85 hover:text-white' : 'text-slate-700 hover:text-slate-900',
                ].join(' ')}
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="group inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 px-4 py-2 text-sm font-medium text-white glow-violet transition-all hover:from-violet-400 hover:to-violet-600 active:scale-[0.98]"
              >
                Teste grátis
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </nav>

          <button
            type="button"
            className={[
              'md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md',
              onDarkHero
                ? 'text-white hover:bg-white/10'
                : 'text-slate-700 hover:bg-slate-100',
            ].join(' ')}
            onClick={() => setMobileOpen((s) => !s)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div
            className={[
              'md:hidden pb-5 pt-2 border-t',
              onDarkHero
                ? 'border-white/10 bg-slate-950/80 backdrop-blur-xl'
                : 'border-slate-100',
            ].join(' ')}
          >
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    'px-3 py-3 text-base font-medium rounded-md',
                    onDarkHero
                      ? 'text-white/90 hover:bg-white/5'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              ))}
              <div
                className={[
                  'border-t my-2',
                  onDarkHero ? 'border-white/10' : 'border-slate-100',
                ].join(' ')}
              />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className={[
                  'px-3 py-3 text-base font-medium rounded-md',
                  onDarkHero
                    ? 'text-white/90 hover:bg-white/5'
                    : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                onClick={() => setMobileOpen(false)}
                className="mt-1 inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 px-4 py-3 text-base font-medium text-white glow-violet"
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
