'use client'

// Sprint 5.0.2.c.2 — Tab Análise com 3 sub-seções.
// Sprint 5.0.2.d adicionou Análise IA (Claude Sonnet 4.6).

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ExpertiseSection } from '@/components/tributario/expertise-section'
import { ComparativoSection } from '@/components/tributario/comparativo-section'
import { AiAnalysisSection } from '@/components/tributario/ai-analysis-section'
import { Sparkles, Scale, Bot } from 'lucide-react'

type Sub = 'ia' | 'expertise' | 'comparativo'

export function AnaliseTab() {
  const [sub, setSub] = useState<Sub>('ia')

  return (
    <div className="space-y-4">
      <div className="inline-flex bg-zinc-100 rounded-lg p-1 flex-wrap gap-1">
        <SubPill active={sub === 'ia'} onClick={() => setSub('ia')}>
          <Bot className="h-3.5 w-3.5" />
          Análise IA
        </SubPill>
        <SubPill active={sub === 'expertise'} onClick={() => setSub('expertise')}>
          <Sparkles className="h-3.5 w-3.5" />
          Análise CNAE
        </SubPill>
        <SubPill active={sub === 'comparativo'} onClick={() => setSub('comparativo')}>
          <Scale className="h-3.5 w-3.5" />
          Comparativo de Regimes
        </SubPill>
      </div>

      {sub === 'ia' && <AiAnalysisSection />}
      {sub === 'expertise' && <ExpertiseSection />}
      {sub === 'comparativo' && <ComparativoSection />}
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
