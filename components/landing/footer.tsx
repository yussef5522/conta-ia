// Sprint Landing v2 Elite (30/05/2026) — Footer dark institucional rico.

import Link from 'next/link'
import { CaixaosLogo } from './logo'

const COLS = [
  {
    title: 'Produto',
    links: [
      { href: '#funcionalidades', label: 'Funcionalidades' },
      { href: '#comparativo', label: 'Comparativo' },
      { href: '/planos', label: 'Planos e preços' },
      { href: '/cadastro', label: 'Criar conta' },
      { href: '/login', label: 'Entrar' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/termos', label: 'Termos de Uso' },
      { href: '/privacidade', label: 'Política de Privacidade' },
    ],
  },
  {
    title: 'Contato',
    links: [
      { href: 'mailto:contato@caixaos.com.br', label: 'contato@caixaos.com.br' },
      { href: 'https://wa.me/5500000000000', label: 'WhatsApp (em breve)' },
    ],
  },
] as const

export function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-white border-t border-white/5">
      {/* Decorative top gradient */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"
      />
      <div
        aria-hidden
        className="absolute -top-32 right-1/4 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Link href="/" className="inline-flex transition-opacity hover:opacity-80">
              <CaixaosLogo variant="light-text" />
            </Link>
            <p className="mt-6 text-base text-white/65 leading-relaxed max-w-sm font-display italic">
              Sistema operacional do seu caixa. Gestão financeira com IA pra PMEs
              brasileiras.
            </p>
            <p className="mt-4 text-sm text-white/45 max-w-sm">
              Feito no Brasil pra brasileiros — sem jargão importado de SaaS
              gringo.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {COLS.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
                  {col.title}
                </p>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-white/75 hover:text-white transition-colors inline-flex items-center gap-1 group"
                      >
                        <span>{l.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            © {year} CAIXAOS. Todos os direitos reservados.
          </p>
          <p className="text-xs text-white/40 inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            Todos os sistemas operando
          </p>
        </div>
      </div>
    </footer>
  )
}
