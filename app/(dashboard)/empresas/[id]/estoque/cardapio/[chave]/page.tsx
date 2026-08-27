'use client'

// ESTOQUE — DENTRO DO PRODUTO (27/08). Cliquei no "Xis Completo" e resolvo tudo AQUI:
// vejo quanto vendeu, quanto custa, a margem, a receita — e o que falta pra vender.
//
// ⭐ A RECEITA SE CRIA/EDITA NESTA TELA. O editor é o MESMO componente do mundo da produção
// (REGRA 4), aberto com o tipo TRAVADO em PRODUTO_FINAL e o "voltar" apontando pra cá — o
// dono nunca cai numa lista de fichas que mistura os dois mundos.
//
// ⭐ FLUXO ENCADEADO: componente que é PRODUZIDO e está sem estoque mostra [produzir agora],
// que cria a ordem já montada e navega pra ela. Cardápio → produto → componente → produção
// → etiqueta, sem o dono ter que saber por qual tela passar.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { FichaEditor } from '@/components/estoque/ficha-editor'
import { ArrowLeft, Loader2, UtensilsCrossed, TrendingUp, CircleDollarSign, Percent, Factory, AlertTriangle, Check, Pencil, PackageSearch, ChevronRight } from 'lucide-react'

type Status = 'SEM_DESTINO' | 'SEM_FICHA' | 'REVENDA' | 'FICHA_INCOMPLETA' | 'FICHA_OK'
interface Linha {
  chave: string; nome: string; nomesSuitable: string[]
  destinoTipo: 'FICHA' | 'REVENDA' | null; fichaId: string | null; itemId: string | null
  status: Status; vendasQtd: number; vendasValor: number
  custoUnitario: number | null; componentesSemCusto: number
  precoCardapio: number | null; precoPraticado: number | null
  precoUsado: number | null; precoOrigem: 'praticado' | 'cardapio' | null; margem: number | null
}
interface Comp {
  itemId: string; nome: string; unidade: string; qtdPorUnidade: number
  custoMedio: number | null; subtotal: number | null; saldo: number
  fichaIdComponente: string | null; tipoComponente: 'INSUMO' | 'INTERMEDIARIO' | 'PRODUTO_FINAL'
  rendeAte: number | null
}
interface Detalhe {
  linha: Linha; componentes: Comp[]
  podeFazer: number | null; gargalo: { nome: string; rendeAte: number } | null
  loteBase: number | null; validadeDias: number | null; versaoAtual: number | null
}

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? null : n }

export default function ProdutoCardapioPage({ params }: { params: Promise<{ id: string; chave: string }> }) {
  const { id, chave } = use(params)
  const [det, setDet] = useState<Detalhe | null | undefined>(undefined)
  const [editandoFicha, setEditandoFicha] = useState(false)
  const [preco, setPreco] = useState('')
  const [editandoPreco, setEditandoPreco] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/cardapio/${chave}`)
    .then((r) => (r.ok ? r.json() : null)).then((j) => { setDet(j); setPreco(j?.linha?.precoCardapio != null ? String(j.linha.precoCardapio) : '') })
    .catch(() => setDet(null))
  useEffect(() => { carregar() }, [id, chave]) // eslint-disable-line react-hooks/exhaustive-deps

  const salvarPreco = async () => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/cardapio/${chave}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valorVenda: parseNum(preco) }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar o preço.'); return }
      setEditandoPreco(false); await carregar()
    } finally { setBusy(false) }
  }

  const produzirAgora = async (fichaId: string) => {
    setBusy(true); setErro(null)
    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichaId, escalaReceitas: 1, dataProducao: hoje }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) { window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`; return }
      setErro(j?.erro ?? 'Não consegui criar a ordem de produção.')
    } finally { setBusy(false) }
  }

  if (det === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (det === null) return (
    <div className="space-y-3 p-6">
      <a href={`/empresas/${id}/estoque/cardapio`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pro cardápio</a>
      <p className="text-sm text-slate-500">Produto não encontrado no cardápio.</p>
    </div>
  )

  const l = det.linha
  const voltar = `/empresas/${id}/estoque/cardapio/${chave}`
  const semFicha = l.status === 'SEM_DESTINO' || l.status === 'SEM_FICHA'

  return (
    <div className="space-y-3">
      <a href={`/empresas/${id}/estoque/cardapio`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Cardápio</a>

      <div className="flex flex-wrap items-center gap-2.5">
        <UtensilsCrossed className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">{l.nome}</h1>
        {l.nomesSuitable.length > 0 && (
          <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">
            no PDV: {l.nomesSuitable.join(' · ')}
          </p>
        )}
        {l.fichaId && !editandoFicha && (
          <button onClick={() => setEditandoFicha(true)}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
            <Pencil className="h-3.5 w-3.5" /> Editar receita{det.versaoAtual ? ` (v${det.versaoAtual})` : ''}
          </button>
        )}
      </div>

      <StatCardGrid>
        <StatCard tone="slate" label="Vendas" value={l.vendasQtd > 0 ? String(l.vendasQtd) : '—'} sub={l.vendasQtd > 0 ? brl(l.vendasValor) : 'sem venda no período'} icon={TrendingUp} />
        <StatCard tone={l.custoUnitario == null ? 'amber' : 'sky'} label="Custo" value={l.custoUnitario != null ? brl(l.custoUnitario) : 'a definir'} sub="por unidade vendida" icon={CircleDollarSign} />
        <StatCard tone="slate" label="Preço" value={l.precoUsado != null ? brl(l.precoUsado) : 'a definir'} sub={l.precoOrigem === 'praticado' ? 'praticado no PDV' : l.precoOrigem === 'cardapio' ? 'cadastrado' : '—'} icon={UtensilsCrossed} />
        <StatCard tone={l.margem == null ? 'slate' : l.margem < 0.15 ? 'rose' : l.margem < 0.3 ? 'amber' : 'emerald'}
          label="Margem" value={l.margem != null ? `${Math.round(l.margem * 100)}%` : 'a definir'} sub={l.margem != null ? brl((l.precoUsado ?? 0) - (l.custoUnitario ?? 0)) + ' por unidade' : 'falta custo ou preço'} icon={Percent} />
      </StatCardGrid>

      {erro && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      {/* preço de cardápio — só faz sentido pra produto com ficha */}
      {l.fichaId && !editandoFicha && (
        <Card><CardContent className="flex flex-wrap items-center gap-3 p-3">
          <span className="text-xs text-slate-500">Preço de cardápio</span>
          {editandoPreco ? (
            <>
              <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="a definir" autoFocus
                className="h-8 w-28 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
              <button onClick={salvarPreco} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#185FA5] px-2.5 text-xs font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} salvar
              </button>
              <button onClick={() => setEditandoPreco(false)} className="text-xs text-slate-400 hover:text-slate-600">cancelar</button>
            </>
          ) : (
            <button onClick={() => setEditandoPreco(true)} className="text-sm font-medium tabular-nums text-slate-800 hover:text-[#185FA5]">
              {l.precoCardapio != null ? brl(l.precoCardapio) : <span className="text-amber-600">a definir</span>}
            </button>
          )}
          {l.precoPraticado != null && l.precoCardapio != null && Math.abs(l.precoPraticado - l.precoCardapio) > 0.01 && (
            <span className="text-[11px] text-amber-600">⚠️ o PDV cobrou {brl(l.precoPraticado)} — a margem acima usa o praticado</span>
          )}
        </CardContent></Card>
      )}

      {/* SEM FICHA — o caminho de montar, com o nome do PDV já preenchido */}
      {semFicha && !editandoFicha && (
        <Card className="border-rose-200"><CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-700"><AlertTriangle className="h-4 w-4" /> Este produto ainda não tem receita.</p>
          <p className="text-xs text-slate-600">
            Sem receita a venda dele <b>não baixa estoque</b> e a margem fica desconhecida.
            {l.vendasQtd > 0 && <> Já foram <b>{l.vendasQtd}</b> unidades vendidas assim.</>}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => setEditandoFicha(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">
              <UtensilsCrossed className="h-3.5 w-3.5" /> Montar a receita
            </button>
            <a href={`/empresas/${id}/estoque/vendas`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50">
              <PackageSearch className="h-3.5 w-3.5" /> É bebida/revenda? mapear lá
            </a>
          </div>
        </CardContent></Card>
      )}

      {/* EDITOR — o MESMO componente do mundo da produção, tipo travado em PRODUTO_FINAL */}
      {editandoFicha && (
        <Card><CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{l.fichaId ? 'Editar a receita' : 'Montar a receita'}</p>
            <button onClick={() => setEditandoFicha(false)} className="text-xs text-slate-400 hover:text-slate-600">fechar</button>
          </div>
          <FichaEditor companyId={id} fichaId={l.fichaId ?? undefined} tipoTravado="PRODUTO_FINAL"
            nomeInicial={l.nomesSuitable[0] ?? l.nome} voltarPara={voltar} />
        </CardContent></Card>
      )}

      {/* RECEITA + status de cada componente (o fluxo encadeado) */}
      {!editandoFicha && det.componentes.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/60 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Receita — o que sai do estoque por unidade</p>
            {det.podeFazer != null && (
              <span className={`ml-auto text-xs ${det.podeFazer === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                dá pra fazer <b>{det.podeFazer}</b>
                {det.gargalo && det.podeFazer < 20 && <span className="text-slate-400"> (limitado por {det.gargalo.nome})</span>}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="density-normal w-full">
              <thead className="border-b text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Componente</th>
                  <th className="px-3 py-2 text-right font-medium">Por unidade</th>
                  <th className="px-3 py-2 text-right font-medium">Custo</th>
                  <th className="px-3 py-2 text-right font-medium">Em estoque</th>
                  <th className="px-3 py-2 text-left font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {det.componentes.map((c) => {
                  const zerado = c.rendeAte != null && c.rendeAte === 0
                  return (
                    <tr key={c.itemId} className={zerado ? 'bg-rose-50/40' : ''}>
                      <td className="px-3 py-0 text-[13px]">
                        <span className="text-slate-900">{c.nome}</span>
                        {c.tipoComponente !== 'INSUMO' && (
                          <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-200">
                            {c.tipoComponente === 'INTERMEDIARIO' ? 'produzido' : 'outro produto'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{num(c.qtdPorUnidade)} {c.unidade}</td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums">
                        {c.subtotal != null ? <span className="text-slate-700">{brl(c.subtotal)}</span> : <span className="text-amber-600">a definir</span>}
                      </td>
                      <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${zerado ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>{num(c.saldo)}</td>
                      <td className="px-3 py-0 text-[13px]">
                        {c.custoMedio == null ? (
                          <span className="text-[11px] text-amber-600">sem custo — entra na 1ª nota</span>
                        ) : zerado && c.fichaIdComponente ? (
                          <button onClick={() => produzirAgora(c.fichaIdComponente!)} disabled={busy}
                            className="inline-flex items-center gap-1 rounded border border-amber-400 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                            <Factory className="h-3 w-3" /> produzir agora
                          </button>
                        ) : zerado ? (
                          <span className="text-[11px] text-rose-600">sem estoque — entra por nota</span>
                        ) : c.fichaIdComponente ? (
                          <a href={`/empresas/${id}/estoque/producao/receitas/${c.fichaIdComponente}`}
                            className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-[#185FA5]">
                            ver a receita dele <ChevronRight className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-emerald-600">ok</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {l.componentesSemCusto > 0 && (
            <p className="border-t bg-amber-50/50 px-3 py-2 text-[11px] text-amber-700">
              {l.componentesSemCusto} componente(s) sem custo médio — o custo do produto fica <b>a definir</b> até a 1ª nota (nunca chutamos).
            </p>
          )}
        </Card>
      )}

      {/* revenda: não tem receita e está tudo certo assim */}
      {!editandoFicha && l.status === 'REVENDA' && (
        <Card><CardContent className="space-y-1 p-4">
          <p className="text-sm font-medium text-slate-800">Revenda — não precisa de receita.</p>
          <p className="text-xs text-slate-500">O custo vem direto da nota de compra e a venda baixa a unidade do estoque.</p>
        </CardContent></Card>
      )}
    </div>
  )
}
