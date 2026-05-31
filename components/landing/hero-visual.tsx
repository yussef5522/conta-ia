'use client'

// Sprint Landing v2 Elite (30/05/2026) — Visual do Hero com profundidade,
// glassmorphism, motion. Cards reais dos dashboards CAIXAOS dispostos com
// perspectiva 3D sutil, sombras profundas, animação de entrada escalonada.

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { AnimatedCounter } from './animated-counter'
import { EASE_OUT_EXPO } from '@/lib/motion/variants'

const HEATMAP_CELLS = [
  [0.92, 0.85, 0.78, 0.95, 0.88, 0.91],
  [0.62, 0.55, 0.71, 0.58, 0.64, 0.59],
  [0.38, 0.45, 0.42, 0.51, 0.39, 0.44],
  [0.25, 0.31, 0.18, 0.28, 0.22, 0.33],
  [0.15, 0.12, 0.18, 0.21, 0.14, 0.19],
] as const

const HEATMAP_ROWS = ['Folha', 'Aluguel', 'Marketing', 'Energia', 'Manut.']
const HEATMAP_COLS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']

function heatmapColor(v: number): string {
  if (v < 0.2) return '#f5f3ff'
  if (v < 0.35) return '#ede9fe'
  if (v < 0.5) return '#ddd6fe'
  if (v < 0.65) return '#c4b5fd'
  if (v < 0.8) return '#a78bfa'
  return '#7c3aed'
}

function heatmapText(v: number): string {
  return v > 0.6 ? '#fff' : '#1e293b'
}

export function HeroVisual() {
  return (
    <div className="relative w-full hero-card-tilt">
      <div className="relative grid grid-cols-12 gap-3 sm:gap-4">
        {/* === KPI Card grande — col-span 7 === */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.4 }}
          className="col-span-12 sm:col-span-7 rounded-2xl bg-white border border-slate-200/60 shadow-floating p-5 sm:p-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Saldo Consolidado
              </p>
              <p className="mt-2.5 text-3xl sm:text-[2.4rem] font-semibold tracking-tight text-slate-900 tabular-nums leading-none">
                <AnimatedCounter value={487293} prefix="R$ " duration={2} />
              </p>
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 tabular-nums">
                  ↑ 12,4%
                </span>
                <span className="text-xs text-slate-400">vs mês anterior</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center ring-1 ring-violet-200/60">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M3 3v18h18" strokeLinecap="round" />
                <path d="M7 14l4-4 4 4 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Sparkline animada */}
          <svg viewBox="0 0 300 70" className="mt-5 w-full h-20">
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="spark-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,52 L25,48 L50,54 L75,42 L100,46 L125,36 L150,38 L175,28 L200,32 L225,22 L250,26 L275,14 L300,10 L300,70 L0,70 Z"
              fill="url(#spark-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5, delay: 1, ease: EASE_OUT_EXPO }}
            />
            <motion.path
              d="M0,52 L25,48 L50,54 L75,42 L100,46 L125,36 L150,38 L175,28 L200,32 L225,22 L250,26 L275,14 L300,10"
              fill="none"
              stroke="url(#spark-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.8, ease: EASE_OUT_EXPO }}
            />
          </svg>
        </motion.div>

        {/* === Mini-KPIs dupla === */}
        <div className="col-span-12 sm:col-span-5 grid grid-rows-2 gap-3 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.5 }}
            className="rounded-2xl bg-white border border-slate-200/60 shadow-floating p-5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Receitas (mês)
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              <AnimatedCounter value={142580} prefix="R$ " duration={1.8} />
            </p>
            <p className="mt-1 text-xs text-emerald-600 tabular-nums">↑ 8,2%</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.6 }}
            className="rounded-2xl bg-white border border-slate-200/60 shadow-floating p-5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Despesas (mês)
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              <AnimatedCounter value={98412} prefix="R$ " duration={1.8} />
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">↓ 3,1%</p>
          </motion.div>
        </div>

        {/* === Heatmap === */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.7 }}
          className="col-span-12 sm:col-span-7 rounded-2xl bg-white border border-slate-200/60 shadow-floating p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Comparativo · Despesas
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                Heatmap semestral
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>Menor</span>
              <div className="flex gap-0.5">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                  <div
                    key={v}
                    className="w-3 h-3 rounded-sm"
                    style={{ background: heatmapColor(v) }}
                  />
                ))}
              </div>
              <span>Maior</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-slate-400 px-2 py-1.5 bg-slate-50/60">
                    Categoria
                  </th>
                  {HEATMAP_COLS.map((c) => (
                    <th
                      key={c}
                      className="text-center text-[10px] font-medium text-slate-400 px-1 py-1.5 bg-slate-50/60 tabular-nums"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP_ROWS.map((row, ri) => (
                  <tr key={row} className="border-t border-slate-100">
                    <td className="text-xs font-medium text-slate-700 px-2 py-1.5">
                      {row}
                    </td>
                    {HEATMAP_CELLS[ri].map((v, ci) => (
                      <td key={ci} className="p-0.5">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.4,
                            delay: 1.2 + (ri * 6 + ci) * 0.025,
                            ease: EASE_OUT_EXPO,
                          }}
                          className="w-full h-7 rounded flex items-center justify-center text-[10px] font-medium tabular-nums"
                          style={{ background: heatmapColor(v), color: heatmapText(v) }}
                        >
                          {Math.round(v * 100)}
                        </motion.div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* === Waterfall mini === */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.8 }}
          className="col-span-12 sm:col-span-5 rounded-2xl bg-white border border-slate-200/60 shadow-floating p-5"
        >
          <div className="mb-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Análise de Variação
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Waterfall · Mai → Jun
            </p>
          </div>

          <svg viewBox="0 0 260 140" className="w-full h-32">
            <line x1="20" y1="120" x2="260" y2="120" stroke="#e2e8f0" strokeWidth="1" />

            <motion.rect
              initial={{ height: 0, y: 120 }}
              animate={{ height: 70, y: 50 }}
              transition={{ duration: 0.6, delay: 1.3, ease: EASE_OUT_EXPO }}
              x="22" width="32" rx="2" fill="#cbd5e1"
            />
            <text x="38" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Início</text>

            <line x1="54" y1="50" x2="64" y2="50" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            <motion.rect
              initial={{ height: 0, y: 50 }}
              animate={{ height: 28, y: 22 }}
              transition={{ duration: 0.6, delay: 1.45, ease: EASE_OUT_EXPO }}
              x="64" width="32" rx="2" fill="#10b981"
            />
            <text x="80" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Receita</text>
            <text x="80" y="18" textAnchor="middle" fontSize="8" fontWeight="600" fill="#10b981">+R$28k</text>

            <line x1="96" y1="22" x2="106" y2="22" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            <motion.rect
              initial={{ height: 0, y: 22 }}
              animate={{ height: 42, y: 22 }}
              transition={{ duration: 0.6, delay: 1.6, ease: EASE_OUT_EXPO }}
              x="106" width="32" rx="2" fill="#ef4444"
            />
            <text x="122" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Despesa</text>
            <text x="122" y="78" textAnchor="middle" fontSize="8" fontWeight="600" fill="#ef4444">−R$42k</text>

            <line x1="138" y1="64" x2="148" y2="64" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            <motion.rect
              initial={{ height: 0, y: 64 }}
              animate={{ height: 24, y: 64 }}
              transition={{ duration: 0.6, delay: 1.75, ease: EASE_OUT_EXPO }}
              x="148" width="32" rx="2" fill="#f87171"
            />
            <text x="164" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Imp.</text>
            <text x="164" y="100" textAnchor="middle" fontSize="8" fontWeight="600" fill="#ef4444">−R$24k</text>

            <line x1="180" y1="88" x2="190" y2="88" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            <motion.rect
              initial={{ height: 0, y: 88 }}
              animate={{ height: 32, y: 88 }}
              transition={{ duration: 0.6, delay: 1.9, ease: EASE_OUT_EXPO }}
              x="190" width="48" rx="2" fill="#7c3aed"
            />
            <text x="214" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Final</text>
          </svg>
        </motion.div>
      </div>

      {/* === AI Insight overlay flutuante === */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 2.2 }}
        className="absolute -bottom-6 -right-2 sm:-bottom-8 sm:-right-8 max-w-[300px]"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative rounded-2xl glass-dark text-white p-4 shadow-2xl shadow-violet-900/40 overflow-hidden"
        >
          {/* Glow interno */}
          <div
            aria-hidden
            className="absolute -top-12 -left-12 h-24 w-24 rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.6), transparent)' }}
          />
          <div className="relative flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
              <Sparkles size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">
                IA Detectou
              </p>
              <p className="mt-1 text-[13px] leading-snug text-white/95">
                Gasto com energia cresceu{' '}
                <span className="font-semibold text-white bg-violet-500/30 px-1 rounded">
                  +18%
                </span>{' '}
                nas 3 últimas faturas. Vale revisar.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
