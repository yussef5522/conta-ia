'use client'

// ESTOQUE FASE 1 item 3 — barra de status do item vs min/max. Lê o resultado do helper
// (lib/stock/status-estoque) — nunca recalcula cor/faixa aqui. Verde dentro · vermelho
// abaixo · azul acima · cinza sem mínimo. Usada na posição e na ficha.

import type { StatusEstoqueResult } from '@/lib/stock/status-estoque'

const BARRA: Record<string, string> = { verde: 'bg-emerald-500', vermelho: 'bg-rose-500', azul: 'bg-sky-500', cinza: 'bg-slate-300' }
const DOT: Record<string, string> = { verde: 'bg-emerald-500', vermelho: 'bg-rose-500', azul: 'bg-sky-500', cinza: 'bg-slate-300' }
export const STATUS_TEXTO: Record<string, string> = { verde: 'text-emerald-700', vermelho: 'text-rose-700', azul: 'text-sky-700', cinza: 'text-slate-400' }
export const STATUS_BORDA: Record<string, string> = { verde: 'border-l-emerald-400', vermelho: 'border-l-rose-400', azul: 'border-l-sky-400', cinza: 'border-l-slate-200' }

export function StatusBar({ status, className = '' }: { status: StatusEstoqueResult; className?: string }) {
  if (!status.barra) return <span className="text-xs text-slate-400">sem mínimo</span>
  const { saldoPct, minPct, maxPct } = status.barra
  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`absolute left-0 top-0 h-full ${BARRA[status.cor]}`} style={{ width: `${saldoPct}%` }} />
        {/* marcador do mínimo */}
        <div className="absolute top-0 h-full w-px bg-slate-400" style={{ left: `${minPct}%` }} title="mínimo" />
        {maxPct != null && <div className="absolute top-0 h-full w-px bg-slate-400" style={{ left: `${maxPct}%` }} title="máximo" />}
      </div>
    </div>
  )
}

export function StatusDot({ status }: { status: StatusEstoqueResult }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${STATUS_TEXTO[status.cor]}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${DOT[status.cor]}`} />
      {status.label}
    </span>
  )
}
