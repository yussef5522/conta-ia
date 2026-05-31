'use client'

// Sprint Landing v2 Elite (30/05/2026) — Wrapper que dispara animação de
// entrada quando o bloco entra na viewport (Intersection Observer via
// Framer Motion useInView).

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import type { Variants } from 'framer-motion'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'

interface SectionRevealProps {
  children: React.ReactNode
  className?: string
  variants?: Variants
  /** Margem do viewport (px) pra disparar a animação mais cedo. */
  amount?: number | 'some' | 'all'
  /** Once = true (default) → só anima na primeira vez. */
  once?: boolean
  as?: 'div' | 'section' | 'article' | 'header' | 'footer'
  id?: string
}

export function SectionReveal({
  children,
  className,
  variants = fadeUp,
  amount = 0.15,
  once = true,
  as = 'div',
  id,
}: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, amount })

  const MotionTag = motion[as] as typeof motion.div

  return (
    <MotionTag
      ref={ref}
      id={id}
      className={className}
      variants={variants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      {children}
    </MotionTag>
  )
}

/** Container reveal — escalona filhos com `variants={staggerContainer}`. */
export function StaggerReveal({
  children,
  className,
  amount = 0.15,
  once = true,
  as = 'div',
  id,
}: Omit<SectionRevealProps, 'variants'>) {
  return (
    <SectionReveal
      className={className}
      variants={staggerContainer}
      amount={amount}
      once={once}
      as={as}
      id={id}
    >
      {children}
    </SectionReveal>
  )
}
