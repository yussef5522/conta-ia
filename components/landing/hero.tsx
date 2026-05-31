'use client'

// Sprint Landing v2 Elite (30/05/2026) — Hero premium com gradient mesh
// animado, tipografia display, entrada motion-rich, dashboards 3D.

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { HeroVisual } from './hero-visual'
import { MeshBg } from './mesh-bg'
import { EASE_OUT_EXPO } from '@/lib/motion/variants'

const HEADLINE_WORDS = ['Enxergue', 'cada', 'centavo', 'do']

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-36 pb-20 sm:pb-32">
      <MeshBg variant="light" grid noise />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* === Copy === */}
          <div className="lg:col-span-6 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/60 backdrop-blur-md px-3.5 py-1.5 text-[12px] font-medium text-violet-800 shadow-sm shadow-violet-900/5"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-600" />
              </span>
              <Sparkles size={12} className="text-violet-600" />
              <span>Novo: IA que entende seu caixa</span>
            </motion.div>

            <h1 className="mt-7 text-[2.75rem] sm:text-6xl lg:text-[5.25rem] leading-[1.02] font-semibold tracking-[-0.04em] text-slate-900 text-balance font-display">
              {HEADLINE_WORDS.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.8,
                    delay: 0.15 + i * 0.08,
                    ease: EASE_OUT_EXPO,
                  }}
                  className="inline-block mr-[0.22em]"
                >
                  {word}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.9, delay: 0.55, ease: EASE_OUT_EXPO }}
                className="inline-block italic text-gradient-violet font-display"
              >
                seu negócio.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75, ease: EASE_OUT_EXPO }}
              className="mt-7 text-lg sm:text-xl leading-relaxed text-slate-600 max-w-xl font-sans"
            >
              Gestão financeira com inteligência de verdade. Importe, analise e
              entenda para onde vai seu dinheiro — em segundos, não em
              planilhas.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9, ease: EASE_OUT_EXPO }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <Link
                href="/cadastro"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-500 to-violet-700 px-6 py-3.5 text-[15px] font-semibold text-white glow-violet-strong transition-all hover:from-violet-400 hover:to-violet-600 active:scale-[0.98]"
              >
                Teste grátis
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/planos"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300/80 bg-white/70 backdrop-blur-md px-6 py-3.5 text-[15px] font-medium text-slate-800 transition-all hover:bg-white hover:border-slate-400 hover:shadow-md"
              >
                Ver planos e preços
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.1 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500"
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Sem cartão de crédito
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Cancele quando quiser
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Setup em 1 minuto
              </div>
            </motion.div>
          </div>

          {/* === Visual === */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE_OUT_EXPO }}
            className="lg:col-span-6 relative"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
