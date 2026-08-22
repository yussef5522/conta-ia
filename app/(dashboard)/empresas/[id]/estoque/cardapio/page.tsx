'use client'

// ESTOQUE FASE 2 item 2.4 — CARDÁPIO/MARGEM (PRODUTO_FINAL). Custo (real do ledger) ·
// preço de venda (editável inline, salva no valorVenda da ficha) · margem ao vivo. "a
// definir" agrupado no topo cobrando preenchimento — NUNCA 0,01, NUNCA -99% eterno. CSV.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { UtensilsCrossed, Loader2, Download, Check } from 'lucide-react'

interface Item { fichaId: string; itemProduzidoId: string; nome: string; unidade: string; custoUnitario: number | null; custoOrigem: string | null; valorVenda: number | null; margem: number | null }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? null : n }

export default function CardapioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [itens, setItens] = useState<Item[] | null | undefined>(undefined)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/cardapio`).then((r) => r.json()).then((j) => setItens(j.itens ?? [])).catch(() => setItens(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (itens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (itens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o cardápio.</div>

  const semPreco = itens.filter((i) => i.valorVenda == null).length

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <UtensilsCrossed className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Cardápio & margem</h1><p className="text-sm text-slate-500">Produtos finais: custo real, preço e margem ao vivo. Sem preço = "a definir" (nunca chutamos).</p></div>
        {itens.length > 0 && <a href={`/api/empresas/${id}/estoque/cardapio?formato=csv`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> CSV</a>}
      </div>

      {itens.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <UtensilsCrossed className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhum produto final ainda.</p>
          <p className="max-w-md text-xs text-slate-500">Crie uma ficha do tipo "Produto final" (ex: um prato) que o cardápio calcula a margem sozinho.</p>
        </CardContent></Card>
      ) : (
        <>
          {semPreco > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">{semPreco} produto(s) sem preço — defina pra ver a margem. (a definir ≠ 0,01)</p>}
          <div className="space-y-2">
            {itens.map((i) => <LinhaCardapio key={i.fichaId} id={id} item={i} onSalvo={carregar} />)}
          </div>
        </>
      )}
    </div>
  )
}

function LinhaCardapio({ id, item, onSalvo }: { id: string; item: Item; onSalvo: () => void }) {
  const [editando, setEditando] = useState(false)
  const [preco, setPreco] = useState(item.valorVenda != null ? String(item.valorVenda) : '')
  const [busy, setBusy] = useState(false)

  // margem prévia ao vivo enquanto edita
  const precoNum = parseNum(preco)
  const margemPrevia = precoNum != null && precoNum > 0 && item.custoUnitario != null ? round2((precoNum - item.custoUnitario) / precoNum) : null

  const salvar = async () => {
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/fichas/${item.fichaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valorVenda: parseNum(preco) }) })
      if (r.ok) { setEditando(false); onSalvo() }
    } finally { setBusy(false) }
  }

  const margem = editando ? margemPrevia : item.margem
  const corMargem = margem == null ? 'text-slate-400' : margem < 0.15 ? 'text-rose-600' : margem < 0.3 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <Card className={item.valorVenda == null ? 'border-amber-200' : ''}><CardContent className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{item.nome}</p>
        <p className="text-xs text-slate-500">custo {brl(item.custoUnitario)}{item.custoOrigem === 'real' ? ' (real)' : item.custoUnitario == null ? ' (a apurar)' : ''}</p>
      </div>
      {/* preço */}
      <div className="text-right">
        <p className="text-[11px] text-slate-400">Preço</p>
        {editando ? (
          <div className="flex items-center gap-1">
            <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="a definir" className="w-24 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-sm tabular-nums" autoFocus />
            <button onClick={salvar} disabled={busy} className="rounded bg-[#185FA5] p-1.5 text-white disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
          </div>
        ) : (
          <button onClick={() => setEditando(true)} className="text-sm font-medium tabular-nums text-slate-800 hover:text-[#185FA5]">{item.valorVenda != null ? brl(item.valorVenda) : <span className="text-amber-600">a definir</span>}</button>
        )}
      </div>
      {/* margem */}
      <div className="w-20 text-right">
        <p className="text-[11px] text-slate-400">Margem</p>
        <p className={`text-sm font-semibold tabular-nums ${corMargem}`}>{margem != null ? `${Math.round(margem * 100)}%` : 'a definir'}</p>
      </div>
    </CardContent></Card>
  )
}
