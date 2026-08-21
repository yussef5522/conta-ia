'use client'

// ESTOQUE FASE 1 item 3 — definir mín/máx do item (na ficha). Salva via PATCH; valida
// mín < máx no servidor. Mostra a barra de status atual. Simples: dois campos + salvar.

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Gauge, Loader2, Check } from 'lucide-react'
import { StatusBar, StatusDot } from '@/components/estoque/status-bar'
import type { StatusEstoqueResult } from '@/lib/stock/status-estoque'

const parseNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function MinMaxEditor({
  companyId, itemId, unidade, estoqueMin, estoqueMax, status, onSalvo,
}: {
  companyId: string; itemId: string; unidade: string
  estoqueMin: number | null; estoqueMax: number | null; status: StatusEstoqueResult
  onSalvo: (min: number | null, max: number | null) => void
}) {
  const [min, setMin] = useState(estoqueMin != null ? String(estoqueMin) : '')
  const [max, setMax] = useState(estoqueMax != null ? String(estoqueMax) : '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const salvar = async () => {
    setErro(null); setOk(false)
    const mn = parseNum(min), mx = parseNum(max)
    if (mn != null && mx != null && mn >= mx) { setErro('O mínimo tem que ser menor que o máximo.'); return }
    setSalvando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estoqueMin: mn, estoqueMax: mx }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar.'); return }
      onSalvo(mn, mx); setOk(true); setTimeout(() => setOk(false), 2000)
    } catch { setErro('Falha de conexão.') } finally { setSalvando(false) }
  }

  return (
    <Card><CardContent className="p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Gauge className="h-4 w-4" /> Faixa de estoque (mín / máx)</p>
      <div className="mb-3"><StatusBar status={status} /><div className="mt-1.5"><StatusDot status={status} /></div></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Mínimo ({unidade})
          <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="—" className="mt-1 block w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
        </label>
        <label className="text-xs text-slate-500">Máximo ({unidade})
          <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="opcional" className="mt-1 block w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
        </label>
        <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null}{ok ? 'Salvo' : 'Salvar'}
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}
      <p className="mt-2 text-[11px] text-slate-400">O mínimo dispara o aviso "abaixo do mínimo" na posição. O máximo é opcional (evita comprar demais).</p>
    </CardContent></Card>
  )
}
