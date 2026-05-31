// Sprint Landing Page (30/05/2026) — Seção FUNCIONALIDADES.
// 4 blocos com mini-mockups visuais dos diferenciais REAIS:
//   1. Import inteligente (OFX/Excel/CSV)
//   2. IA Categorizadora (regras aprendidas)
//   3. Análise de Variação (waterfall)
//   4. Comparativo Heatmap

import { Upload, Sparkles, TrendingUp, Grid3x3, type LucideIcon } from 'lucide-react'

interface Feature {
  badge: string
  icon: LucideIcon
  title: string
  description: string
  visual: React.ReactNode
}

const FEATURES: readonly Feature[] = [
  {
    badge: '01 · IMPORT',
    icon: Upload,
    title: 'Import inteligente em segundos',
    description:
      'Solte um OFX, Excel ou CSV — o CAIXAOS detecta o banco, dedup transações repetidas e propõe a classificação. Você revisa, não digita.',
    visual: <ImportVisual />,
  },
  {
    badge: '02 · IA',
    icon: Sparkles,
    title: 'IA que aprende seu negócio',
    description:
      'A cada categoria que você confirma, vira regra. No próximo extrato, vem 80% já classificado. Quanto mais usa, melhor fica.',
    visual: <AiVisual />,
  },
  {
    badge: '03 · VARIAÇÃO',
    icon: TrendingUp,
    title: 'Análise de Variação com Waterfall',
    description:
      'Veja exatamente porque seu resultado mudou. Receita, despesa, imposto — cada peça do quebra-cabeça em uma única visão.',
    visual: <WaterfallVisual />,
  },
  {
    badge: '04 · COMPARATIVO',
    icon: Grid3x3,
    title: 'Comparativo Heatmap por categoria',
    description:
      'Cruze categorias com meses e enxergue tendências em segundos. Onde gastou demais? Onde cresceu? A intensidade da cor responde.',
    visual: <HeatmapVisual />,
  },
] as const

export function LandingFeatures() {
  return (
    <section
      id="funcionalidades"
      className="relative py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
            Funcionalidades
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.02em] text-slate-900 leading-[1.1]">
            Tudo que sua planilha não consegue fazer
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Quatro diferenciais que transformam dado bruto em decisão. Sem
            consultoria, sem BI externo, sem Excel travando.
          </p>
        </div>

        <div className="mt-14 sm:mt-20 space-y-20 sm:space-y-28">
          {FEATURES.map((feature, idx) => (
            <FeatureRow key={feature.badge} feature={feature} flipped={idx % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({ feature, flipped }: { feature: Feature; flipped: boolean }) {
  const Icon = feature.icon
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
      <div className={`lg:col-span-5 ${flipped ? 'lg:order-2' : ''}`}>
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1">
          <Icon size={14} className="text-violet-600" strokeWidth={2.5} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">
            {feature.badge}
          </span>
        </div>
        <h3 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 leading-[1.15]">
          {feature.title}
        </h3>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          {feature.description}
        </p>
      </div>
      <div className={`lg:col-span-7 ${flipped ? 'lg:order-1' : ''}`}>
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-4 -z-10 opacity-30 blur-2xl"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(124,58,237,0.25) 0%, transparent 70%)',
            }}
          />
          {feature.visual}
        </div>
      </div>
    </div>
  )
}

/* ============ Visuais de cada feature ============ */

function ImportVisual() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-100 flex items-center justify-center">
            <Upload size={12} className="text-emerald-700" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-medium text-slate-900">extrato_banrisul_05.ofx</p>
        </div>
        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
          DETECTADO
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-3 py-2 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="col-span-2">Data</span>
          <span className="col-span-6">Descrição</span>
          <span className="col-span-2 text-right">Valor</span>
          <span className="col-span-2 text-right">Status</span>
        </div>
        {[
          { d: '12/05', desc: 'PIX FORN. AGUA & LUZ LTDA', v: '-R$ 1.240,00', auto: true },
          { d: '11/05', desc: 'TED FOLHA PAGAMENTO MAI', v: '-R$ 24.580,00', auto: true },
          { d: '10/05', desc: 'RECEBIMENTO MENSALIDADES', v: '+R$ 18.320,00', auto: true },
          { d: '09/05', desc: 'COMPRA PAPELARIA SANTOS', v: '-R$ 187,40', auto: false },
        ].map((row, i) => (
          <div
            key={i}
            className="px-3 py-2 grid grid-cols-12 gap-2 text-xs border-t border-slate-100 items-center"
          >
            <span className="col-span-2 text-slate-500 tabular-nums">{row.d}</span>
            <span className="col-span-6 text-slate-700 truncate">{row.desc}</span>
            <span
              className={`col-span-2 text-right font-medium tabular-nums ${
                row.v.startsWith('+') ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              {row.v}
            </span>
            <span className="col-span-2 text-right">
              {row.auto ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                  ✓ IA
                </span>
              ) : (
                <span className="inline-flex text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Revisar
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          <span className="font-semibold text-slate-900">142</span> transações ·{' '}
          <span className="text-violet-700 font-semibold">115 auto-classificadas</span>
        </span>
        <span className="text-slate-400">81% de acerto</span>
      </div>
    </div>
  )
}

function AiVisual() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 sm:p-6 border border-white/10 shadow-2xl shadow-violet-900/20">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
          <Sparkles size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-medium text-white/90">IA aprendeu 247 regras</p>
      </div>

      <div className="space-y-2">
        {[
          { pat: 'PIX *AGUA E LUZ*', cat: 'Utilidades · Energia', vezes: 12 },
          { pat: 'TED FOLHA PAGAMENTO *', cat: 'Pessoal · Folha CLT', vezes: 8 },
          { pat: 'PIX RECEB MENSAL *', cat: 'Receita · Mensalidade', vezes: 156 },
          { pat: 'DEB AUTO INTERNET *', cat: 'Utilidades · Internet', vezes: 6 },
        ].map((rule, i) => (
          <div
            key={i}
            className="rounded-lg bg-white/5 border border-white/5 p-3 flex items-center gap-3 backdrop-blur-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono text-violet-300 truncate">{rule.pat}</p>
              <p className="mt-0.5 text-xs text-white/80 truncate">{rule.cat}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-white tabular-nums">{rule.vezes}×</p>
              <p className="text-[9px] uppercase tracking-wider text-white/40">aplicada</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-white/60">Acerto últimos 30 dias</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-[83%] bg-gradient-to-r from-violet-400 to-violet-500 rounded-full" />
          </div>
          <span className="text-xs font-semibold text-white tabular-nums">83%</span>
        </div>
      </div>
    </div>
  )
}

function WaterfallVisual() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Análise de Variação
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            Resultado Abril → Maio
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Variação</p>
          <p className="text-sm font-semibold text-emerald-600 tabular-nums">+R$ 12.840</p>
        </div>
      </div>

      <svg viewBox="0 0 400 200" className="w-full h-48">
        <line x1="20" y1="170" x2="400" y2="170" stroke="#e2e8f0" strokeWidth="1" />

        {/* Saldo inicial */}
        <rect x="22" y="60" width="50" height="110" rx="3" fill="#cbd5e1" />
        <text x="47" y="55" textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569">
          R$ 42k
        </text>
        <text x="47" y="188" textAnchor="middle" fontSize="10" fill="#64748b">
          Início
        </text>

        <line x1="72" y1="60" x2="82" y2="60" stroke="#94a3b8" strokeDasharray="2 2" />

        {/* Receita */}
        <rect x="82" y="20" width="50" height="40" rx="3" fill="#10b981" />
        <text x="107" y="15" textAnchor="middle" fontSize="10" fontWeight="600" fill="#059669">
          +R$ 38k
        </text>
        <text x="107" y="188" textAnchor="middle" fontSize="10" fill="#64748b">
          Receita
        </text>

        <line x1="132" y1="20" x2="142" y2="20" stroke="#94a3b8" strokeDasharray="2 2" />

        {/* Despesa */}
        <rect x="142" y="20" width="50" height="56" rx="3" fill="#ef4444" />
        <text x="167" y="15" textAnchor="middle" fontSize="10" fontWeight="600" fill="#dc2626">
          −R$ 18k
        </text>
        <text x="167" y="188" textAnchor="middle" fontSize="10" fill="#64748b">
          Despesa
        </text>

        <line x1="192" y1="76" x2="202" y2="76" stroke="#94a3b8" strokeDasharray="2 2" />

        {/* Folha */}
        <rect x="202" y="76" width="50" height="20" rx="3" fill="#f87171" />
        <text x="227" y="71" textAnchor="middle" fontSize="10" fontWeight="600" fill="#dc2626">
          −R$ 5k
        </text>
        <text x="227" y="188" textAnchor="middle" fontSize="10" fill="#64748b">
          Folha
        </text>

        <line x1="252" y1="96" x2="262" y2="96" stroke="#94a3b8" strokeDasharray="2 2" />

        {/* Imposto */}
        <rect x="262" y="96" width="50" height="10" rx="3" fill="#fca5a5" />
        <text x="287" y="91" textAnchor="middle" fontSize="10" fontWeight="600" fill="#dc2626">
          −R$ 2k
        </text>
        <text x="287" y="188" textAnchor="middle" fontSize="10" fill="#64748b">
          Imposto
        </text>

        <line x1="312" y1="106" x2="322" y2="106" stroke="#94a3b8" strokeDasharray="2 2" />

        {/* Saldo final */}
        <rect x="322" y="106" width="60" height="64" rx="3" fill="#7c3aed" />
        <text x="352" y="101" textAnchor="middle" fontSize="10" fontWeight="600" fill="#5b21b6">
          R$ 55k
        </text>
        <text x="352" y="188" textAnchor="middle" fontSize="10" fill="#64748b">
          Final
        </text>
      </svg>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Cada barra é clicável → drill-down</span>
        <span className="inline-flex items-center gap-1 text-violet-700 font-medium">
          Explorar →
        </span>
      </div>
    </div>
  )
}

function HeatmapVisual() {
  const ROWS = ['Folha', 'Aluguel', 'Marketing', 'Energia', 'Manutenção', 'Material', 'Software']
  const COLS = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
  // Valores 0..1
  const DATA = [
    [0.92, 0.88, 0.85, 0.78, 0.95, 0.91],
    [0.62, 0.58, 0.55, 0.71, 0.58, 0.59],
    [0.28, 0.45, 0.42, 0.51, 0.68, 0.74],
    [0.22, 0.31, 0.18, 0.28, 0.22, 0.33],
    [0.15, 0.12, 0.18, 0.62, 0.14, 0.19],
    [0.35, 0.42, 0.38, 0.45, 0.41, 0.39],
    [0.45, 0.48, 0.52, 0.49, 0.51, 0.55],
  ]

  function color(v: number): string {
    if (v < 0.2) return '#f5f3ff'
    if (v < 0.35) return '#ede9fe'
    if (v < 0.5) return '#ddd6fe'
    if (v < 0.65) return '#c4b5fd'
    if (v < 0.8) return '#a78bfa'
    return '#7c3aed'
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Comparativo
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            Despesas por categoria · semestral
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <span>Baixo</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div key={v} className="w-3 h-3 rounded-sm" style={{ background: color(v) }} />
            ))}
          </div>
          <span>Alto</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-medium text-slate-400 px-2 py-1.5 bg-slate-50/50">
                Categoria
              </th>
              {COLS.map((c) => (
                <th
                  key={c}
                  className="text-center text-[10px] font-medium text-slate-400 px-1 py-1.5 bg-slate-50/50"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row} className="border-t border-slate-100">
                <td className="text-xs font-medium text-slate-700 px-2 py-1">{row}</td>
                {DATA[ri].map((v, ci) => (
                  <td key={ci} className="p-0.5">
                    <div
                      className="w-full h-7 rounded flex items-center justify-center text-[10px] font-medium tabular-nums"
                      style={{ background: color(v), color: v > 0.6 ? '#fff' : '#1e293b' }}
                    >
                      {Math.round(v * 100)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        💡 Marketing subiu 36% em Maio · Manutenção teve pico em Março
      </p>
    </div>
  )
}
