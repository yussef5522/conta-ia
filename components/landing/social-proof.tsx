// Sprint Landing Page (30/05/2026) — Faixa de prova social/quantificação.
// Sem inventar números: foco em afirmações verdadeiras sobre o produto.

import { Shield, Zap, Brain, FileCheck } from 'lucide-react'

const TRUST_POINTS = [
  {
    icon: Zap,
    label: 'Import em segundos',
    sub: 'OFX · Excel · CSV — sem mapeamento manual',
  },
  {
    icon: Brain,
    label: 'IA contadora 24/7',
    sub: 'Aprende seus padrões a cada confirmação',
  },
  {
    icon: FileCheck,
    label: 'DRE e Fluxo profissional',
    sub: 'Padrão BR, prontos pra apresentar',
  },
  {
    icon: Shield,
    label: 'Multi-empresa nativo',
    sub: 'Consolide quantos CNPJs você gerencia',
  },
] as const

export function LandingSocialProof() {
  return (
    <section className="border-y border-slate-200/70 bg-slate-50/50 py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
          {TRUST_POINTS.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="shrink-0 h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Icon size={16} className="text-violet-600" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight">
                  {label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
