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

// ⭐ EDITOR ÚNICO, DOIS MUNDOS (27/08 — REGRA 4). O cardápio (casa do dono) e as receitas de
// produção (casa da cozinha) abrem ESTE MESMO editor, cada um com o tipo TRAVADO e o
// "voltar" apontando pro seu lugar. Um segundo editor divergiria na primeira regra nova.
export function FichaEditor({ companyId, fichaId, tipoTravado, voltarPara, nomeInicial, precoInicial }: {
  companyId: string
  fichaId?: string
  /** trava o tipo do produto (o mundo de onde o editor foi aberto) */
  tipoTravado?: 'INTERMEDIARIO' | 'PRODUTO_FINAL'
  /** pra onde voltar ao salvar/cancelar (default: a lista de fichas) */
  voltarPara?: string
  /** nome pré-preenchido (vem do PDV quando o dono monta a ficha de um produto vendido) */
  nomeInicial?: string
  /** preço pré-preenchido: o PRATICADO no PDV, pra a margem nascer calculada (editável) */
  precoInicial?: number | null
}) {
  const editando = !!fichaId
  // pré-preenche nome/tipo quando vem do mapeamento de vendas (?nome=&tipo=PRODUTO_FINAL)
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const voltar = voltarPara ?? `/empresas/${companyId}/estoque/fichas`
  const [carregando, setCarregando] = useState(editando)
  const [nomeProduzido, setNomeProduzido] = useState(!editando ? nomeInicial ?? qp?.get('nome') ?? '' : '')
  const [unidadeProduzido, setUnidadeProduzido] = useState<'KG' | 'UN' | 'LT'>('UN')
  const [tipoProduto, setTipoProduto] = useState<'INTERMEDIARIO' | 'PRODUTO_FINAL'>(
    tipoTravado ?? (!editando && qp?.get('tipo') === 'PRODUTO_FINAL' ? 'PRODUTO_FINAL' : 'INTERMEDIARIO'))
  const [setorId, setSetorId] = useState<string>('')
  const [valorVenda, setValorVenda] = useState(!editando && precoInicial != null ? String(precoInicial) : '')
  const [loteBase, setLoteBase] = useState('1')
  // ⚠️ default do lote POR MUNDO: produto final é per-serving (1 xis = 1 receita → 1 UN);
  // intermediário nasce em KG porque a cozinha pesa a matéria-prima do lote.
  const [unidadeLoteBase, setUnidadeLoteBase] = useState<'KG' | 'UN' | 'LT'>(tipoTravado === 'PRODUTO_FINAL' ? 'UN' : 'KG')
  const [validadeDias, setValidadeDias] = useState('')
  const [tempoPreparoMin, setTempoPreparoMin] = useState('')
  const [modoPreparo, setModoPreparo] = useState('')
  const [comps, setComps] = useState<Comp[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // ⭐ PRÉ-PREENCHIMENTO ROBUSTO (27/08) — o `useState` só lê o valor inicial NA MONTAGEM.
  // Se o editor montar antes de a tela de trás ter os dados (ou remontar), nome e preço
  // ficam vazios e o dono redigita o que a própria tela mostra logo acima. Este efeito
  // aplica os valores QUANDO ELES CHEGAM, e só enquanto o campo está intocado — nunca
  // sobrescreve o que o dono digitou.
  useEffect(() => {
    if (editando) return
    if (nomeInicial) setNomeProduzido((v) => (v.trim() === '' ? nomeInicial : v))
    if (precoInicial != null) setValorVenda((v) => (v.trim() === '' ? String(precoInicial) : v))
  }, [editando, nomeInicial, precoInicial])

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

  // ⭐ CUSTO AO VIVO — e o conceito MUDA com o mundo (27/08):
  //
  // INTERMEDIÁRIO é produzido em LOTE e o rendimento é MEDIDO na conclusão (5 kg de carne
  // rendem quantos pacotes? só a produção diz) → custo por unidade fica "a apurar" até a 1ª.
  //
  // PRODUTO FINAL se MONTA NA VENDA: 1 xis = 1 receita, não existe lote nem rendimento a
  // medir → o custo por unidade é Σ dos componentes AO VIVO, agora. Herdar o "a apurar" do
  // intermediário (o que a tela fazia) escondia o custo justamente no produto que interessa.
  // É o mesmo per-serving dos líderes pra menu item.
  const finalMontadoNaVenda = tipoProduto === 'PRODUTO_FINAL'
  const custo = useMemo(() => {
    const semCusto = comps.filter((c) => c.custoMedio == null).length
    const custoLote = semCusto > 0 ? null : round2(comps.reduce((s, c) => s + (c.custoMedio ?? 0) * c.qtdPlanejada, 0))
    const lote = parseNum(loteBase)
    const custoPorUnidade = finalMontadoNaVenda && custoLote != null && lote != null && lote > 0
      ? round2(custoLote / lote)
      : null
    return { custoLote, custoPorUnidade, custoADefinir: semCusto > 0, semCusto }
  }, [comps, loteBase, finalMontadoNaVenda])

  // margem prévia: com o preço praticado no PDV já pré-preenchido, ela nasce calculada
  const margemPrevia = useMemo(() => {
    const p = parseNum(valorVenda)
    if (!finalMontadoNaVenda || p == null || p <= 0 || custo.custoPorUnidade == null) return null
    return round2((p - custo.custoPorUnidade) / p)
  }, [valorVenda, custo.custoPorUnidade, finalMontadoNaVenda])

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
      window.location.href = voltar
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
          {/* ⭐ o TIPO some quando o mundo de origem já respondeu (cardápio = produto final,
              produção = intermediário). Perguntar de novo é dar chance de errar numa decisão
              que a tela já tomou — e tipo errado desloca o produto pro mundo errado. */}
          {!tipoTravado && (
            <label className="text-xs text-slate-500">Tipo
              <select value={tipoProduto} onChange={(e) => setTipoProduto(e.target.value as 'INTERMEDIARIO' | 'PRODUTO_FINAL')} disabled={editando} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm disabled:bg-slate-50"><option value="INTERMEDIARIO">Intermediário</option><option value="PRODUTO_FINAL">Produto final</option></select>
            </label>
          )}
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
        <p className="text-sm font-semibold text-slate-900">{finalMontadoNaVenda ? 'A receita' : 'Lote base (a receita de referência)'}</p>
        {finalMontadoNaVenda && <p className="-mt-1 text-[11px] text-slate-400">Deixe em <b>1 UN</b> se a receita abaixo é de UMA unidade vendida (o normal). Só mude se ela rende várias porções.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">{finalMontadoNaVenda ? 'A receita rende' : 'Rende a partir de'}
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
            <p className="text-xs text-slate-500">{finalMontadoNaVenda ? 'Custo por unidade' : 'Custo do lote'}</p>
            {custo.custoADefinir ? (
              <p className="text-sm font-semibold text-amber-600">a definir</p>
            ) : (
              <p className="text-lg font-semibold tabular-nums text-slate-900">{brl(finalMontadoNaVenda ? custo.custoPorUnidade : custo.custoLote)}</p>
            )}
            {finalMontadoNaVenda && margemPrevia != null && (
              <p className={`text-[11px] font-medium ${margemPrevia < 0.15 ? 'text-rose-600' : margemPrevia < 0.3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                margem {Math.round(margemPrevia * 100)}%
              </p>
            )}
          </div>
        </div>
        {custo.custoADefinir && <p className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3 w-3" /> {custo.semCusto} componente(s) sem custo médio ainda — o custo do produto fica "a definir" (nunca chutamos).</p>}
        {finalMontadoNaVenda ? (
          <p className="text-[11px] text-slate-400">
            Produto final <b>monta na venda</b>: o custo por unidade é a soma dos componentes, agora — sem esperar produção.
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">Custo por unidade só depois da 1ª produção (o rendimento é medido, não chutado) — hoje: <b>a apurar</b>.</p>
        )}

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
        <a href={voltar} className="text-sm text-slate-500 hover:text-slate-700">cancelar</a>
      </div>
    </div>
  )
}

// ⭐ BUSCA DE INGREDIENTE (27/08) — por default só o que É ingrediente.
// A tela estava oferecendo DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA como componente
// de lanche: o catálogo inteiro entrava na busca. Agora o servidor filtra (escopo=receita)
// e ordena intermediário/matéria-prima primeiro. O toggle "mostrar tudo" existe pro caso
// legítimo raro (embalagem que entra no custo do delivery, por exemplo) — some por default,
// não desaparece.
function BuscaItem({ companyId, jaAdicionados, onAdd }: { companyId: string; jaAdicionados: string[]; onAdd: (it: ItemBusca) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ItemBusca[]>([])
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [tudo, setTudo] = useState(false)
  const [novaUnidade, setNovaUnidade] = useState<'KG' | 'UN' | 'LT'>('KG')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const escopo = tudo ? '' : '&escopo=receita'
      fetch(`/api/empresas/${companyId}/estoque/itens?busca=${encodeURIComponent(q)}${escopo}`).then((r) => r.json()).then((j) => setRes(j.itens ?? [])).catch(() => setRes([]))
    }, 200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, companyId, tudo])

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
        <input value={q} onFocus={() => setAberto(true)} onChange={(e) => { setQ(e.target.value); setAberto(true) }} placeholder="buscar ingrediente (ou criar um que nunca veio em nota)…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-20 text-sm" />
        <button type="button" onClick={() => setTudo((v) => !v)}
          className={`absolute right-2 top-1.5 rounded px-1.5 py-1 text-[10px] ${tudo ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
          title={tudo ? 'mostrando o catálogo inteiro' : 'mostrando só ingredientes (matéria-prima, produzidos, revenda)'}>
          {tudo ? 'tudo' : 'só ingredientes'}
        </button>
      </div>
      {aberto && (res.length > 0 || termo) && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.map((it) => {
            const dentro = jaAdicionados.includes(it.id)
            return (
              <button key={it.id} disabled={dentro} onClick={() => { onAdd(it); setQ(''); setAberto(false) }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40">
                <span className="text-slate-700">{it.nome}{(it.categoria === 'INTERMEDIARIO' || it.categoria === 'PRODUTO_FINAL') && <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">produzido</span>}{it.categoria === 'REVENDA' && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">revenda</span>}</span>
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
