'use client'

// Sprint 5.0.2.c.2 — Tab Análise: 2 seções (Expert + Comparativo) com pills.

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ExpertiseSection } from '@/components/tributario/expertise-section'
import { ComparativoSection } from '@/components/tributario/comparativo-section'
import { Sparkles, Scale } from 'lucide-react'

type Sub = 'expertise' | 'comparativo'

export function AnaliseTab() {
  const [sub, setSub] = useState<Sub>('expertise')

  return (
    <div className="space-y-4">
      <div className="inline-flex bg-zinc-100 rounded-lg p-1">
        <SubPill active={sub === 'expertise'} onClick={() => setSub('expertise')}>
          <Sparkles className="h-3.5 w-3.5" />
          Análise CNAE
        </SubPill>
        <SubPill active={sub === 'comparativo'} onClick={() => setSub('comparativo')}>
          <Scale className="h-3.5 w-3.5" />
          Comparativo de Regimes
        </SubPill>
      </div>

      {sub === 'expertise' ? <ExpertiseSection /> : <ComparativoSection />}
    </div>
  )
}

function SubPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
        active
          ? 'bg-white text-zinc-900 shadow-sm'
          : 'text-zinc-600 hover:text-zinc-900',
      )}
    >
      {children}
    </button>
  )
}
