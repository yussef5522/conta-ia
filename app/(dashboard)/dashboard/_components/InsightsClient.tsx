'use client'

// Wrapper client da seção AI Insights — Sprint 2 Dia 5.
//
// Responsabilidades:
//   1. Animação de entrada stagger (Framer Motion) apenas na 1ª render da sessão
//      (flag sessionStorage). F5/toggle de período NÃO re-anima.
//   2. AnimatePresence pra animação de saída ao dispensar.
//   3. Modo carrossel CSS scroll-snap em mobile quando count ≥ 4.
//      Desktop e ≤3 insights: grid normal.
//   4. prefers-reduced-motion: respeitado via useReducedMotion do framer.

import { useEffect, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion'
import { cn } from '@/lib/utils'
import { CAROUSEL_MIN_INSIGHTS } from '@/lib/insights/carousel-threshold'
import type { Insight } from '@/lib/insights/types'
import { InsightCard } from './InsightCard'

const ANIM_FLAG_KEY = 'insights-anim-seen'

interface InsightsClientProps {
  insights: Insight[]
}

export function InsightsClient({ insights }: InsightsClientProps) {
  const reducedMotion = useReducedMotion()
  const [items, setItems] = useState<Insight[]>(insights)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // Refresca lista se prop mudar (toggle de empresa, refresh server)
  useEffect(() => {
    setItems(insights)
  }, [insights])

  // 1ª render da sessão: define shouldAnimate=true, marca flag.
  // F5 ou navegação subsequente: shouldAnimate=false.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const seen = window.sessionStorage.getItem(ANIM_FLAG_KEY)
      if (!seen) {
        setShouldAnimate(true)
        window.sessionStorage.setItem(ANIM_FLAG_KEY, '1')
      }
    } catch {
      // sessionStorage indisponível — anima por padrão (degradação suave)
      setShouldAnimate(true)
    }
  }, [])

  function handleDismissed(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function handleRestore(insight: Insight) {
    setItems((prev) => {
      if (prev.some((i) => i.id === insight.id)) return prev
      // Reinsere preservando ordem original do server
      const originalIdx = insights.findIndex((i) => i.id === insight.id)
      if (originalIdx === -1) return [...prev, insight]
      const next = [...prev]
      next.splice(originalIdx, 0, insight)
      return next
    })
  }

  // Lista final pode ficar vazia após dismissar tudo → mostra mini-empty inline
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Tudo dispensado nesta sessão. Recarregue pra revisitar.
      </p>
    )
  }

  const useCarousel = items.length >= CAROUSEL_MIN_INSIGHTS
  const enableAnim = shouldAnimate && !reducedMotion

  return (
    <>
      <div
        data-testid="insights-grid"
        data-carousel={useCarousel ? 'true' : 'false'}
        className={cn(
          'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
          // Quando count ≥ 4: vira carrossel horizontal SÓ no mobile (<640px)
          useCarousel &&
            'max-sm:flex max-sm:gap-3 max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:pb-2 max-sm:-mx-4 max-sm:px-4',
        )}
        onScroll={
          useCarousel
            ? (e) => {
                const el = e.currentTarget
                const cardWidth = el.clientWidth * 0.85 + 12 // 85% + gap-3
                const idx = Math.round(el.scrollLeft / cardWidth)
                if (idx !== activeIndex) setActiveIndex(idx)
              }
            : undefined
        }
      >
        <AnimatePresence initial={false}>
          {items.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={enableAnim ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.9, x: -20 }
              }
              transition={{
                duration: reducedMotion ? 0 : 0.4,
                delay: enableAnim ? i * 0.08 : 0,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                useCarousel && 'max-sm:min-w-[85%] max-sm:snap-start',
              )}
            >
              <InsightCard
                insight={insight}
                onDismissed={handleDismissed}
                onRestore={handleRestore}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dots indicator — visível só no carrossel mobile */}
      {useCarousel && (
        <div
          className="flex justify-center gap-1.5 mt-3 sm:hidden"
          aria-hidden="true"
        >
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === activeIndex
                  ? 'w-4 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
      )}
    </>
  )
}
