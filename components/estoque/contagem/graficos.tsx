// ⭐ os desenhos da lei v3 (docs/contagem-referencia.html) em React: o ANEL (R37/R40/R42), a LINHA
// DO SALDO com os pontos das contagens (R41) e as barras de ajuste em ESCALA ÚNICA (R11).
// ⚠️ Cor só por TOKEN (`--fam-*`, `--prod-*`): tela de câmara fria tem que inverter no escuro.
import { sparkPath, sparkPonto } from '@/lib/stock/contagem/direcao'

export function Anel({ pct, rotulo, tamanho = 52, verdeAoCompletar = true, className }: {
  pct: number | null; rotulo: string; tamanho?: number; verdeAoCompletar?: boolean; className?: string
}) {
  const r = 42
  const C = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct ?? 0))
  const cor = verdeAoCompletar && p >= 100 ? 'var(--fam-verde-mid)' : 'var(--fam-indigo-mid)'
  return (
    <div className={`relative shrink-0 ${className ?? ''}`} style={{ width: tamanho, height: tamanho }} data-anel={rotulo}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--prod-surface-2)" strokeWidth="10" />
        {pct != null && (
          <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C.toFixed(2)} strokeDashoffset={(C * (1 - p / 100)).toFixed(2)} transform="rotate(-90 50 50)" />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-extrabold tabular-nums"
        style={{ fontSize: Math.max(9, Math.round(tamanho / 4.3)), color: 'var(--prod-primary)' }}>
        {rotulo}
      </div>
    </div>
  )
}

/** R41 — saldo dos últimos 14 dias + os pontos das contagens (verde bateu · âmbar ajustou) */
export function LinhaDoSaldo({ valores, pontos }: { valores: number[]; pontos: { i: number; ok: boolean }[] }) {
  const W = 316, H = 52
  if (valores.length < 2) return null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 block h-[52px] w-full" data-testid="linha-do-saldo">
      <path d={sparkPath(valores, W, H)} fill="none" stroke="var(--prod-line-strong)" strokeWidth="2" />
      {pontos.map((p, k) => {
        const { x, y } = sparkPonto(valores, p.i, W, H)
        return <circle key={k} cx={x.toFixed(1)} cy={y.toFixed(1)} r="4.5" data-ponto={p.ok ? 'bateu' : 'ajustou'}
          fill={p.ok ? 'var(--fam-verde-mid)' : 'var(--fam-ambar-mid)'} stroke="var(--prod-surface)" strokeWidth="1.5" />
      })}
    </svg>
  )
}

/** R40/R11 — 4 barras na MESMA escala (a maior manda); a última (esta semana) destacada */
export function BarrasDaSemana({ valores, rotulos }: { valores: number[]; rotulos: string[] }) {
  const max = Math.max(...valores.map(Math.abs), 0)
  return (
    <div className="mt-2 flex h-11 items-end gap-1.5" data-testid="ajustes-por-semana">
      {valores.map((v, k) => (
        <div key={k} className="flex flex-1 flex-col items-center gap-0.5">
          <i className="block w-full rounded-t" style={{
            height: max > 0 ? Math.max(2, Math.round((Math.abs(v) / max) * 34)) : 2,
            background: k === valores.length - 1 ? 'var(--fam-indigo-mid)' : 'var(--prod-surface-2)',
          }} />
          <span className="text-[8.5px] font-extrabold" style={{ color: 'var(--prod-muted)' }}>{rotulos[k]}</span>
        </div>
      ))}
    </div>
  )
}
