// Sprint Landing v2 Elite (30/05/2026) — Variants compartilhados de
// animação Framer Motion. Tudo aqui é GPU-friendly (transform + opacity).

import type { Variants, Transition } from 'framer-motion'

// Easings curados (cubic-bezier do Apple/Vercel — natural, fluido)
export const EASE_OUT_EXPO: Transition['ease'] = [0.16, 1, 0.3, 1]
export const EASE_OUT_QUART: Transition['ease'] = [0.25, 1, 0.5, 1]
export const EASE_IN_OUT_QUART: Transition['ease'] = [0.76, 0, 0.24, 1]

/** Fade + slide-up sutil. Padrão pra blocos entrando em scroll. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
}

/** Versão maior pra hero (entrada inicial). */
export const fadeUpHero: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: EASE_OUT_EXPO },
  },
}

/** Stagger pra containers que escalonam filhos. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
}

/** Reveal por palavra/letra do title — usa span por palavra. */
export const wordReveal: Variants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE_OUT_EXPO },
  },
}

/** Scale-up sutil pra cards. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
}

/** Float (perpetual) pra elementos decorativos. */
export const floatY: Variants = {
  hidden: { y: 0 },
  visible: {
    y: [-4, 4, -4],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
}
