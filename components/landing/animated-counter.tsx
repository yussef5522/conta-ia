'use client'

// Sprint Landing v2 Elite (30/05/2026) — Contador animado (count-up) ao
// entrar na viewport. Respeita prefers-reduced-motion via Framer Motion
// padrão (animação é instantânea quando RM=reduce).

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  prefix?: string
  suffix?: string
  /** Casas decimais. 0 = inteiro. */
  decimals?: number
  /** Duração em segundos. */
  duration?: number
  className?: string
  /** Formatador customizado — recebe o valor atual e retorna string. */
  format?: (v: number) => string
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.6,
  className,
  format,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const motionVal = useMotionValue(0)
  const display = useTransform(motionVal, (v) => {
    if (format) return format(v)
    return prefix + v.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + suffix
  })
  const [text, setText] = useState<string>(() => {
    if (format) return format(0)
    return prefix + (0).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + suffix
  })

  useEffect(() => {
    if (!inView) return
    const controls = animate(motionVal, value, { duration, ease: [0.16, 1, 0.3, 1] })
    const unsub = display.on('change', (latest) => setText(latest))
    return () => {
      controls.stop()
      unsub()
    }
  }, [inView, motionVal, value, duration, display])

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  )
}
