// Sprint Landing Page (30/05/2026) — Tabela CAIXAOS vs Planilha vs "Sistema tradicional".
// Sem citar concorrente por nome (questão legal).

import { Check, X } from 'lucide-react'

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
            'h-6 w-6 rounded-full flex items-center justify-center',
            primary ? 'bg-violet-600' : 'bg-emerald-500',
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
        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
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
    <section className="relative py-20 sm:py-28 bg-slate-50/50 border-y border-slate-200/70">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
            Por que CAIXAOS?
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.02em] text-slate-900 leading-[1.1]">
            O que sai de R$ 49/mês não te leva longe
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Compara o que você teria com planilha, com um sistema financeiro
            tradicional, e com o CAIXAOS.
          </p>
        </div>

        <div className="mt-12 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-lg shadow-slate-900/5">
          <div className="grid grid-cols-12 bg-slate-50/70 border-b border-slate-200">
            <div className="col-span-6 px-4 sm:px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Recurso
              </p>
            </div>
            <div className="col-span-2 px-2 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Planilha
              </p>
            </div>
            <div className="col-span-2 px-2 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Tradicional
              </p>
            </div>
            <div className="col-span-2 px-2 py-4 text-center relative">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                CAIXAOS
              </p>
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-violet-500 to-transparent"
              />
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={row.feature}
              className={[
                'grid grid-cols-12 items-center',
                i < ROWS.length - 1 ? 'border-b border-slate-100' : '',
              ].join(' ')}
            >
              <div className="col-span-6 px-4 sm:px-6 py-3.5">
                <p className="text-sm text-slate-800">{row.feature}</p>
              </div>
              <div className="col-span-2 px-2 py-3.5">
                <Cell value={row.planilha} />
              </div>
              <div className="col-span-2 px-2 py-3.5">
                <Cell value={row.tradicional} />
              </div>
              <div className="col-span-2 px-2 py-3.5 bg-violet-50/30">
                <Cell value={row.caixaos} primary />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
