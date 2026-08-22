'use client'

// ESTOQUE FASE 3 — modal ÚNICO de confirmação de baixa (import Suitable, reprocesso E
// lançamento manual). Responde "o que acontece se eu confirmar?": tabela do que baixa +
// custo total + pendentes numa linha neutra colapsada. Nunca laranja pra estado normal.

import { useState } from 'react'
import { X, Loader2, Check, Info, AlertTriangle } from 'lucide-react'

export interface PlanoVM { produtos: { nome: string }[]; pendentes: { nome: string; quantidade: number }[]; fora: { nome: string; quantidade: number }[]; agregada: { nome: string; qtd: number; valor: number | null }[] }
const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const fmtDia = (d: string) => d.split('-').reverse().join('/')

export function PlanoVendaModal({ plano, data, titulo, subtitulo, processando, erro, onConfirmar, onClose }: { plano: PlanoVM; data: string; titulo: string; subtitulo?: string; processando: boolean; erro: string | null; onConfirmar: () => void; onClose: () => void }) {
  const [verLista, setVerLista] = useState(false)
  const total = plano.agregada.reduce((s, a) => s + (a.valor ?? 0), 0)
  const unPend = plano.pendentes.reduce((s, p) => s + p.quantidade, 0)
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between"><h3 className="text-base font-semibold text-slate-900">{titulo} de {fmtDia(data)}</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></div>
        {subtitulo && <p className="mb-3 text-xs text-slate-500">{subtitulo}</p>}

        <p className="mb-1 mt-2 text-xs font-semibold text-slate-700">Vai baixar ({plano.agregada.length}):</p>
        {plano.agregada.length === 0 ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Nada a baixar.</p> : (
          <div className="rounded-lg border border-slate-100">
            {plano.agregada.map((a) => <div key={a.nome} className="flex items-center justify-between border-b border-slate-50 px-3 py-2 text-sm last:border-0"><span className="text-slate-700">{a.nome}</span><span className="tabular-nums text-slate-600">−{a.qtd} · {brl(a.valor)}</span></div>)}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><span className="text-slate-600">custo total baixado</span><span className="tabular-nums text-slate-900">{brl(total)}</span></div>
          </div>
        )}

        {plano.pendentes.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-100">
            <button onClick={() => setVerLista((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> {plano.pendentes.length} pendentes de mapa ({unPend} un) · não baixam</span>
              <span className="text-[#185FA5]">{verLista ? 'ocultar' : 'ver lista'}</span>
            </button>
            {verLista && <table className="w-full border-t border-slate-100 text-xs"><tbody>{plano.pendentes.map((p) => <tr key={p.nome} className="border-b border-slate-50 last:border-0"><td className="px-3 py-1.5 text-slate-600">{p.nome}</td><td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{p.quantidade}</td></tr>)}</tbody></table>}
          </div>
        )}
        {plano.fora.length > 0 && <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><Info className="h-3.5 w-3.5" /> {plano.fora.length} deixado(s) de fora (desmarcado)</p>}

        {erro && <p className="mt-3 flex items-center gap-1 text-sm text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={onConfirmar} disabled={processando || plano.agregada.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar e baixar</button>
          <button onClick={onClose} className="text-sm text-slate-500">cancelar</button>
        </div>
      </div>
    </div>
  )
}
