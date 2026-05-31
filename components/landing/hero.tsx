'use client'

// Sprint Landing v3 (30/05/2026) — Hero DARK imersivo com alma violeta,
// dashboards sangrando à direita, densidade Bento (8 cards + AI overlay).

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { HeroVisual } from './hero-visual'
import { MeshBg } from './mesh-bg'
import { EASE_OUT_EXPO } from '@/lib/motion/variants'

const HEADLINE_WORDS = ['Enxergue', 'cada', 'centavo', 'do']

export function LandingHero() {
  return (
    <section className="relative pt-40 sm:pt-44 lg:pt-52 pb-24 sm:pb-32 overflow-hidden text-white">
      <MeshBg variant="hero-immersive" grid noise />

      {/* Transition gradient pra próxima seção (SocialProof = slate-950) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(2, 6, 23, 0.6) 60%, rgb(2, 6, 23) 100%)',
          zIndex: 5,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* Grid: copy esquerda + dashboards sangrando à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* === Copy === */}
          <div className="lg:col-span-5 max-w-2xl relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-white/5 backdrop-blur-md px-3.5 py-1.5 text-[12px] font-medium text-violet-200 shadow-[0_0_20px_-5px_rgba(167,139,250,0.4)]"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
              </span>
              <Sparkles size={12} className="text-violet-300" />
              <span>Novo: IA que entende seu caixa</span>
            </motion.div>

            <h1 className="mt-7 text-[2.75rem] sm:text-6xl lg:text-[5.25rem] leading-[1.02] font-semibold tracking-[-0.04em] text-white text-balance font-display">
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
                className="inline-block italic font-display"
                style={{
                  backgroundImage:
                    'linear-gradient(115deg, #f5f3ff 0%, #c4b5fd 35%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  filter: 'drop-shadow(0 0 24px rgba(167,139,250,0.35))',
                }}
              >
                seu negócio.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75, ease: EASE_OUT_EXPO }}
              className="mt-7 text-lg sm:text-xl leading-relaxed text-slate-300 max-w-xl font-sans"
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
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-400 to-violet-600 px-7 py-4 text-[15px] font-semibold text-white transition-all hover:from-violet-300 hover:to-violet-500 active:scale-[0.98] shadow-[0_0_0_1px_rgba(167,139,250,0.35),0_10px_30px_-5px_rgba(124,58,237,0.70),0_24px_60px_-12px_rgba(91,33,182,0.65),0_0_70px_-10px_rgba(167,139,250,0.55)]"
              >
                Teste grátis
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/planos"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/30 bg-white/[0.06] backdrop-blur-md px-7 py-4 text-[15px] font-medium text-white transition-all hover:bg-white/[0.10] hover:border-violet-300/50"
              >
                Ver planos e preços
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.1 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400"
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                Sem cartão de crédito
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                Cancele quando quiser
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
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
            {/* Container que SANGRA: estende além da viewport pra direita.
                lg:top-[58%] empurra cards ligeiramente ABAIXO do centro
                vertical pra dar respiro do header (evita "Saldo Consolidado"
                + "Receitas" colarem nos itens do menu). */}
            <div className="relative lg:absolute lg:left-0 lg:right-[-15vw] lg:top-[58%] lg:-translate-y-1/2">
              <HeroVisual />
            </div>
          </motion.div>
        </div>

        {/* Espaçador pra preencher altura quando dashboards estão absolutos no desktop.
            720px = acomoda o offset top-[58%] sem cortar o último card abaixo. */}
        <div className="hidden lg:block lg:h-[720px]" aria-hidden />
      </div>
    </section>
  )
}
