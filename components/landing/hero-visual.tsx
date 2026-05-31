'use client'

// Sprint Landing v3 (30/05/2026) — Hero visual DENSO em layout Bento.
// 8 cards reais do dashboard CAIXAOS sangrando à direita, sobre fundo
// dark imersivo. Camadas hierárquicas, profundidade, organização.

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
  { kind: 'out', desc: 'PIX · Aluguel Unidade 02', cat: 'Aluguel', val: 'R$ 4.800', when: '12min' },
  { kind: 'in', desc: 'Mensalidade · Patrícia L.', cat: 'Receita', val: 'R$ 290', when: '38min' },
  { kind: 'out', desc: 'DEB AUTO · Energia', cat: 'Utilidades', val: 'R$ 1.240', when: '2h' },
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
      {/* Grid principal Bento: 12 cols × variável rows.
          lg: 1080px wide+ (sangrando viewport). */}
      <div className="relative grid grid-cols-12 gap-3 sm:gap-4 lg:w-[1080px]">
        {/* === ROW 1 === */}

        {/* KPI Saldo Consolidado — 7 cols, alto */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.4 }}
          className="col-span-7 row-span-2 rounded-2xl hero-card-on-dark p-5 sm:p-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Saldo Consolidado · 4 contas
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
              <TrendingUp size={20} className="text-violet-700" strokeWidth={2.5} />
            </div>
          </div>

          {/* Sparkline */}
          <svg viewBox="0 0 300 80" className="mt-5 w-full h-24">
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
              d="M0,62 L25,58 L50,64 L75,52 L100,56 L125,46 L150,48 L175,38 L200,42 L225,32 L250,36 L275,18 L300,14 L300,80 L0,80 Z"
              fill="url(#hv-spark-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5, delay: 1, ease: EASE_OUT_EXPO }}
            />
            <motion.path
              d="M0,62 L25,58 L50,64 L75,52 L100,56 L125,46 L150,48 L175,38 L200,42 L225,32 L250,36 L275,18 L300,14"
              fill="none"
              stroke="url(#hv-spark-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.8, ease: EASE_OUT_EXPO }}
            />
            {/* Pontos finais */}
            <circle cx="300" cy="14" r="3.5" fill="#7c3aed" />
            <circle cx="300" cy="14" r="6" fill="#7c3aed" opacity="0.25" />
          </svg>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-slate-500">
              <span>Banrisul</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>Sicredi</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>Sicoob</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>+1</span>
            </div>
            <span className="text-violet-700 font-medium">Detalhar →</span>
          </div>
        </motion.div>

        {/* Mini KPI Receitas — 5 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.5 }}
          className="col-span-5 rounded-2xl hero-card-on-dark p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Receitas (mês)
            </p>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ArrowDownLeft size={14} className="text-emerald-600" strokeWidth={2.5} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            <AnimatedCounter value={142580} prefix="R$ " duration={1.8} />
          </p>
          <p className="mt-1 text-xs text-emerald-600 tabular-nums">↑ 8,2% vs Abr</p>
        </motion.div>

        {/* Mini KPI Despesas — 5 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.55 }}
          className="col-span-5 rounded-2xl hero-card-on-dark p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Despesas (mês)
            </p>
            <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <ArrowUpRight size={14} className="text-slate-700" strokeWidth={2.5} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            <AnimatedCounter value={98412} prefix="R$ " duration={1.8} />
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">↓ 3,1% vs Abr</p>
        </motion.div>

        {/* === ROW 3 === */}

        {/* Barras Faturamento mensal — 5 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.65 }}
          className="col-span-5 rounded-2xl hero-card-on-dark p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Faturamento
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                Semestral
              </p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              +24%
            </span>
          </div>

          <div className="flex items-end justify-between gap-1.5 h-24">
            {BAR_DATA.map((b, i) => (
              <div key={b.mes} className="flex-1 flex flex-col items-center gap-1.5">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: 0.6,
                    delay: 1.2 + i * 0.08,
                    ease: EASE_OUT_EXPO,
                  }}
                  style={{
                    height: `${b.valor * 88}px`,
                    transformOrigin: 'bottom',
                    background:
                      i === BAR_DATA.length - 1
                        ? 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)'
                        : 'linear-gradient(180deg, #e9d5ff 0%, #c4b5fd 100%)',
                  }}
                  className="w-full rounded-md"
                />
                <span
                  className={[
                    'text-[9px] tabular-nums',
                    i === BAR_DATA.length - 1
                      ? 'text-violet-700 font-semibold'
                      : 'text-slate-400',
                  ].join(' ')}
                >
                  {b.mes}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Heatmap compacto — 7 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.7 }}
          className="col-span-7 rounded-2xl hero-card-on-dark p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Comparativo · Despesas
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                Heatmap por categoria
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <div className="flex gap-0.5">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                  <div
                    key={v}
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: heatmapColor(v) }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-slate-400 px-2 py-1 bg-slate-50/60 w-20">
                    Cat
                  </th>
                  {HEATMAP_COLS.map((c) => (
                    <th
                      key={c}
                      className="text-center text-[10px] font-medium text-slate-400 px-1 py-1 bg-slate-50/60 tabular-nums"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP_ROWS.map((row, ri) => (
                  <tr key={row} className="border-t border-slate-100">
                    <td className="text-[11px] font-medium text-slate-700 px-2 py-1">
                      {row}
                    </td>
                    {HEATMAP_CELLS[ri].map((v, ci) => (
                      <td key={ci} className="p-0.5">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.4,
                            delay: 1.2 + (ri * 6 + ci) * 0.022,
                            ease: EASE_OUT_EXPO,
                          }}
                          className="w-full h-6 rounded flex items-center justify-center text-[10px] font-medium tabular-nums"
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

        {/* === ROW 4 === */}

        {/* Transações recentes — 7 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.8 }}
          className="col-span-7 rounded-2xl hero-card-on-dark p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Atividade Recente
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                Últimas transações
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 ring-1 ring-violet-200 px-2 py-0.5 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-pulse" />
              AO VIVO
            </span>
          </div>

          <ul className="space-y-2">
            {RECENT_TXS.map((tx, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 1.3 + i * 0.08,
                  ease: EASE_OUT_EXPO,
                }}
                className="flex items-center gap-3 py-1.5"
              >
                <div
                  className={[
                    'shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
                    tx.kind === 'in'
                      ? 'bg-emerald-50 ring-1 ring-emerald-200/50'
                      : 'bg-slate-100 ring-1 ring-slate-200/50',
                  ].join(' ')}
                >
                  {tx.kind === 'in' ? (
                    <ArrowDownLeft size={14} className="text-emerald-600" strokeWidth={2.5} />
                  ) : (
                    <ArrowUpRight size={14} className="text-slate-700" strokeWidth={2.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">
                    {tx.desc}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{tx.cat}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={[
                      'text-xs font-semibold tabular-nums',
                      tx.kind === 'in' ? 'text-emerald-600' : 'text-slate-900',
                    ].join(' ')}
                  >
                    {tx.kind === 'in' ? '+' : '−'}
                    {tx.val}
                  </p>
                  <p className="text-[10px] text-slate-400">{tx.when}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Contas a vencer — 5 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_OUT_EXPO, delay: 0.85 }}
          className="col-span-5 rounded-2xl hero-card-on-dark p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Próximos 7 dias
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                Contas a vencer
              </p>
            </div>
            <Clock size={14} className="text-slate-400" />
          </div>

          <ul className="space-y-2">
            {CONTAS_VENCER.map((c, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 1.4 + i * 0.08,
                  ease: EASE_OUT_EXPO,
                }}
                className="flex items-center gap-3"
              >
                <div
                  className={[
                    'shrink-0 h-9 w-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold ring-1',
                    c.urgent
                      ? 'bg-amber-50 text-amber-700 ring-amber-200'
                      : 'bg-slate-50 text-slate-700 ring-slate-200',
                  ].join(' ')}
                >
                  <span className="leading-none tabular-nums">{c.dia}</span>
                  <span className="text-[8px] uppercase">JUN</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">
                    {c.forn}
                  </p>
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    {c.val}
                  </p>
                </div>
                {c.urgent && (
                  <span className="shrink-0 text-[9px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-1.5 py-0.5 rounded">
                    URG
                  </span>
                )}
              </motion.li>
            ))}
          </ul>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Total 7d</span>
            <span className="text-xs font-semibold text-slate-900 tabular-nums">
              R$ 34.440
            </span>
          </div>
        </motion.div>
      </div>

      {/* === AI Insight overlay flutuante (absoluto sobre tudo) === */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 2.2 }}
        className="absolute -bottom-4 left-[3%] sm:-bottom-6 sm:left-[8%] max-w-[320px] z-20"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative rounded-2xl hero-card-on-dark-glass text-white p-4 overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute -top-12 -left-12 h-24 w-24 rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.7), transparent)' }}
          />
          <div className="relative flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/40 ring-1 ring-violet-300/40">
              <Sparkles size={16} className="text-white" strokeWidth={2.5} />
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
