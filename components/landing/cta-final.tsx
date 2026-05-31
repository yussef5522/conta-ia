// Sprint Landing Page (30/05/2026) — CTA final.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function LandingCTA() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(80% 60% at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 60%), #ffffff',
        }}
      />

      <div className="mx-auto max-w-4xl px-5 sm:px-8 text-center">
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950 text-white p-10 sm:p-16 overflow-hidden border border-white/10 shadow-2xl shadow-violet-900/20">
          <div
            aria-hidden
            className="absolute -top-32 -right-32 h-64 w-64 rounded-full opacity-40 blur-3xl"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }}
          />

          <h2 className="relative text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.02em] leading-[1.1]">
            Comece grátis hoje.
            <br />
            <span className="text-violet-300">Pague quando quiser crescer.</span>
          </h2>
          <p className="relative mt-5 text-base sm:text-lg text-white/70 max-w-xl mx-auto">
            Sem cartão de crédito. Sem fidelidade. Cancele a hora que quiser.
            Importa seu primeiro extrato em menos de 1 minuto.
          </p>

          <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-100 active:scale-[0.98] shadow-lg"
            >
              Teste grátis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/planos"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              Ver todos os planos
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
