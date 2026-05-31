'use client'

// Sprint Landing v3.3 (31/05/2026) — Hero visual COMPACTO em Bento.
// Mesmos 8 cards + AI overlay, mas todos reduzidos pra caber em 1 viewport
// notebook (1366×768 / 1440×900). Comparativo com Conta Azul: tudo cabe
// numa tela, sem rolar.

import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { AnimatedCounter } from './animated-counter'
import { EASE_OUT_EXPO } from '@/lib/motion/variants'

/* ====== dados visuais ====== */
const HEATMAP_CELLS = [
  [0.92, 0.85, 0.78, 0.95, 0.88, 0.91],
  [0.62, 0.55, 0.71, 0.58, 0.64, 0.59],
  [0.38, 0.45, 0.42, 0.51, 0.39, 0.44],
  [0.25, 0.31, 0.18, 0.28, 0.22, 0.33],
] as const

const HEATMAP_ROWS = ['Folha', 'Aluguel', 'Marketing', 'Energia']
const HEATMAP_COLS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']

const BAR_DATA = [
  { mes: 'Dez', valor: 0.62 },
  { mes: 'Jan', valor: 0.78 },
  { mes: 'Fev', valor: 0.85 },
  { mes: 'Mar', valor: 0.71 },
  { mes: 'Abr', valor: 0.92 },
  { mes: 'Mai', valor: 1.0 },
] as const

const RECENT_TXS = [
  { kind: 'in', desc: 'Mensalidade · Mauro S.', cat: 'Receita', val: 'R$ 320', when: 'Agora' },
  { kind: 'out', desc: 'PIX · Aluguel Unid. 02', cat: 'Aluguel', val: 'R$ 4.800', when: '12m' },
  { kind: 'in', desc: 'Mensalidade · Patrícia L.', cat: 'Receita', val: 'R$ 290', when: '38m' },
] as const

const CONTAS_VENCER = [
  { dia: '02', forn: 'Energia ENEL', val: 'R$ 1.240', urgent: true },
  { dia: '05', forn: 'Folha Maio', val: 'R$ 28.400', urgent: false },
  { dia: '08', forn: 'Aluguel Unid.', val: 'R$ 4.800', urgent: false },
] as const

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
      {/* Grid Bento compacto. lg: 900px wide (era 1080px). */}
      <div className="relative grid grid-cols-12 gap-2.5 lg:w-[900px]">
        {/* === ROW 1: KPI Saldo (7c, row-span-2) + Receitas/Despesas === */}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.4 }}
          className="col-span-7 row-span-2 rounded-xl hero-card-on-dark p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Saldo Consolidado · 4 contas
              </p>
              <p className="mt-1.5 text-[1.65rem] font-bold tracking-tight text-slate-900 tabular-nums leading-none">
                <AnimatedCounter value={487293} prefix="R$ " duration={2} />
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums">
                  ↑ 12,4%
                </span>
                <span className="text-[10px] text-slate-400">vs mês ant.</span>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center ring-1 ring-violet-200/60">
              <TrendingUp size={15} className="text-violet-700" strokeWidth={2.5} />
            </div>
          </div>

          {/* Sparkline compacta */}
          <svg viewBox="0 0 300 50" className="mt-3 w-full h-14">
            <defs>
              <linearGradient id="hv-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="hv-spark-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,38 L25,35 L50,40 L75,32 L100,34 L125,28 L150,29 L175,22 L200,25 L225,18 L250,22 L275,10 L300,7 L300,50 L0,50 Z"
              fill="url(#hv-spark-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5, delay: 1, ease: EASE_OUT_EXPO }}
            />
            <motion.path
              d="M0,38 L25,35 L50,40 L75,32 L100,34 L125,28 L150,29 L175,22 L200,25 L225,18 L250,22 L275,10 L300,7"
              fill="none"
              stroke="url(#hv-spark-line)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.8, ease: EASE_OUT_EXPO }}
            />
            <circle cx="300" cy="7" r="2.5" fill="#7c3aed" />
            <circle cx="300" cy="7" r="5" fill="#7c3aed" opacity="0.25" />
          </svg>

          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Banrisul</span>
              <span className="h-2.5 w-px bg-slate-200" />
              <span>Sicredi</span>
              <span className="h-2.5 w-px bg-slate-200" />
              <span>Sicoob</span>
              <span className="text-slate-400">+1</span>
            </div>
            <span className="text-violet-700 font-medium">Detalhar →</span>
          </div>
        </motion.div>

        {/* Mini KPI Receitas */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.5 }}
          className="col-span-5 rounded-xl hero-card-on-dark p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Receitas
            </p>
            <div className="h-6 w-6 rounded-md bg-emerald-50 flex items-center justify-center">
              <ArrowDownLeft size={12} className="text-emerald-600" strokeWidth={2.5} />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900 tabular-nums">
            <AnimatedCounter value={142580} prefix="R$ " duration={1.8} />
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-600 tabular-nums">↑ 8,2%</p>
        </motion.div>

        {/* Mini KPI Despesas */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.55 }}
          className="col-span-5 rounded-xl hero-card-on-dark p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Despesas
            </p>
            <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
              <ArrowUpRight size={12} className="text-slate-700" strokeWidth={2.5} />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900 tabular-nums">
            <AnimatedCounter value={98412} prefix="R$ " duration={1.8} />
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">↓ 3,1%</p>
        </motion.div>

        {/* === ROW 3: Barras + Heatmap === */}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.65 }}
          className="col-span-5 rounded-xl hero-card-on-dark p-3.5"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Faturamento
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                Semestral
              </p>
            </div>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              +24%
            </span>
          </div>

          <div className="flex items-end justify-between gap-1 h-16">
            {BAR_DATA.map((b, i) => (
              <div key={b.mes} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: 0.6,
                    delay: 1.2 + i * 0.08,
                    ease: EASE_OUT_EXPO,
                  }}
                  style={{
                    height: `${b.valor * 56}px`,
                    transformOrigin: 'bottom',
                    background:
                      i === BAR_DATA.length - 1
                        ? 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)'
                        : 'linear-gradient(180deg, #e9d5ff 0%, #c4b5fd 100%)',
                  }}
                  className="w-full rounded"
                />
                <span
                  className={[
                    'text-[8px] tabular-nums leading-none',
                    i === BAR_DATA.length - 1
                      ? 'text-violet-700 font-bold'
                      : 'text-slate-400',
                  ].join(' ')}
                >
                  {b.mes}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.7 }}
          className="col-span-7 rounded-xl hero-card-on-dark p-3.5"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Comparativo · Despesas
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                Heatmap por categoria
              </p>
            </div>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                <div
                  key={v}
                  className="w-2 h-2 rounded-sm"
                  style={{ background: heatmapColor(v) }}
                />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-100">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-medium text-slate-400 px-1.5 py-0.5 bg-slate-50/60 w-16">
                    Cat
                  </th>
                  {HEATMAP_COLS.map((c) => (
                    <th
                      key={c}
                      className="text-center text-[9px] font-medium text-slate-400 px-0.5 py-0.5 bg-slate-50/60 tabular-nums"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP_ROWS.map((row, ri) => (
                  <tr key={row} className="border-t border-slate-100">
                    <td className="text-[10px] font-medium text-slate-700 px-1.5 py-0.5">
                      {row}
                    </td>
                    {HEATMAP_CELLS[ri].map((v, ci) => (
                      <td key={ci} className="p-px">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.4,
                            delay: 1.2 + (ri * 6 + ci) * 0.02,
                            ease: EASE_OUT_EXPO,
                          }}
                          className="w-full h-4 rounded-sm flex items-center justify-center text-[8px] font-semibold tabular-nums leading-none"
                          style={{
                            background: heatmapColor(v),
                            color: heatmapText(v),
                          }}
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

        {/* === ROW 4: Atividade + Contas a vencer === */}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.8 }}
          className="col-span-7 rounded-xl hero-card-on-dark p-3.5"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Atividade Recente
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                Últimas transações
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-700 bg-violet-50 ring-1 ring-violet-200 px-1.5 py-0.5 rounded">
              <span className="h-1 w-1 rounded-full bg-violet-600 animate-pulse" />
              AO VIVO
            </span>
          </div>

          <ul className="space-y-1.5">
            {RECENT_TXS.map((tx, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 1.3 + i * 0.08,
                  ease: EASE_OUT_EXPO,
                }}
                className="flex items-center gap-2.5"
              >
                <div
                  className={[
                    'shrink-0 h-7 w-7 rounded-md flex items-center justify-center',
                    tx.kind === 'in'
                      ? 'bg-emerald-50 ring-1 ring-emerald-200/50'
                      : 'bg-slate-100 ring-1 ring-slate-200/50',
                  ].join(' ')}
                >
                  {tx.kind === 'in' ? (
                    <ArrowDownLeft size={12} className="text-emerald-600" strokeWidth={2.5} />
                  ) : (
                    <ArrowUpRight size={12} className="text-slate-700" strokeWidth={2.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-900 truncate leading-tight">
                    {tx.desc}
                  </p>
                  <p className="text-[9px] text-slate-500 truncate leading-tight">{tx.cat}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={[
                      'text-[11px] font-bold tabular-nums leading-tight',
                      tx.kind === 'in' ? 'text-emerald-600' : 'text-slate-900',
                    ].join(' ')}
                  >
                    {tx.kind === 'in' ? '+' : '−'}
                    {tx.val}
                  </p>
                  <p className="text-[9px] text-slate-400 leading-tight">{tx.when}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.85 }}
          className="col-span-5 rounded-xl hero-card-on-dark p-3.5"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Próximos 7d
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                A vencer
              </p>
            </div>
            <Clock size={12} className="text-slate-400" />
          </div>

          <ul className="space-y-1.5">
            {CONTAS_VENCER.map((c, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 1.4 + i * 0.08,
                  ease: EASE_OUT_EXPO,
                }}
                className="flex items-center gap-2"
              >
                <div
                  className={[
                    'shrink-0 h-7 w-7 rounded-md flex flex-col items-center justify-center text-[9px] font-bold ring-1 leading-none',
                    c.urgent
                      ? 'bg-amber-50 text-amber-700 ring-amber-200'
                      : 'bg-slate-50 text-slate-700 ring-slate-200',
                  ].join(' ')}
                >
                  <span className="tabular-nums">{c.dia}</span>
                  <span className="text-[7px] uppercase mt-0.5">JUN</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-900 truncate leading-tight">
                    {c.forn}
                  </p>
                  <p className="text-[9px] text-slate-500 tabular-nums leading-tight">
                    {c.val}
                  </p>
                </div>
                {c.urgent && (
                  <span className="shrink-0 text-[8px] font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-1 py-0.5 rounded">
                    URG
                  </span>
                )}
              </motion.li>
            ))}
          </ul>

          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[9px] text-slate-500">Total 7d</span>
            <span className="text-[11px] font-bold text-slate-900 tabular-nums">
              R$ 34.440
            </span>
          </div>
        </motion.div>
      </div>

      {/* === AI Insight overlay flutuante === */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 2.2 }}
        className="absolute -bottom-3 left-[3%] sm:-bottom-4 sm:left-[6%] max-w-[280px] z-20"
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative rounded-xl hero-card-on-dark-glass text-white p-3 overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute -top-10 -left-10 h-20 w-20 rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.7), transparent)' }}
          />
          <div className="relative flex items-start gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-md shadow-violet-900/40 ring-1 ring-violet-300/40">
              <Sparkles size={13} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-300">
                IA Detectou
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/95">
                Energia cresceu{' '}
                <span className="font-bold text-white bg-violet-500/30 px-1 rounded">
                  +18%
                </span>{' '}
                nas 3 últimas faturas.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
