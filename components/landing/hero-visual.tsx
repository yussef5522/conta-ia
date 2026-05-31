// Sprint Landing Page (30/05/2026) — Visual do Hero.
// Recriação fiel (HTML/SVG) dos componentes REAIS do dashboard CAIXAOS:
//   1. KPI Card grande (saldo + sparkline)
//   2. Heatmap Comparativo (células coloridas por intensidade)
//   3. Waterfall mini (5 barras: inicial → entradas → saídas → final)
//
// Por que recriar em vez de screenshot: leve, escalável, dark-mode-ready,
// e dispensa pipeline de imagens. Os números mostrados são FICTÍCIOS mas
// realistas pra uma academia (perfil Yussef).

const HEATMAP_CELLS = [
  // Linha = categoria, Coluna = mês (Jan-Jun). Valor 0-1.
  [0.92, 0.85, 0.78, 0.95, 0.88, 0.91], // Folha
  [0.62, 0.55, 0.71, 0.58, 0.64, 0.59], // Aluguel
  [0.38, 0.45, 0.42, 0.51, 0.39, 0.44], // Marketing
  [0.25, 0.31, 0.18, 0.28, 0.22, 0.33], // Utilidades
  [0.15, 0.12, 0.18, 0.21, 0.14, 0.19], // Manutenção
] as const

const HEATMAP_ROWS = ['Folha', 'Aluguel', 'Marketing', 'Energia', 'Manut.']
const HEATMAP_COLS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']

function heatmapColor(intensity: number): string {
  // Escala violeta: do quase-branco ao violet-700
  if (intensity < 0.2) return '#f5f3ff'
  if (intensity < 0.35) return '#ede9fe'
  if (intensity < 0.5) return '#ddd6fe'
  if (intensity < 0.65) return '#c4b5fd'
  if (intensity < 0.8) return '#a78bfa'
  return '#7c3aed'
}

function heatmapText(intensity: number): string {
  return intensity > 0.6 ? '#fff' : '#1e293b'
}

export function HeroVisual() {
  return (
    <div className="relative w-full">
      {/* Glow violeta atrás dos cards */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 opacity-40 blur-3xl"
        style={{
          background:
            'radial-gradient(60% 50% at 60% 40%, rgba(124,58,237,0.35) 0%, transparent 70%)',
        }}
      />

      <div className="relative grid grid-cols-12 gap-3 sm:gap-4">
        {/* === KPI Card grande — col-span 7 === */}
        <div className="col-span-12 sm:col-span-7 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Saldo Consolidado
              </p>
              <p className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">
                R$ 487.293
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 tabular-nums">
                  ↑ 12,4%
                </span>
                <span className="text-xs text-slate-400">vs mês anterior</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M3 3v18h18" strokeLinecap="round" />
                <path d="M7 14l4-4 4 4 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Sparkline */}
          <svg viewBox="0 0 280 60" className="mt-4 w-full h-16">
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,42 L20,40 L40,44 L60,36 L80,38 L100,30 L120,32 L140,25 L160,28 L180,20 L200,22 L220,15 L240,18 L260,10 L280,8 L280,60 L0,60 Z"
              fill="url(#spark-fill)"
            />
            <path
              d="M0,42 L20,40 L40,44 L60,36 L80,38 L100,30 L120,32 L140,25 L160,28 L180,20 L200,22 L220,15 L240,18 L260,10 L280,8"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* === Mini-KPI dupla — col-span 5 === */}
        <div className="col-span-12 sm:col-span-5 grid grid-rows-2 gap-3 sm:gap-4">
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Receitas (mês)
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              R$ 142.580
            </p>
            <p className="mt-1 text-xs text-emerald-600 tabular-nums">↑ 8,2%</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Despesas (mês)
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              R$ 98.412
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">↓ 3,1%</p>
          </div>
        </div>

        {/* === Heatmap Comparativo — col-span 7 === */}
        <div className="col-span-12 sm:col-span-7 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Comparativo · Despesas por categoria
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                Heatmap semestral
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
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
                  <th className="text-left text-[10px] font-medium text-slate-400 px-2 py-1.5 bg-slate-50/50">
                    Categoria
                  </th>
                  {HEATMAP_COLS.map((c) => (
                    <th
                      key={c}
                      className="text-center text-[10px] font-medium text-slate-400 px-1 py-1.5 bg-slate-50/50 tabular-nums"
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
                        <div
                          className="w-full h-7 rounded flex items-center justify-center text-[10px] font-medium tabular-nums"
                          style={{ background: heatmapColor(v), color: heatmapText(v) }}
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
        </div>

        {/* === Waterfall mini — col-span 5 === */}
        <div className="col-span-12 sm:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 p-5">
          <div className="mb-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Análise de Variação
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Waterfall · Mai → Jun
            </p>
          </div>

          <svg viewBox="0 0 260 140" className="w-full h-32">
            {/* Eixo x */}
            <line x1="20" y1="120" x2="260" y2="120" stroke="#e2e8f0" strokeWidth="1" />

            {/* Barra inicial (cinza) */}
            <rect x="22" y="50" width="32" height="70" rx="2" fill="#cbd5e1" />
            <text x="38" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Início</text>

            {/* Conector → */}
            <line x1="54" y1="50" x2="64" y2="50" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            {/* Entradas (verde) — sobe */}
            <rect x="64" y="22" width="32" height="28" rx="2" fill="#10b981" />
            <text x="80" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Receita</text>
            <text x="80" y="18" textAnchor="middle" fontSize="8" fontWeight="600" fill="#10b981">+R$28k</text>

            <line x1="96" y1="22" x2="106" y2="22" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            {/* Saídas (vermelho) — desce */}
            <rect x="106" y="22" width="32" height="42" rx="2" fill="#ef4444" />
            <text x="122" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Despesa</text>
            <text x="122" y="78" textAnchor="middle" fontSize="8" fontWeight="600" fill="#ef4444">−R$42k</text>

            <line x1="138" y1="64" x2="148" y2="64" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            {/* Outras saídas (vermelho menor) */}
            <rect x="148" y="64" width="32" height="24" rx="2" fill="#f87171" />
            <text x="164" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Imp.</text>
            <text x="164" y="100" textAnchor="middle" fontSize="8" fontWeight="600" fill="#ef4444">−R$24k</text>

            <line x1="180" y1="88" x2="190" y2="88" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

            {/* Barra final (violeta) */}
            <rect x="190" y="88" width="48" height="32" rx="2" fill="#7c3aed" />
            <text x="214" y="135" textAnchor="middle" fontSize="9" fill="#64748b">Final</text>
          </svg>
        </div>
      </div>

      {/* Flutuante AI Insight — overlay */}
      <div className="absolute -bottom-4 -right-2 sm:-bottom-6 sm:-right-6 max-w-[280px] rounded-xl bg-slate-900 text-white p-4 shadow-2xl shadow-violet-900/30 border border-white/10">
        <div className="flex items-start gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 16.5l-6.2 4.5 2.4-7.3L2 9.2h7.6z" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-violet-300">
              IA Detectou
            </p>
            <p className="mt-1 text-xs leading-snug text-white/90">
              Gasto com energia cresceu <span className="font-semibold text-white">+18%</span> nas 3 últimas faturas. Vale revisar.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
