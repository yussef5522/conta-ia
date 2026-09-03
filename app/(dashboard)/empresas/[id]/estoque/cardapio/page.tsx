'use client'

// ESTOQUE — HUB DO CARDÁPIO (27/08). A CASA DO DONO: a lista do que se VENDE.
//
// Padrão dos líderes (MarketMan/Apicbase): MENU-FIRST. A lista não é de fichas — é dos
// PRODUTOS VENDIDOS, e a ficha é um atributo ("tem receita? está completa?"). Por isso o
// produto que vendeu 57× e não tem ficha aparece em VERMELHO no topo: é o trabalho a fazer,
// não uma ausência a esconder.
//
// Onboarding pelo VOLUME: o banner aponta o campeão de vendas sem ficha. O dono monta o
// cardápio na ordem que importa pro bolso dele, não na ordem alfabética.
//
// Anatomia da família: StatCards clicáveis (filtram) · cabeçalho de 1 linha · filtros h-9 ·
// tabela density-normal · régua de totais · mobile em cards.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { ehProntoNoCardapio } from '@/lib/stock/cardapio/hub'
import type { LinhaPrateleira } from '@/lib/stock/vendas/complemento-map'
import { cardsDaPrateleira, secoesDaPrateleira, precisaCarregarPrateleira, agruparPorDestino } from '@/lib/stock/vendas/painel-complementos'
import { UtensilsCrossed, Loader2, Download, Search, AlertTriangle, ChevronRight, ChevronDown, Sparkles, CircleDollarSign, PackageCheck, HelpCircle } from 'lucide-react'

type Status = 'SEM_DESTINO' | 'SEM_FICHA' | 'REVENDA' | 'FICHA_INCOMPLETA' | 'FICHA_OK'
interface Linha {
  chave: string; nome: string; nomesSuitable: string[]
  destinoTipo: 'FICHA' | 'REVENDA' | null; fichaId: string | null; itemId: string | null
  status: Status; vendasQtd: number; vendasValor: number
  custoUnitario: number | null; componentesSemCusto: number
  precoCardapio: number | null; precoPraticado: number | null
  precoUsado: number | null; precoOrigem: 'praticado' | 'cardapio' | null; margem: number | null
}
/** uma linha da prateleira de complementos */
// ⭐ O TIPO VEM DA LIB QUE MONTA O PAYLOAD, não é reescrito à mão aqui.
// ⚠️ É a dívida registrada em 01/09: interface escrita à mão sobre resposta de API é
// PROMESSA, não prova — o `tsc` valida a tela contra o que o autor ACHA que a rota devolve
// (foi assim que um `bankAccount` sem `| null` derrubou a carteira com a suíte verde).
type Comp = LinhaPrateleira

interface Hub {
  linhas: Linha[]
  periodo: { desde: string | null; ate: string | null; dias: number | null }
  campeaoSemFicha: { nome: string; vendasQtd: number } | null
  totais: { produtos: number; vendasQtd: number; vendasValor: number; semDestino: number; semCusto: number; prontos: number }
}

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const fmtDia = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')

const BADGE: Record<Status, { txt: string; cls: string }> = {
  SEM_DESTINO: { txt: 'sem ficha', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  SEM_FICHA: { txt: 'ficha removida', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  FICHA_INCOMPLETA: { txt: 'ficha incompleta', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  REVENDA: { txt: 'revenda', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  FICHA_OK: { txt: 'completa', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}
type Filtro = 'todos' | 'semficha' | 'semcusto' | 'ok'
type Col = 'nome' | 'vendas' | 'custo' | 'preco' | 'margem'

export default function CardapioHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [hub, setHub] = useState<Hub | null | undefined>(undefined)
  // ⭐ ABA COMPLEMENTOS (02/09): os sabores vivem em OUTRO relatório do PDV. Sem eles o
  // estoque não baixa sabor nenhum — o relatório de produtos diz que saíram N pizzas
  // grandes, mas não diz de QUE sabor.
  // ⭐ a aba vem da URL (`?aba=complementos`): sem isto, voltar do editor cairia na aba de
  // produtos e o dono teria que clicar de novo — 50 vezes numa tarde de fichas.
  const abaDaUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('aba') : null
  const [aba, setAba] = useState<'produtos' | 'complementos'>(abaDaUrl === 'complementos' ? 'complementos' : 'produtos')
  const [prateleira, setPrateleira] = useState<Comp[] | null>(null)

  const [periodoComp, setPeriodoComp] = useState<{ de: string; ate: string; dias: number } | null>(null)
  const carregarPrateleira = () =>
    fetch(`/api/empresas/${id}/estoque/vendas/complementos`)
      .then((r) => r.json()).then((j) => { setPrateleira(j.prateleira ?? []); setPeriodoComp(j.periodo ?? null) })
      .catch(() => setPrateleira([]))

  /** ⭐ mover de grupo é decisão do dono (a régua do cardápio é só o padrão) — stock.manage */
  const moverGrupo = async (nome: string, grupo: 'SABOR' | 'OUTRO' | 'SEGUIR_CARDAPIO') => {
    const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos/grupo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeSuitable: nome, grupo }),
    })
    if (r.ok) carregarPrateleira()
    return r.ok
  }

  /** ⚠️ mapear é `stock.manage` — a operadora vê a aba, mas o destino é decisão do dono. */
  const mapear = async (nome: string, destino: 'IGNORAR' | 'LIMPAR' | 'FICHA', fichaId?: string) => {
    const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos/mapear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeSuitable: nome, destino, fichaId: fichaId ?? null }),
    })
    if (r.ok) carregarPrateleira()
    return r.ok
  }
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const { col, dir, alternar, ordenar } = useSort<Col>('vendas', 'desc')

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/cardapio`)
      .then((r) => r.json()).then(setHub).catch(() => setHub(null))
  }, [id])

  // ⭐⭐ A PRATELEIRA CARREGA POR ESTADO, NÃO POR CLIQUE — ver `precisaCarregarPrateleira`.
  // ⚠️ Hook no TOPO (REGRA 9): abaixo há early-returns, e hook depois deles muda a contagem
  // entre renders e derruba a tela inteira.
  useEffect(() => {
    if (precisaCarregarPrateleira(aba, prateleira)) carregarPrateleira()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, prateleira, id])

  const linhas = useMemo(() => {
    if (!hub) return []
    const q = busca.trim().toLowerCase()
    const filtradas = hub.linhas.filter((l) => {
      if (filtro === 'semficha' && l.status !== 'SEM_DESTINO' && l.status !== 'SEM_FICHA') return false
      if (filtro === 'semcusto' && l.custoUnitario != null) return false
      if (filtro === 'ok' && !ehProntoNoCardapio(l)) return false
      if (q && !l.nome.toLowerCase().includes(q) && !l.nomesSuitable.some((n) => n.toLowerCase().includes(q))) return false
      return true
    })
    return ordenar(filtradas, (l, c) =>
      c === 'nome' ? l.nome : c === 'vendas' ? l.vendasQtd : c === 'custo' ? l.custoUnitario
      : c === 'preco' ? l.precoUsado : l.margem)
  }, [hub, busca, filtro, ordenar])

  if (hub === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (hub === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o cardápio.</div>

  const t = hub.totais
  const abrir = (l: Linha) => { window.location.href = `/empresas/${id}/estoque/cardapio/${encodeURIComponent(l.chave)}` }

  return (
    <div className="space-y-3">
      {/* cabeçalho de UMA linha (molde) */}
      <div className="flex flex-wrap items-center gap-2.5">
        <UtensilsCrossed className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Cardápio</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">
          {/* ⚠️ O PERÍODO É DO RELATÓRIO DE PRODUTOS e só aparece na aba dele. Os dois
              relatórios são importados em dias diferentes (21/08 produtos × 29/08
              complementos, medido em prod) — um cabeçalho só falando pelos dois faz
              parecer que a outra aba está filtrada por data, e ela não está. */}
          {aba === 'produtos'
            ? <>O que você vende: receita, custo e margem por produto{hub.periodo.desde && ` · vendas de ${fmtDia(hub.periodo.desde)} a ${fmtDia(hub.periodo.ate)}`}</>
            : <>Os sabores e adicionais do PDV: cada um precisa de um destino pra baixar estoque</>}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <a href={`/api/empresas/${id}/estoque/cardapio?formato=csv`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a href={`/empresas/${id}/estoque/vendas`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
            Vendas do dia
          </a>
        </div>
      </div>

      {/* ⭐ AS DUAS ABAS. Produtos = o que o cliente compra; Complementos = os sabores que
          ele escolhe dentro do produto. Relatórios diferentes do PDV, mapeamentos
          separados (25 nomes aparecem nos dois — com um mapa só, baixariam 2×). */}
      <div className="flex items-center gap-1.5">
        {(['produtos', 'complementos'] as const).map((t) => (
          <button key={t} onClick={() => setAba(t)}
            className={`h-8 rounded-lg px-3 text-xs ${aba === t ? 'bg-[#185FA5] font-medium text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            {t === 'produtos' ? 'Produtos' : 'Complementos (sabores)'}
          </button>
        ))}
      </div>

      {aba === 'complementos' && (
        <PrateleiraComplementos id={id} linhas={prateleira} periodo={periodoComp} onMapear={mapear} onMoverGrupo={moverGrupo} onRecarregar={carregarPrateleira} />
      )}

      {aba === 'produtos' && <>

      {/* ONBOARDING — o campeão de venda sem ficha. Some sozinho quando não houver. */}
      {hub.campeaoSemFicha && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-xs text-amber-900">
            <b>{hub.campeaoSemFicha.nome}</b> vendeu <b>{hub.campeaoSemFicha.vendasQtd}</b> e ainda não tem ficha
            {t.semDestino > 1 && <span className="text-amber-700"> — e outros {t.semDestino - 1} produto(s) também</span>}.
            <span className="hidden sm:inline"> Sem ficha, a venda não baixa estoque nem calcula margem.</span>
          </p>
          <button onClick={() => setFiltro('semficha')}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-xs font-semibold text-white hover:bg-amber-700">
            montar agora <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* cards clicáveis = filtro */}
      <StatCardGrid>
        <StatCard tone="slate" label="Produtos" value={String(t.produtos)} sub={`${t.vendasQtd} un vendidas`} icon={UtensilsCrossed}
          onClick={() => setFiltro('todos')} active={filtro === 'todos'} />
        <StatCard tone="rose" label="Sem ficha" value={String(t.semDestino)} sub="não baixam estoque" icon={AlertTriangle}
          onClick={() => setFiltro('semficha')} active={filtro === 'semficha'} />
        <StatCard tone="amber" label="Custo a definir" value={String(t.semCusto)} sub="sem margem confiável" icon={HelpCircle}
          onClick={() => setFiltro('semcusto')} active={filtro === 'semcusto'} />
        <StatCard tone="emerald" label="Prontos" value={String(t.prontos)} sub="custo e margem ok" icon={PackageCheck}
          onClick={() => setFiltro('ok')} active={filtro === 'ok'} />
      </StatCardGrid>

      {/* filtros numa linha */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-[320px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar produto…"
            className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-sm" />
        </div>
        {filtro !== 'todos' && (
          <button onClick={() => setFiltro('todos')} className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
            limpar filtro
          </button>
        )}
        <span className="text-xs text-slate-400">{linhas.length} de {hub.linhas.length}</span>
      </div>

      {hub.linhas.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <UtensilsCrossed className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhum produto ainda.</p>
          <p className="max-w-md text-xs text-slate-500">Importe um dia de vendas do Suitable — os produtos vendidos aparecem aqui pra você montar as fichas.</p>
          <a href={`/empresas/${id}/estoque/vendas`} className="mt-2 inline-flex h-8 items-center rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white">Importar vendas</a>
        </CardContent></Card>
      ) : (
        <>
          {/* DESKTOP */}
          <Card className="hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="density-normal w-full">
                <thead className="border-b bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <SortableTh campo="nome" col={col} dir={dir} onSort={alternar}>Produto</SortableTh>
                    <th className="px-3 py-2 text-left font-medium">Situação</th>
                    <SortableTh campo="vendas" col={col} dir={dir} onSort={alternar} align="right">Vendas</SortableTh>
                    <SortableTh campo="custo" col={col} dir={dir} onSort={alternar} align="right">Custo</SortableTh>
                    <SortableTh campo="preco" col={col} dir={dir} onSort={alternar} align="right">Preço</SortableTh>
                    <SortableTh campo="margem" col={col} dir={dir} onSort={alternar} align="right">Margem</SortableTh>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {linhas.map((l) => (
                    <tr key={l.chave} onClick={() => abrir(l)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-3 py-0 text-[13px]">
                        <span className="font-medium text-slate-900">{l.nome}</span>
                        {l.nomesSuitable.length > 1 && <span className="ml-1.5 text-[11px] text-slate-400">({l.nomesSuitable.length} nomes no PDV)</span>}
                      </td>
                      <td className="px-3 py-0">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ${BADGE[l.status].cls}`}>{BADGE[l.status].txt}</span>
                      </td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">
                        {l.vendasQtd > 0 ? l.vendasQtd : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums">
                        {l.custoUnitario != null ? <span className="text-slate-700">{brl(l.custoUnitario)}</span> : <span className="text-amber-600">a definir</span>}
                      </td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums">
                        {l.precoUsado != null ? (
                          <span className="text-slate-700">{brl(l.precoUsado)}{l.precoOrigem === 'praticado' && <span className="ml-1 text-[10px] text-slate-400">PDV</span>}</span>
                        ) : <span className="text-slate-400">a definir</span>}
                      </td>
                      <td className={`px-3 py-0 text-right text-[13px] font-semibold tabular-nums ${
                        l.margem == null ? 'text-slate-400' : l.margem < 0.15 ? 'text-rose-600' : l.margem < 0.3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {l.margem != null ? `${Math.round(l.margem * 100)}%` : '—'}
                      </td>
                      <td className="px-1 py-0 text-slate-300"><ChevronRight className="h-4 w-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* MOBILE */}
          <div className="space-y-2 sm:hidden">
            {linhas.map((l) => (
              <Card key={l.chave} onClick={() => abrir(l)} className="cursor-pointer">
                <CardContent className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium text-slate-900">{l.nome}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ring-1 ${BADGE[l.status].cls}`}>{BADGE[l.status].txt}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{l.vendasQtd > 0 ? `${l.vendasQtd} vendidas` : 'sem venda no período'}</span>
                    <span className={`font-semibold tabular-nums ${l.margem == null ? 'text-slate-400' : l.margem < 0.15 ? 'text-rose-600' : l.margem < 0.3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {l.margem != null ? `margem ${Math.round(l.margem * 100)}%` : 'margem a definir'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>custo {l.custoUnitario != null ? brl(l.custoUnitario) : 'a definir'}</span>
                    <span>preço {l.precoUsado != null ? brl(l.precoUsado) : 'a definir'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <TotalsBar
            itens={[
              { chave: 'vendido', label: 'Vendido', tone: 'emerald', valor: linhas.reduce((s, l) => s + l.vendasValor, 0), n: linhas.reduce((s, l) => s + l.vendasQtd, 0) },
              { chave: 'custo', label: 'Custo das vendas', tone: 'slate', valor: linhas.reduce((s, l) => s + (l.custoUnitario ?? 0) * l.vendasQtd, 0) },
            ]}
            total={linhas.reduce((s, l) => s + l.vendasValor - (l.custoUnitario ?? 0) * l.vendasQtd, 0)}
            totalLabel="Margem bruta (do que tem custo)"
          />
          {/* honestidade: a régua só soma o que TEM custo — dizer o contrário seria margem inflada */}
          {linhas.some((l) => l.custoUnitario == null && l.vendasQtd > 0) && (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-amber-600">
              <CircleDollarSign className="h-3.5 w-3.5" />
              A margem bruta acima ignora {linhas.filter((l) => l.custoUnitario == null && l.vendasQtd > 0).length} produto(s) sem custo — o número real é menor.
            </p>
          )}
        </>
      )}
      </>}
    </div>
  )
}

/**
 * ⭐⭐ A PRATELEIRA DOS COMPLEMENTOS — o dono preenche, o sistema não inventa.
 *
 * ⚠️ REGRA DELE, e ela governa esta tela: *"você constrói a prateleira; o conteúdo é meu"*.
 * Nenhuma ficha de sabor nasce automaticamente — ficha vazia/pendente, nunca inventada.
 *
 * ⭐ Ordenada por OCORRÊNCIAS DESC e isso não é estética: das 215 linhas, **100 têm 10+
 * ocorrências e carregam 7.269 das 7.648** (95%). CALABRESA (1.220) primeiro faz o dono
 * mapear o que importa antes da cauda longa.
 */
function PrateleiraComplementos({ id, linhas, periodo, onMapear, onMoverGrupo, onRecarregar }: {
  id: string
  linhas: Comp[] | null
  periodo: { de: string; ate: string; dias: number } | null
  onMapear: (nome: string, destino: 'IGNORAR' | 'LIMPAR' | 'FICHA', fichaId?: string) => Promise<boolean>
  onMoverGrupo: (nome: string, grupo: 'SABOR' | 'OUTRO' | 'SEGUIR_CARDAPIO') => Promise<boolean>
  onRecarregar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  // ⭐ IGNORADOS nasce COLAPSADO: decisão já tomada não disputa espaço com trabalho pendente.
  const [aberta, setAberta] = useState<Record<string, boolean>>({ SABORES: true, OUTROS: true, IGNORADOS: false })
  const [apelidosAbertos, setApelidosAbertos] = useState<Record<string, boolean>>({})

  if (linhas === null) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!linhas.length) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <UtensilsCrossed className="h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">Nenhum complemento importado ainda.</p>
        <p className="max-w-md text-xs text-slate-500">
          Suba o <strong>Relatório de Complementos</strong> do PDV em Vendas do dia. É dele que saem
          os sabores — sem ele o estoque não baixa sabor nenhum.
        </p>
        <a href={`/empresas/${id}/estoque/vendas`} className="mt-1 text-xs text-[#185FA5] hover:underline">ir pra Vendas → aba <b>Complementos</b> →</a>
      </CardContent></Card>
    )
  }

  const t = cardsDaPrateleira(linhas)
  const nosDois = linhas.filter((l) => l.tambemProduto).length
  const q = busca.trim().toLowerCase()
  // ⚠️ a busca olha o título E os apelidos: procurar "frango com bacon" tem que achar a
  // linha mesmo quando o título virou o nome da ficha.
  const passa = (l: { destino: string; titulo: string; apelidos: { nomeSuitable: string }[] }) =>
    (!soPendentes || l.destino === 'SEM_FICHA')
    && (!q || l.titulo.toLowerCase().includes(q) || l.apelidos.some((a) => a.nomeSuitable.toLowerCase().includes(q)))
  // ⭐ AGRUPA NA APRESENTAÇÃO: nomes na mesma ficha viram UMA linha com a soma. O dado
  // continua por nome cru (é ele que casa com o relatório de amanhã).
  const secoes = secoesDaPrateleira(agruparPorDestino(linhas)).map((sec) => ({ ...sec, visiveis: sec.linhas.filter(passa) }))

  return (
    <div className="space-y-3">
      {/* ⭐ CARDS — a anatomia da casa (mesma do painel de Produtos) */}
      <StatCardGrid>
        <StatCard tone="rose" label="Pendentes" value={String(t.pendentes)} sub="sem destino, não baixam" icon={AlertTriangle} />
        <StatCard tone="emerald" label="Com ficha" value={String(t.comFicha)} sub="baixam o sabor produzido" icon={PackageCheck} />
        <StatCard tone="slate" label="Ignorados" value={String(t.ignorados)} sub="decisão reversível" icon={HelpCircle} />
        {/* ⭐⭐ o número que responde "quanto da venda já baixa estoque" — por OCORRÊNCIA,
            nunca por nome: CALABRESA sozinha é 18% das ocorrências e 0,8% dos nomes. */}
        <StatCard tone="sky" label="Ocorrências cobertas"
          value={t.pctCoberto == null ? 'a apurar' : `${t.pctCoberto.toLocaleString('pt-BR')}%`}
          sub={`${t.ocorrenciasCobertas.toLocaleString('pt-BR')} de ${t.ocorrenciasTotal.toLocaleString('pt-BR')}`}
          icon={CircleDollarSign} />
      </StatCardGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar complemento…"
          className="h-8 w-[220px] rounded-lg border border-slate-300 px-2.5 text-xs" />
        <button onClick={() => setSoPendentes((v) => !v)}
          className={`h-8 rounded-lg px-3 text-xs ${soPendentes ? 'bg-amber-100 font-medium text-amber-800' : 'border border-slate-300 text-slate-600'}`}>
          só pendentes ({t.pendentes})
        </button>
        <span className="text-xs text-slate-400">
          {linhas.length} complementos
          {/* ⚠️ o período é o DESTE relatório. O cabeçalho da tela fala do de PRODUTOS, que
              costuma ser outro dia — sem esta linha, um vira explicação do outro. */}
          {periodo && ` · importado de ${fmtDia(periodo.de)}${periodo.de !== periodo.ate ? ` a ${fmtDia(periodo.ate)}` : ''}`}
        </span>
      </div>

      {nosDois > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
          <strong>{nosDois} nome(s)</strong> existem também no relatório de <strong>Produtos</strong> (ex: COCA COLA 2L).
          Cada relatório tem destino próprio — se os dois baixarem, o estoque sai duas vezes. Confira linha a linha abaixo.
        </div>
      )}

      {secoes.map((sec) => (
        <Card key={sec.chave}><CardContent className="p-0">
          <button onClick={() => setAberta((a) => ({ ...a, [sec.chave]: !a[sec.chave] }))}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
            {aberta[sec.chave] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            <span className="text-sm font-semibold text-slate-800">{sec.titulo}</span>
            <span className="text-[11px] text-slate-400">{sec.explica}</span>
            <span className="ml-auto text-[11px] text-slate-500">
              {sec.linhas.length} nome(s) · {sec.ocorrencias.toLocaleString('pt-BR')} ocorrências
              {sec.pendentes > 0 && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">{sec.pendentes} pendente(s)</span>}
            </span>
          </button>

          {aberta[sec.chave] && (
            sec.visiveis.length === 0 ? (
              <p className="px-3 pb-3 text-xs text-slate-400">
                {sec.linhas.length === 0 ? 'nada aqui ainda.' : 'nada nesta seção com o filtro atual.'}
              </p>
            ) : (
              <table className="density-normal w-full">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">Complemento (nome do PDV)</th>
                  <th className="px-3 py-2 text-right font-medium">Ocorrências</th>
                  <th className="px-3 py-2 font-medium">Destino</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr></thead>
                <tbody>
                  {sec.visiveis.map((l) => (
                    <tr key={l.titulo} className="border-t border-slate-50">
                      <td className="px-3 py-0 text-[13px]">
                        <p className="font-medium text-slate-800">
                          {l.titulo}
                          {/* ⭐ marca o que o DONO moveu: a régua do cardápio foi sobrescrita aqui */}
                          {l.grupoDoDono && <span className="ml-1.5 text-[10px] text-slate-400">movido por você</span>}
                        </p>
                        {/* ⭐⭐ OS APELIDOS DO PDV, expansíveis: o dado continua por nome cru
                            (é ele que casa com o relatório de amanhã); a linha única é a tela. */}
                        {l.apelidos.length > 1 && (
                          <button onClick={() => setApelidosAbertos((a) => ({ ...a, [l.titulo]: !a[l.titulo] }))}
                            className="text-[11px] text-slate-400 hover:text-slate-600">
                            {apelidosAbertos[l.titulo] ? '▾' : '▸'} {l.apelidos.length} nomes no PDV
                          </button>
                        )}
                        {l.apelidos.length > 1 && apelidosAbertos[l.titulo] && (
                          <ul className="mt-0.5 space-y-0.5">
                            {l.apelidos.map((a) => (
                              <li key={a.nomeSuitable} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="tabular-nums text-slate-400">{a.ocorrencias}×</span>
                                <span className="truncate">{a.nomeSuitable}</span>
                                {/* ⚠️ a ação é POR NOME, sempre: desfazer um apelido devolve
                                    ELE pra fila de pendentes, sem mexer nos outros. */}
                                <button onClick={() => onMapear(a.nomeSuitable, 'LIMPAR')}
                                  className="text-slate-300 hover:text-slate-600">desfazer</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {l.tambemProduto && (
                          <p className="text-[11px] text-amber-700">
                            ⚠️ também é PRODUTO{l.destinoComoProduto ? ` (lá: ${l.destinoComoProduto})` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">
                        {/* ⚠️ 0 aqui não é "vendeu zero": é sabor do cardápio (ou nome já
                            mapeado) que não apareceu no que foi importado. Dizer "—" e o
                            porquê evita ler ausência como número. */}
                        {l.ocorrencias > 0 ? l.ocorrencias.toLocaleString('pt-BR')
                          : <span className="text-slate-400" title="não apareceu no período importado">— não vendeu</span>}
                      </td>
                      <td className="px-3 py-0 text-[13px]">
                        {l.destino === 'FICHA' ? (
                          <a href={`/empresas/${id}/estoque/fichas/${l.fichaId}?voltar=${encodeURIComponent(`/empresas/${id}/estoque/cardapio?aba=complementos`)}`} className="text-[#185FA5] hover:underline">
                            {l.nomeFicha ?? 'ficha'} ↗
                          </a>
                        ) : l.destino === 'IGNORAR' ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">ignorado</span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">sem ficha</span>
                        )}
                      </td>
                      <td className="px-3 py-0 text-[13px]">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* ⭐ mover de grupo: a régua do cardápio é o padrão, o dono manda */}
                          {sec.chave !== 'IGNORADOS' && (
                            <button onClick={() => onMoverGrupo(l.nomeSuitable, l.grupo === 'SABOR' ? 'OUTRO' : 'SABOR')}
                              title={l.grupo === 'SABOR' ? 'mover para Outros complementos' : 'mover para Sabores de pizza'}
                              className="text-[11px] text-slate-400 hover:text-slate-700">
                              {l.grupo === 'SABOR' ? 'não é sabor' : 'é sabor'}
                            </button>
                          )}
                          {l.grupoDoDono && (
                            <button onClick={() => onMoverGrupo(l.nomeSuitable, 'SEGUIR_CARDAPIO')}
                              title="voltar a seguir o cardápio"
                              className="text-[11px] text-slate-300 hover:text-slate-600">seguir cardápio</button>
                          )}
                          {l.destino !== 'IGNORAR' && (
                            <button onClick={() => onMapear(l.nomeSuitable, 'IGNORAR')}
                              className="text-[11px] text-slate-400 hover:text-slate-700">ignorar</button>
                          )}
                          {l.destino !== 'SEM_FICHA' && (
                            <button onClick={() => onMapear(l.nomeSuitable, 'LIMPAR')}
                              className="text-[11px] text-slate-400 hover:text-slate-700">desfazer</button>
                          )}
                          {l.destino === 'SEM_FICHA' && (
                            <a href={`/empresas/${id}/estoque/fichas/nova?tipo=SABOR&nome=${encodeURIComponent(l.nomeSuitable)}&complemento=${encodeURIComponent(l.nomeSuitable)}&voltar=${encodeURIComponent(`/empresas/${id}/estoque/cardapio?aba=complementos`)}`}
                              className="rounded border border-[#185FA5] px-2 py-0.5 text-[11px] text-[#185FA5] hover:bg-blue-50">criar ficha</a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </CardContent></Card>
      ))}

      <button onClick={onRecarregar} className="text-[11px] text-slate-400 hover:text-slate-600">recarregar</button>
    </div>
  )
}
