'use client'

// ESTOQUE — HISTÓRICO DO ITEM. Cabeçalho + gráfico de preço + **tudo** que aconteceu com o
// item: entradas E saídas, cada linha com o TIPO real, QUEM fez e link pra ORIGEM.
//
// ⛔ Era "Histórico de compras" e mostrava o ledger inteiro sob esse nome (08/09/2026).

import { useEffect, useState, use, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Loader2, ArrowLeft, TrendingUp, ChevronDown, Ruler, ExternalLink, History } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { NomeEditavel } from '@/components/estoque/nome-editavel'
import { MinMaxEditor } from '@/components/estoque/min-max-editor'
import { statusEstoque, type StatusEstoqueResult } from '@/lib/stock/status-estoque'
import type { LinhaDoHistorico, FamiliaMovimento } from '@/lib/stock/movimento-explicado'

interface Ficha {
  item: { id: string; nome: string; unidadeControle: string; categoriaLabel: string; ativo: boolean; estoqueMin: number | null; estoqueMax: number | null }
  saldo: number; custoMedio: number | null; valor: number; status: StatusEstoqueResult
  historico: LinhaDoHistorico[]
  tipos: { tipo: string; chip: string; n: number }[]
  precoTempo: { data: string; preco: number }[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtDia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

/**
 * ⭐ A COR DO CHIP É A DA FAMÍLIA — o dono reconhece o tipo de longe, sem ler.
 * ⚠️ Máx 2 pesos escuros por linha (régua da casa): o chip é claro, o peso fica no número.
 */
const COR_DA_FAMILIA: Record<FamiliaMovimento, string> = {
  COMPRA:   'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CONTAGEM: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  PRODUCAO: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  VENDA:    'bg-amber-50 text-amber-800 ring-amber-600/20',
  SAIDA:    'bg-rose-50 text-rose-700 ring-rose-600/20',
  ESTORNO:  'bg-slate-100 text-slate-600 ring-slate-500/20',
  OUTRO:    'bg-slate-100 text-slate-600 ring-slate-500/20',
}

export default function FichaItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = use(params)
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  /** 'TUDO' · 'COMPRAS' (a aba pra comparar preço de fornecedor) · ou um tipo específico */
  const [filtro, setFiltro] = useState<string>('TUDO')

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/itens/${itemId}`).then((r) => r.json()).then((j) => setFicha(j.ficha ?? null)).catch(() => setFicha(null))
  }, [id, itemId])

  // ⚠️ REGRA 9: os hooks ficam ANTES do early return, com `?? []` — a ordem deles não pode
  // depender de dado carregado.
  const linhas = useMemo(() => {
    const todas = ficha?.historico ?? []
    if (filtro === 'TUDO') return todas
    if (filtro === 'COMPRAS') return todas.filter((l) => l.ehCompra)
    return todas.filter((l) => l.tipo === filtro)
  }, [ficha, filtro])

  if (ficha === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!ficha) return <div className="p-6 text-sm text-slate-500">Item não encontrado.</div>

  const nCompras = ficha.historico.filter((l) => l.ehCompra).length

  return (
    <div className="space-y-6">
      <a href={`/empresas/${id}/estoque/posicao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra posição</a>

      {/* cabeçalho */}
      <div>
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 shrink-0 text-[#185FA5]" />
          <div className="min-w-0">
            <div className="text-xl"><NomeEditavel companyId={id} itemId={itemId} nome={ficha.item.nome} className="text-xl font-semibold" onSalvo={(n) => setFicha({ ...ficha, item: { ...ficha.item, nome: n } })} /></div>
            <p className="text-sm text-slate-500">{ficha.item.categoriaLabel} · controle em {ficha.item.unidadeControle}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Saldo atual</p><p className="text-lg font-semibold tabular-nums text-slate-900">{num(ficha.saldo)} {ficha.item.unidadeControle}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Custo médio</p><p className="text-lg font-semibold tabular-nums text-slate-900">{ficha.custoMedio != null ? brl(ficha.custoMedio) : '—'}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Valor em estoque</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(ficha.valor)}</p></CardContent></Card>
        </div>
      </div>

      {/* trocar a régua do item (unidade de compra → unidade de consumo) */}
      <ReunitizarBloco companyId={id} itemId={itemId} nome={ficha.item.nome} unidade={ficha.item.unidadeControle} saldo={ficha.saldo} custoMedio={ficha.custoMedio} />

      {/* faixa de estoque (mín/máx) + status */}
      <MinMaxEditor
        companyId={id} itemId={itemId} unidade={ficha.item.unidadeControle}
        estoqueMin={ficha.item.estoqueMin} estoqueMax={ficha.item.estoqueMax} status={ficha.status}
        onSalvo={(min, max) => setFicha({ ...ficha, item: { ...ficha.item, estoqueMin: min, estoqueMax: max }, status: statusEstoque(ficha.saldo, min, max) })}
      />

      {/* gráfico de preço no tempo (2+ compras) */}
      {ficha.precoTempo.length >= 2 && (
        <Card><CardContent className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><TrendingUp className="h-4 w-4" /> Preço unitário no tempo</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ficha.precoTempo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={50} tickFormatter={(v) => brl(v)} />
                <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(l) => fmtDia(String(l))} />
                <Line type="monotone" dataKey="preco" stroke="#185FA5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      )}

      {/* ⭐⭐ HISTÓRICO DO ITEM — entradas E saídas, cada linha com tipo/quem/origem */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-[#185FA5]" />
          <h2 className="text-sm font-semibold text-slate-900">Histórico do item</h2>
          <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">tudo que entrou e saiu — clique na origem pra chegar na fonte</p>
        </div>

        {/* ⭐ o filtro só oferece o que EXISTE neste item — opção vazia é convite a beco sem saída */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {[
            { k: 'TUDO', label: `Tudo (${ficha.historico.length})` },
            ...(nCompras ? [{ k: 'COMPRAS', label: `Só compras (${nCompras})` }] : []),
            ...ficha.tipos.map((t) => ({ k: t.tipo, label: `${t.chip} (${t.n})` })),
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setFiltro(o.k)}
              className={`h-7 rounded-lg px-2.5 text-[12px] font-medium transition ${
                filtro === o.k ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {linhas.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-slate-500">
            {ficha.historico.length === 0
              ? 'Nada aconteceu com este item ainda. Cada recebimento, contagem, produção ou venda aparece aqui.'
              : 'Nenhuma linha neste filtro.'}
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="density-normal w-full min-w-[720px]">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">O que foi</th>
                <th className="px-3 py-2 font-medium">De onde veio</th>
                <th className="px-3 py-2 font-medium">Quem</th>
                <th className="px-3 py-2 text-right font-medium">Qtd</th>
                {/* ⚠️ o rótulo é GENÉRICO na coluna porque a natureza muda por linha; cada
                    célula diz qual é a sua (preço de compra × custo médio da baixa). */}
                <th className="px-3 py-2 text-right font-medium">Custo un.</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.movimentoId} className={`border-b border-slate-50 last:border-0 ${l.familia === 'ESTORNO' ? 'bg-slate-50/60' : ''}`}>
                    <td className="px-3 py-0 text-[13px] tabular-nums text-slate-700">{fmtDia(l.data)}</td>
                    <td className="px-3 py-0">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${COR_DA_FAMILIA[l.familia]}`}>
                        {l.chip}
                      </span>
                      {/* ⭐ o estorno DIZ o que estornou — antes era só uma linha vermelha */}
                      {l.estornoDe && (
                        <span className="ml-1.5 text-[11.5px] text-slate-500">
                          do {l.estornoDe.chip.toLowerCase()} de {fmtDia(l.estornoDe.data)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-0 text-[13px] text-slate-600">
                      {l.href ? (
                        <a href={l.href} className="inline-flex items-center gap-1 text-[#185FA5] hover:underline">
                          {l.detalhe}<ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      ) : l.detalhe}
                    </td>
                    <td className="px-3 py-0 text-[13px] text-slate-600">{l.quem ?? <span className="text-slate-300">—</span>}</td>
                    <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${l.quantidade < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {l.quantidade > 0 ? '+' : ''}{num(l.quantidade)} {ficha.item.unidadeControle}
                    </td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">
                      {brl(l.custoUnitario)}
                      {/* ⛔ SAÍDA NÃO É PREÇO DE COMPRA: dizer "preço un." num consumo faria o
                          dono comparar fornecedor contra a média interna do próprio estoque. */}
                      {!l.precoEhDeCompra && <span className="ml-1 text-[10.5px] font-normal text-slate-400">médio</span>}
                    </td>
                    <td className={`px-3 py-0 text-right text-[13px] font-medium tabular-nums ${l.custoTotal < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{brl(l.custoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  )
}


// ⭐ TROCAR A RÉGUA DO ITEM (27/08) — unidade de COMPRA → unidade de CONSUMO.
//
// O caso que pediu isto: o pão entrou controlado em PACOTE (12 pães, R$ 27,75) e a receita
// usa 1 PÃO (R$ 2,31). Pôr `1` na ficha baixaria um pacote inteiro por lanche — 12× a mais.
// Fica AQUI porque é aqui que o dono percebe (olhando saldo e custo médio do item).
//
// A prévia é obrigatória de propósito: mexe no ledger (estorno + movimento novo) e no fator
// aprendido das notas. Ver os dois lados antes de confirmar é o padrão do módulo.
function ReunitizarBloco({ companyId, itemId, nome, unidade, saldo, custoMedio }: {
  companyId: string; itemId: string; nome: string; unidade: string; saldo: number; custoMedio: number | null
}) {
  const [aberto, setAberto] = useState(false)
  const [fator, setFator] = useState('')
  const [novoNome, setNovoNome] = useState(nome)
  const [prev, setPrev] = useState<{ antes: { saldo: number; custoMedio: number | null; valor: number }; depois: { saldo: number; custoMedio: number | null; valor: number }; movimentos: number; mapas: { cProd: string; xProd: string | null; unidadeNota: string | null; fatorAntes: number; fatorDepois: number }[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const f = Number((fator || '').replace(',', '.'))
  const valido = Number.isFinite(f) && f > 1

  const verPrevia = async () => {
    setBusy(true); setErro(null); setPrev(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}/reunitizar?fator=${f}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui calcular a prévia.'); return }
      setPrev(j)
    } finally { setBusy(false) }
  }

  const aplicar = async () => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}/reunitizar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fator: f, novoNome: novoNome.trim() !== nome ? novoNome.trim() : undefined }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui trocar a unidade.'); return }
      window.location.reload()
    } finally { setBusy(false) }
  }

  if (!aberto) {
    // ⚠️⚠️ ISTO ERA TEXTO MORTO NA PRÁTICA (30/08/2026). O `onClick` sempre esteve aqui e
    // a API sempre respondeu — mas o gatilho era `text-xs text-slate-400` sem borda, sem
    // ícone, com sublinhado só no `hover` (que no CELULAR não existe). O dono olhou e leu
    // como legenda: *"aparece mas não é clicável, não tem botão"*. E ele está certo:
    // **controle que ninguém reconhece como controle é controle morto** — o defeito é de
    // afordância, não de código, e o efeito pro dono é o mesmo (não consegue converter).
    //
    // Agora é uma linha com borda, chevron e verbo no rótulo. `aria-expanded` porque isto
    // é um disclosure de verdade, não um link decorativo.
    return (
      <button
        onClick={() => setAberto(true)}
        aria-expanded={false}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50"
      >
        <Ruler className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1">
          <b className="font-medium">Converter a unidade</b>
          <span className="block text-[11px] text-slate-400">
            está em {unidade} de compra e você usa por unidade menor? (ex: 1 cartela = 30 ovos)
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    )
  }

  return (
    <Card className="border-amber-200"><CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Trocar a unidade de controle</p>
          <p className="text-xs text-slate-500">
            Hoje: <b>{num(saldo)} {unidade}</b> a {custoMedio != null ? brl(custoMedio) : '—'} cada.
            Se 1 {unidade} na verdade contém várias unidades de uso, informe quantas.
          </p>
        </div>
        <button onClick={() => { setAberto(false); setPrev(null); setErro(null) }} className="text-xs text-slate-400 hover:text-slate-600">fechar</button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">1 {unidade} contém
          <input value={fator} onChange={(e) => { setFator(e.target.value); setPrev(null) }} inputMode="decimal" placeholder="ex: 12"
            className="mt-1 block w-24 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
        </label>
        <label className="min-w-[220px] flex-1 text-xs text-slate-500">Novo nome (o antigo passa a mentir)
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm" />
        </label>
        <button onClick={verPrevia} disabled={!valido || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          {busy && !prev ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} ver a prévia
        </button>
      </div>

      {prev && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-400">Hoje</p>
              <p className="tabular-nums text-slate-700">{num(prev.antes.saldo)} {unidade} × {prev.antes.custoMedio != null ? brl(prev.antes.custoMedio) : '—'}</p>
            </div>
            <div>
              <p className="text-slate-400">Depois</p>
              <p className="font-medium tabular-nums text-slate-900">{num(prev.depois.saldo)} × {prev.depois.custoMedio != null ? brl(prev.depois.custoMedio) : '—'}</p>
            </div>
          </div>
          {/* a âncora que prova que a conta só mudou de régua */}
          <p className="text-[11px] text-emerald-700">
            ✓ O valor em estoque não muda: <b>{brl(prev.antes.valor)}</b> antes e depois.
          </p>
          <p className="text-[11px] text-slate-500">
            {prev.movimentos} movimento(s) do histórico são reescritos na régua nova (estorno + linha nova — o ledger não se apaga).
          </p>
          {prev.mapas.map((m) => (
            <p key={m.cProd} className="text-[11px] text-slate-500">
              Fator da nota “{m.xProd ?? m.cProd}” ({m.unidadeNota}): <b>{m.fatorAntes} → {m.fatorDepois}</b> — a próxima nota já entra convertida.
            </p>
          ))}
          <button onClick={aplicar} disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} confirmar a troca
          </button>
        </div>
      )}

      {erro && <p className="text-xs text-rose-600">{erro}</p>}
    </CardContent></Card>
  )
}
