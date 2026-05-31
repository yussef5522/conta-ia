'use client'

// Sprint Landing v2 Elite (30/05/2026) — CTA final full-bleed dark com
// gradient mesh imersivo. Última oportunidade visual antes do footer.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MeshBg } from './mesh-bg'
import { SectionReveal } from './section-reveal'
import { fadeUp } from '@/lib/motion/variants'

export function LandingCTA() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <MeshBg variant="dark" grid noise />

      <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
        <SectionReveal variants={fadeUp}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
            Sua vez
          </p>
          <h2 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] leading-[1.02] text-white font-display text-balance">
            Comece grátis hoje.
            <br />
            <span className="italic text-gradient-violet">Pague</span> quando crescer.
          </h2>
          <p className="mt-7 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Sem cartão de crédito. Sem fidelidade. Cancele a hora que quiser.
            Importa seu primeiro extrato em menos de 1 minuto.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/cadastro"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 text-[15px] font-semibold text-slate-900 transition-all hover:bg-slate-100 active:scale-[0.98] shadow-2xl shadow-violet-900/30"
            >
              Teste grátis
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="/planos"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-7 py-4 text-[15px] font-medium text-white transition-all hover:bg-white/10 hover:border-white/30"
            >
              Ver todos os planos
            </Link>
          </div>

          <div className="mt-10 flex items-center justify-center gap-x-6 gap-y-2 text-sm text-white/50 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Sem cartão
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Cancele quando quiser
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Suporte em português
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}
