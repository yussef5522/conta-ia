// Sprint Landing Page (30/05/2026) — Footer institucional.

import Link from 'next/link'
import { CaixaosLogo } from './logo'

const COLS = [
  {
    title: 'Produto',
    links: [
      { href: '#funcionalidades', label: 'Funcionalidades' },
      { href: '/planos', label: 'Planos e preços' },
      { href: '/login', label: 'Entrar' },
      { href: '/cadastro', label: 'Criar conta' },
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
      {
        href: 'https://wa.me/5500000000000',
        label: 'WhatsApp (em breve)',
      },
    ],
  },
] as const

export function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-slate-950 text-white border-t border-white/5">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-5">
            <Link href="/" className="inline-flex">
              <CaixaosLogo variant="light-text" />
            </Link>
            <p className="mt-5 text-sm text-white/60 leading-relaxed max-w-xs">
              Gestão financeira com IA pra PMEs brasileiras. Sistema operacional
              do seu caixa.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {COLS.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-white/80 hover:text-white transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            © {year} CAIXAOS. Todos os direitos reservados.
          </p>
          <p className="text-xs text-white/40">
            Feito no Brasil 🇧🇷
          </p>
        </div>
      </div>
    </footer>
  )
}
