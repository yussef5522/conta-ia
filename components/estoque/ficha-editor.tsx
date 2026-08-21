'use client'

// ESTOQUE FASE 2 item 2.0 — EDITOR de ficha técnica. Busca de componentes, lote base,
// custo teórico AO VIVO (Σ custoMedio×qtd; "a definir" quando falta custo, "a apurar" pra
// custo/unidade sem rendimento). Cria (POST) ou edita (PATCH → versão nova se mudou corpo).
// Componente do produto (nome/unidade/tipo/preço) + corpo (lote/preparo/validade).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Plus, Trash2, Search, Save, AlertTriangle } from 'lucide-react'

interface ItemBusca { id: string; nome: string; unidadeControle: string; custoMedio: number | null; categoria: string }
interface Comp { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null; unidadeControle: string }
interface Setor { id: string; nome: string; ativo: boolean }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const parseNum = (s: string) => { const t = s.trim().replace(',', '.'); const n = Number(t); return t === '' || !Number.isFinite(n) ? null : n }

export function FichaEditor({ companyId, fichaId }: { companyId: string; fichaId?: string }) {
  const editando = !!fichaId
  const [carregando, setCarregando] = useState(editando)
  const [nomeProduzido, setNomeProduzido] = useState('')
  const [unidadeProduzido, setUnidadeProduzido] = useState<'KG' | 'UN' | 'LT'>('UN')
  const [tipoProduto, setTipoProduto] = useState<'INTERMEDIARIO' | 'PRODUTO_FINAL'>('INTERMEDIARIO')
  const [setorId, setSetorId] = useState<string>('')
  const [valorVenda, setValorVenda] = useState('')
  const [loteBase, setLoteBase] = useState('1')
  const [unidadeLoteBase, setUnidadeLoteBase] = useState<'KG' | 'UN' | 'LT'>('KG')
  const [validadeDias, setValidadeDias] = useState('')
  const [tempoPreparoMin, setTempoPreparoMin] = useState('')
  const [modoPreparo, setModoPreparo] = useState('')
  const [comps, setComps] = useState<Comp[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${companyId}/estoque/setores`).then((r) => r.json()).then((j) => setSetores(j.setores ?? [])).catch(() => {})
    if (fichaId) {
      fetch(`/api/empresas/${companyId}/estoque/fichas/${fichaId}`).then((r) => r.json()).then((j) => {
        const f = j.ficha
        if (!f) { setErro('Ficha não encontrada.'); return }
        setNomeProduzido(f.nomeProduzido); setUnidadeProduzido(f.unidadeProduzido); setTipoProduto(f.tipoProduto)
        setSetorId(f.setorId ?? ''); setValorVenda(f.valorVenda != null ? String(f.valorVenda) : '')
        setLoteBase(String(f.loteBase)); setUnidadeLoteBase(f.unidadeLoteBase)
        setValidadeDias(f.validadeDias != null ? String(f.validadeDias) : ''); setTempoPreparoMin(f.tempoPreparoMin != null ? String(f.tempoPreparoMin) : '')
        setModoPreparo(f.modoPreparo ?? '')
        setComps(f.componentes.map((c: { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null; unidadeControle: string }) => ({ itemId: c.itemId, nome: c.nome, unidade: c.unidade, qtdPlanejada: c.qtdPlanejada, custoMedio: c.custoMedio, unidadeControle: c.unidadeControle })))
      }).finally(() => setCarregando(false))
    }
  }, [companyId, fichaId])

  // custo ao vivo
  const custo = useMemo(() => {
    const semCusto = comps.filter((c) => c.custoMedio == null).length
    const custoLote = semCusto > 0 ? null : round2(comps.reduce((s, c) => s + (c.custoMedio ?? 0) * c.qtdPlanejada, 0))
    return { custoLote, custoADefinir: semCusto > 0, semCusto }
  }, [comps])

  const addComp = (it: ItemBusca) => {
    if (comps.some((c) => c.itemId === it.id)) return
    setComps((cs) => [...cs, { itemId: it.id, nome: it.nome, unidade: it.unidadeControle, qtdPlanejada: 1, custoMedio: it.custoMedio, unidadeControle: it.unidadeControle }])
  }
  const setQtd = (itemId: string, q: number) => setComps((cs) => cs.map((c) => (c.itemId === itemId ? { ...c, qtdPlanejada: q } : c)))
  const rmComp = (itemId: string) => setComps((cs) => cs.filter((c) => c.itemId !== itemId))

  const salvar = async () => {
    setErro(null)
    const lb = parseNum(loteBase)
    if (!nomeProduzido.trim()) return setErro('Dê um nome ao produto da ficha.')
    if (lb == null || lb <= 0) return setErro('Lote base tem que ser maior que zero.')
    if (!comps.length) return setErro('Adicione ao menos um componente.')
    if (comps.some((c) => !(c.qtdPlanejada > 0))) return setErro('Toda quantidade de componente tem que ser maior que zero.')
    const vv = tipoProduto === 'PRODUTO_FINAL' ? parseNum(valorVenda) : null
    const componentes = comps.map((c, i) => ({ itemId: c.itemId, qtdPlanejada: c.qtdPlanejada, unidade: c.unidade, posicao: i }))
    const body = {
      loteBase: lb, unidadeLoteBase, componentes,
      modoPreparo: modoPreparo.trim() || null,
      tempoPreparoMin: parseNum(tempoPreparoMin) ?? null,
      validadeDias: parseNum(validadeDias) ?? null,
    }
    setSalvando(true)
    try {
      let r: Response
      if (editando) {
        r = await fetch(`/api/empresas/${companyId}/estoque/fichas/${fichaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, nomeProduzido: nomeProduzido.trim(), setorId: setorId || null, valorVenda: vv }) })
      } else {
        r = await fetch(`/api/empresas/${companyId}/estoque/fichas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, nomeProduzido: nomeProduzido.trim(), unidadeProduzido, tipoProduto, setorId: setorId || null, valorVenda: vv }) })
      }
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar.'); return }
      window.location.href = `/empresas/${companyId}/estoque/fichas`
    } catch { setErro('Falha de conexão.') } finally { setSalvando(false) }
  }

  if (carregando) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-5">
      {/* produto */}
      <Card><CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-900">O que a ficha produz</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 min-w-[200px] text-xs text-slate-500">Nome do produto
            <input value={nomeProduzido} onChange={(e) => setNomeProduzido(e.target.value)} placeholder="ex: Carne de panela 100g" className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm" />
          </label>
          <label className="text-xs text-slate-500">Unidade
            <select value={unidadeProduzido} onChange={(e) => setUnidadeProduzido(e.target.value as 'KG' | 'UN' | 'LT')} disabled={editando} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm disabled:bg-slate-50"><option>UN</option><option>KG</option><option>LT</option></select>
          </label>
          <label className="text-xs text-slate-500">Tipo
            <select value={tipoProduto} onChange={(e) => setTipoProduto(e.target.value as 'INTERMEDIARIO' | 'PRODUTO_FINAL')} disabled={editando} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm disabled:bg-slate-50"><option value="INTERMEDIARIO">Intermediário</option><option value="PRODUTO_FINAL">Produto final</option></select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-slate-500">Setor
            <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">—</option>{setores.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
          </label>
          {tipoProduto === 'PRODUTO_FINAL' && (
            <label className="text-xs text-slate-500">Preço de venda (opcional)
              <input value={valorVenda} onChange={(e) => setValorVenda(e.target.value)} inputMode="decimal" placeholder="a definir" className="mt-1 block w-32 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
            </label>
          )}
        </div>
        {editando && <p className="text-[11px] text-slate-400">Unidade e tipo não mudam depois de criada (a ficha já é usada por produções).</p>}
      </CardContent></Card>

      {/* lote base + preparo */}
      <Card><CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-900">Lote base (a receita de referência)</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">Rende a partir de
            <div className="mt-1 flex items-center gap-1">
              <input value={loteBase} onChange={(e) => setLoteBase(e.target.value)} inputMode="decimal" className="w-24 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
              <select value={unidadeLoteBase} onChange={(e) => setUnidadeLoteBase(e.target.value as 'KG' | 'UN' | 'LT')} className="rounded-lg border border-slate-300 py-2 px-2 text-sm"><option>KG</option><option>UN</option><option>LT</option></select>
            </div>
          </label>
          <label className="text-xs text-slate-500">Validade (dias)
            <input value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} inputMode="numeric" placeholder="p/ etiqueta" className="mt-1 block w-24 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
          </label>
          <label className="text-xs text-slate-500">Tempo de preparo (min)
            <input value={tempoPreparoMin} onChange={(e) => setTempoPreparoMin(e.target.value)} inputMode="numeric" placeholder="opcional" className="mt-1 block w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
          </label>
        </div>
        <label className="block text-xs text-slate-500">Modo de preparo (opcional)
          <textarea value={modoPreparo} onChange={(e) => setModoPreparo(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm" />
        </label>
      </CardContent></Card>

      {/* componentes */}
      <Card><CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Componentes</p>
          <div className="text-right">
            <p className="text-xs text-slate-500">Custo do lote</p>
            {custo.custoADefinir ? <p className="text-sm font-semibold text-amber-600">a definir</p> : <p className="text-lg font-semibold tabular-nums text-slate-900">{brl(custo.custoLote)}</p>}
          </div>
        </div>
        {custo.custoADefinir && <p className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3 w-3" /> {custo.semCusto} componente(s) sem custo médio ainda — o custo do produto fica "a definir" (nunca chutamos).</p>}
        <p className="text-[11px] text-slate-400">Custo por unidade só depois da 1ª produção (o rendimento é medido, não chutado) — hoje: <b>a apurar</b>.</p>

        <BuscaItem companyId={companyId} jaAdicionados={comps.map((c) => c.itemId)} onAdd={addComp} />

        {comps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Busque e adicione os insumos (Coxão Mole, Gordura…).</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {comps.map((c) => (
              <div key={c.itemId} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{c.nome}</p>
                  <p className="text-[11px] text-slate-400">{c.custoMedio != null ? `${brl(c.custoMedio)}/${c.unidadeControle}` : 'sem custo ainda'}{c.custoMedio != null && ` · subtotal ${brl(round2(c.custoMedio * c.qtdPlanejada))}`}</p>
                </div>
                <input value={c.qtdPlanejada} onChange={(e) => setQtd(c.itemId, parseNum(e.target.value) ?? 0)} inputMode="decimal" className="w-20 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-sm tabular-nums" />
                <span className="w-8 text-xs text-slate-400">{c.unidade}</span>
                <button onClick={() => rmComp(c.itemId)} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editando ? 'Salvar (cria versão nova se mudou o corpo)' : 'Criar ficha'}</button>
        <a href={`/empresas/${companyId}/estoque/fichas`} className="text-sm text-slate-500 hover:text-slate-700">cancelar</a>
      </div>
    </div>
  )
}

function BuscaItem({ companyId, jaAdicionados, onAdd }: { companyId: string; jaAdicionados: string[]; onAdd: (it: ItemBusca) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ItemBusca[]>([])
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [novaUnidade, setNovaUnidade] = useState<'KG' | 'UN' | 'LT'>('KG')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetch(`/api/empresas/${companyId}/estoque/itens?busca=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => setRes(j.itens ?? [])).catch(() => setRes([]))
    }, 200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, companyId])

  const termo = q.trim()
  const existeExato = res.some((it) => it.nome.toLowerCase() === termo.toLowerCase())

  const criarItem = async () => {
    if (!termo || criando) return
    setCriando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: termo, unidadeControle: novaUnidade }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.item) { onAdd(j.item); setQ(''); setAberto(false) }
    } finally { setCriando(false) }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={q} onFocus={() => setAberto(true)} onChange={(e) => { setQ(e.target.value); setAberto(true) }} placeholder="buscar insumo (ou criar um que nunca veio em nota)…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
      </div>
      {aberto && (res.length > 0 || termo) && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.map((it) => {
            const dentro = jaAdicionados.includes(it.id)
            return (
              <button key={it.id} disabled={dentro} onClick={() => { onAdd(it); setQ(''); setAberto(false) }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40">
                <span className="text-slate-700">{it.nome}</span>
                <span className="flex items-center gap-2 text-xs text-slate-400">{it.custoMedio != null ? `${brl(it.custoMedio)}/${it.unidadeControle}` : 'sem custo'}{!dentro && <Plus className="h-3.5 w-3.5" />}</span>
              </button>
            )
          })}
          {/* criar item novo — pro molho/sal que nunca vieram em nota */}
          {termo && !existeExato && (
            <div className="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/40 px-3 py-2">
              <span className="flex-1 text-sm text-slate-700">criar <b>“{termo}”</b> <span className="text-[11px] text-slate-400">(sem custo até a 1ª nota)</span></span>
              <select value={novaUnidade} onChange={(e) => setNovaUnidade(e.target.value as 'KG' | 'UN' | 'LT')} className="rounded-md border border-slate-300 py-1 px-1.5 text-xs"><option>KG</option><option>UN</option><option>LT</option></select>
              <button onClick={criarItem} disabled={criando} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> criar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
