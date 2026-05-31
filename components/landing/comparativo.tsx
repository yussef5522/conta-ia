'use client'

// Sprint Landing v2 Elite (30/05/2026) — Tabela premium CAIXAOS vs Planilha
// vs Sistema Tradicional. Coluna CAIXAOS com destaque visual marcante.

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { SectionReveal } from './section-reveal'
import { fadeUp } from '@/lib/motion/variants'

interface Row {
  feature: string
  planilha: boolean | string
  tradicional: boolean | string
  caixaos: boolean | string
}

const ROWS: readonly Row[] = [
  { feature: 'Import OFX/Excel/CSV automático', planilha: false, tradicional: true, caixaos: true },
  { feature: 'Detecção do banco no extrato', planilha: false, tradicional: false, caixaos: true },
  { feature: 'IA categorizando sozinha', planilha: false, tradicional: false, caixaos: true },
  { feature: 'Dedup de transações repetidas', planilha: false, tradicional: 'Parcial', caixaos: true },
  { feature: 'DRE Gerencial padrão BR', planilha: false, tradicional: true, caixaos: true },
  { feature: 'Heatmap de variação por categoria', planilha: false, tradicional: false, caixaos: true },
  { feature: 'Waterfall de análise de resultado', planilha: false, tradicional: false, caixaos: true },
  { feature: 'Drill-down nas transações', planilha: false, tradicional: 'Limitado', caixaos: true },
  { feature: 'Insights automáticos por IA', planilha: false, tradicional: false, caixaos: true },
  { feature: 'Multi-empresa consolidado', planilha: false, tradicional: 'Caro', caixaos: true },
  { feature: 'Mobile responsivo', planilha: 'Ruim', tradicional: 'Parcial', caixaos: true },
] as const

function Cell({ value, primary }: { value: boolean | string; primary?: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div
          className={[
            'h-7 w-7 rounded-full flex items-center justify-center',
            primary
              ? 'bg-gradient-to-br from-violet-500 to-violet-700 shadow-lg shadow-violet-900/30'
              : 'bg-emerald-500',
          ].join(' ')}
        >
          <Check size={14} className="text-white" strokeWidth={3} />
        </div>
      </div>
    )
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
          <X size={14} className="text-slate-400" strokeWidth={2.5} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-center">
      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
        {value}
      </span>
    </div>
  )
}

export function LandingComparativo() {
  return (
    <section
      id="comparativo"
      className="relative py-28 sm:py-36 bg-slate-50 border-y border-slate-200/70 overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-64 opacity-50"
        style={{
          background:
            'radial-gradient(70% 100% at 50% 0%, rgba(237,233,254,0.8) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <SectionReveal variants={fadeUp}>
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600">
              Comparativo
            </p>
            <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] text-slate-900 leading-[1.05] font-display">
              O que sai de{' '}
              <span className="text-gradient-violet">R$ 49/mês</span>{' '}
              não te leva longe.
            </h2>
            <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
              Compare o que você teria com planilha, com um sistema financeiro
              tradicional, e com o CAIXAOS.
            </p>
          </div>
        </SectionReveal>

        <SectionReveal variants={fadeUp} amount={0.1}>
          <div className="mt-14 relative">
            {/* Glow atrás da tabela */}
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 opacity-40 blur-3xl"
              style={{
                background:
                  'radial-gradient(60% 50% at 80% 50%, rgba(124,58,237,0.25) 0%, transparent 70%)',
              }}
            />

            <div className="rounded-3xl bg-white border border-slate-200/80 overflow-hidden shadow-floating">
              <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-200">
                <div className="col-span-6 px-4 sm:px-7 py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Recurso
                  </p>
                </div>
                <div className="col-span-2 px-2 py-5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Planilha
                  </p>
                </div>
                <div className="col-span-2 px-2 py-5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Tradicional
                  </p>
                </div>
                <div className="col-span-2 px-2 py-5 text-center relative bg-violet-50/40">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                    CAIXAOS
                  </p>
                  <div
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-gradient-to-r from-violet-400 via-violet-600 to-violet-400"
                  />
                </div>
              </div>

              {ROWS.map((row, i) => (
                <motion.div
                  key={row.feature}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className={[
                    'grid grid-cols-12 items-center',
                    i < ROWS.length - 1 ? 'border-b border-slate-100' : '',
                  ].join(' ')}
                >
                  <div className="col-span-6 px-4 sm:px-7 py-4">
                    <p className="text-sm sm:text-[15px] text-slate-800">{row.feature}</p>
                  </div>
                  <div className="col-span-2 px-2 py-4">
                    <Cell value={row.planilha} />
                  </div>
                  <div className="col-span-2 px-2 py-4">
                    <Cell value={row.tradicional} />
                  </div>
                  <div className="col-span-2 px-2 py-4 bg-violet-50/30">
                    <Cell value={row.caixaos} primary />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}
