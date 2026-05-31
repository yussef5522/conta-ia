'use client'

// Sprint Landing v3.3 (31/05/2026) — Hero COMPACTO. Tudo cabe em 1
// viewport notebook (1366×768 / 1440×900) sem rolar. Reduções:
// - Headline 5.25rem → 4xl/5xl/6xl (44-60px)
// - pt 40/44/52 → 28/32/36
// - pb 24/32 → 12/16
// - Subtítulo xl → base/lg
// - CTAs py-4 → py-3
// - Espaçador 720px → 540px (cards menores cabem em menos altura)

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { HeroVisual } from './hero-visual'
import { MeshBg } from './mesh-bg'
import { EASE_OUT_EXPO } from '@/lib/motion/variants'

const HEADLINE_WORDS = ['Enxergue', 'cada', 'centavo', 'do']

export function LandingHero() {
  return (
    <section className="relative pt-28 sm:pt-32 lg:pt-36 pb-14 sm:pb-16 lg:pb-20 overflow-hidden text-white">
      <MeshBg variant="hero-immersive" grid noise />

      {/* Transition gradient pra próxima seção (SocialProof = slate-950) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-48 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(20, 17, 40, 0.4) 30%, rgba(8, 8, 22, 0.85) 70%, rgb(2, 6, 23) 100%)',
          zIndex: 5,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          {/* === Copy === */}
          <div className="lg:col-span-5 max-w-xl relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-white/5 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-violet-200 shadow-[0_0_20px_-5px_rgba(167,139,250,0.4)]"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
              </span>
              <Sparkles size={11} className="text-violet-300" />
              <span>Novo: IA que entende seu caixa</span>
            </motion.div>

            <h1 className="mt-5 text-[2rem] sm:text-4xl lg:text-[3.25rem] leading-[1.05] font-bold tracking-[-0.03em] text-white text-balance font-display">
              {HEADLINE_WORDS.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.7,
                    delay: 0.15 + i * 0.07,
                    ease: EASE_OUT_EXPO,
                  }}
                  className="inline-block mr-[0.22em]"
                >
                  {word}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, delay: 0.5, ease: EASE_OUT_EXPO }}
                className="inline-block font-display"
                style={{
                  backgroundImage:
                    'linear-gradient(115deg, #f5f3ff 0%, #c4b5fd 35%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  filter: 'drop-shadow(0 0 20px rgba(167,139,250,0.4))',
                }}
              >
                seu negócio.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7, ease: EASE_OUT_EXPO }}
              className="mt-4 text-sm sm:text-base leading-relaxed text-slate-300 max-w-lg"
            >
              Gestão financeira com inteligência de verdade. Importe, analise e
              entenda pra onde vai seu dinheiro — em segundos, não em planilhas.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.85, ease: EASE_OUT_EXPO }}
              className="mt-6 flex flex-col sm:flex-row gap-2.5"
            >
              <Link
                href="/cadastro"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-violet-400 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:from-violet-300 hover:to-violet-500 active:scale-[0.98] shadow-[0_0_0_1px_rgba(167,139,250,0.35),0_8px_24px_-4px_rgba(124,58,237,0.65),0_18px_40px_-12px_rgba(91,33,182,0.55),0_0_50px_-10px_rgba(167,139,250,0.5)]"
              >
                Teste grátis
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/planos"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/30 bg-white/[0.06] backdrop-blur-md px-5 py-3 text-sm font-medium text-white transition-all hover:bg-white/[0.10] hover:border-violet-300/50"
              >
                Ver planos
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.0 }}
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400"
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                Sem cartão de crédito
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                Cancele quando quiser
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                Setup em 1 minuto
              </div>
            </motion.div>
          </div>

          {/* === Dashboards sangrando à direita === */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE_OUT_EXPO }}
            className="lg:col-span-7 relative"
          >
            {/* lg:top-1/2 -translate-y-1/2 centraliza vertical (cards
             * compactos agora cabem alinhados ao copy). Sangramento
             * lg:right-[-10vw] (era -15vw) — reduzido proporcional. */}
            <div className="relative lg:absolute lg:left-0 lg:right-[-10vw] lg:top-1/2 lg:-translate-y-1/2">
              <HeroVisual />
            </div>
          </motion.div>
        </div>

        {/* Espaçador desktop — reduzido pra acomodar cards compactos */}
        <div className="hidden lg:block lg:h-[540px]" aria-hidden />
      </div>
    </section>
  )
}
