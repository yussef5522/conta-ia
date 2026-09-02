'use client'

// ESTOQUE FASE 2 item 2.1 — home da PRODUÇÃO: lista de ordens (por estado) + nova ordem
// (escolhe a ficha + escala do lote base + data + setor). A conclusão ("quantos saíram?")
// é 2.2. Sem sugestão por min/max ainda (2.4).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
// ⚠️ "×" SAIU DA TELA (01/09, decisão do dono): *"a pessoa fala em porções e em kg, nunca
// em '×'"*. O `escalaReceitas` continua no banco e no motor — só não aparece mais.
import { escalaParaSaida, reguaDoRendimento } from '@/lib/stock/producao/previsao-rendimento'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { Factory, Loader2, Plus, ChevronRight, ClipboardList, Settings, TrendingDown, UtensilsCrossed, Download, PlayCircle, CheckCircle2 } from 'lucide-react'
import { ehReceitaDeProducao } from '@/lib/stock/producao/tipo-receita'

interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; loteBase: number; estado: string; dataProducao: string; setorNome: string | null }
interface Sugestao { fichaId: string; itemProduzidoId: string; nome: string; unidade: string; saldo: number; estoqueMin: number; estoqueMax: number | null; faltam: number; escalaSugerida: number | null; rendimentoMedio: number | null }
interface FichaOpt { id: string; nomeProduzido: string; unidadeProduzido: string; loteBase: number; rendimentoMedio: number | null; rendimentoLotes: number; tipoProduto: string }
interface Setor { id: string; nome: string; ativo: boolean }
interface Painel { emAberto: number; valorEmProducao: number; concluidasNoPeriodo: number; valorProduzidoNoPeriodo: number; rendimentoPeriodo: number | null; lotesNaMedia: number; faixaRendimento: string; abertasDeOntem: number }
type Aberta = Ordem & { deOntem?: boolean }
interface Conclusao { id: string; ordemId: string; qtdGerada: number; custoUnitarioReal: number | null; custoLoteReal: number; colaboradorNome: string | null; rendimento: number; criadoEm: string; pct: number | null; faixa: string; motivo: string | null }

// ⭐ PALETA APROVADA NO MOCKUP (01/09/2026). Cor SÓ com significado — status, desvio,
// dinheiro parado. Texto sobre fundo colorido usa o tom escuro da MESMA família, nunca
// preto puro. Flat: sem sombra, sem gradiente, pesos 400/500.
const C = {
  fundo: '#F5F4EF', card: '#FFFFFF', borda: 'rgba(0,0,0,0.08)',
  primario: '#534AB7', primarioTexto: '#EEEDFE',
  ambarBg: '#FAEEDA', ambarTx: '#633806', ambarAc: '#854F0B',
  verdeBg: '#EAF3DE', verdeTx: '#27500A', verdeAc: '#3B6D11',
  azulBg: '#E6F1FB', azulTx: '#0C447C',
  coralBg: '#FAECE7', coralTx: '#993C1D',
  cinzaBg: '#F1EFE8', cinzaTx: '#5F5E5A',
  vermelhoBg: '#FCEBEB', vermelhoTx: '#791F1F',
  txt2: '#5F5E5A', txt3: '#888780',
  // ⭐ ESCALA TIPOGRÁFICA aprovada em mockup (01/09). REGRA: no máximo DUAS coisas em
  // peso 500 escuro por linha (o nome e o custo). O resto desce um degrau por vez —
  // é o que faz a linha ter hierarquia em vez de virar um bloco cinza uniforme.
  // ⚠️ Mobile usa os MESMOS tamanhos: encolher texto em tela pequena é onde a leitura morre.
  nomeTx: '#2C2C2A', qtdTx: '#444441', tituloTx: '#444441',
}
const T = {
  nome: 'text-[15px]', custo: 'text-[14px]', qtd: 'text-[14px]',
  quem: 'text-[13px]', hora: 'text-[13px]', pill: 'text-[12px]',
  cardNum: 'text-[25px]', cardRot: 'text-[12px]', titulo: 'text-[14px]',
}
const PILL: Record<string, { bg: string; tx: string }> = {
  PLANEJADA: { bg: C.cinzaBg, tx: C.cinzaTx },
  SEPARADA: { bg: C.azulBg, tx: C.azulTx },
  EM_PRODUCAO: { bg: C.ambarBg, tx: C.ambarTx },
  CONCLUIDA: { bg: C.verdeBg, tx: C.verdeTx },
  CANCELADA: { bg: C.vermelhoBg, tx: C.vermelhoTx },
}
const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const ESTADO: Record<string, { label: string; cls: string }> = {
  PLANEJADA: { label: 'Planejada', cls: 'bg-slate-100 text-slate-600' },
  SEPARADA: { label: 'Separada', cls: 'bg-amber-50 text-amber-700' },
  EM_PRODUCAO: { label: 'Em produção', cls: 'bg-sky-50 text-sky-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-50 text-rose-600' },
}
const PAGINA = 25
const fmtQtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export default function ProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ordens, setOrdens] = useState<Ordem[] | null | undefined>(undefined)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [novo, setNovo] = useState(false)
  const [criando, setCriando] = useState<string | null>(null)
  const [painel, setPainel] = useState<Painel | null>(null)
  const [abertas, setAbertas] = useState<Aberta[]>([])
  const [concluidas, setConcluidas] = useState<Conclusao[]>([])
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje')
  const [busca, setBusca] = useState('')
  const [soDeOntem, setSoDeOntem] = useState(false)
  // ⭐ ITEM 4 — período livre + paginação. São a MESMA feature (decisão do dono): período
  // grande sem "carregar mais" vira lista infinita, e paginação sem calendário não tem o
  // que paginar.
  const [custom, setCustom] = useState<{ de: string; ate: string } | null>(null)
  const [abrirCal, setAbrirCal] = useState(false)
  const [mostrar, setMostrar] = useState(PAGINA)

  const janela = (p: typeof periodo) => {
    if (custom) return custom
    const h = new Date(); const d = new Date(h)
    if (p === 'semana') d.setDate(h.getDate() - 6)
    if (p === 'mes') d.setDate(h.getDate() - 29)
    return { de: d.toISOString().slice(0, 10), ate: h.toISOString().slice(0, 10) }
  }
  const carregar = () => {
    const { de, ate } = janela(periodo)
    return fetch(`/api/empresas/${id}/estoque/producao/ordens?de=${de}&ate=${ate}`).then((r) => r.json()).then((j) => {
      setOrdens(j.ordens ?? []); setSugestoes(j.sugestoes ?? [])
      setPainel(j.painel ?? null); setAbertas(j.abertas ?? []); setConcluidas(j.concluidas ?? [])
    }).catch(() => setOrdens(null))
  }
  useEffect(() => { setMostrar(PAGINA); carregar() }, [id, periodo, custom]) // eslint-disable-line react-hooks/exhaustive-deps

  const produzirSugestao = async (s: Sugestao) => {
    setCriando(s.fichaId)
    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId: s.fichaId, escalaReceitas: s.escalaSugerida ?? 1, dataProducao: hoje }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`
    } finally { setCriando(null) }
  }

  if (ordens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (ordens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a produção.</div>


  return (
    <div className="space-y-3 -m-4 p-4 lg:-m-6 lg:p-6" style={{ background: C.fundo, minHeight: '100%' }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Factory className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Produção</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">Cria a ordem, separa da câmara e produz — a ficha diz a receita, aqui você faz</p>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => baixarCsv(`ordens-producao-${hojeArquivo()}`,
            ['Produto', 'Quanto', 'Data', 'Setor', 'Estado'],
            ordens.map((o) => [o.nomeProduzido, `${o.escalaReceitas * o.loteBase} ${o.unidadeProduzido}`, fmtDia(o.dataProducao), o.setorNome ?? '', o.estado]))}
            disabled={ordens.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> CSV</button>
          <a href={`/empresas/${id}/estoque/cardapio`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><UtensilsCrossed className="h-3.5 w-3.5" /> Cardápio</a>
          <a href={`/empresas/${id}/estoque/producao/receitas`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><ClipboardList className="h-3.5 w-3.5" /> Receitas de produção</a>
          <button onClick={() => setNovo((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]"><Plus className="h-3.5 w-3.5" /> Nova ordem</button>
        </div>
      </div>

      {/* ⭐ 2. QUATRO CARDS clicáveis (anatomia da Contas a Pagar). Cor só onde significa:
          âmbar = dinheiro parado; verde/âmbar no rendimento = desvio. */}
      {painel && (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <CardPainel rotulo="Em aberto" valor={String(painel.emAberto)} sub="ordens andando"
            ativo={!soDeOntem} onClick={() => setSoDeOntem(false)} />
          {/* ⭐ ITEM 2: âmbar SÓ com valor > 0. Zerado = branco, "nada parado agora".
              Alarme aceso sem motivo vira paisagem — a mesma razão do B3 ser aviso. */}
          <CardPainel rotulo="Em produção"
            valor={painel.valorEmProducao > 0 ? brl(painel.valorEmProducao) : 'R$ 0,00'}
            sub={painel.valorEmProducao > 0 ? 'insumo fora da prateleira' : 'nada parado agora'}
            bg={painel.valorEmProducao > 0 ? C.ambarBg : undefined}
            tx={painel.valorEmProducao > 0 ? C.ambarTx : undefined}
            acento={painel.valorEmProducao > 0 ? C.ambarAc : undefined} />
          <CardPainel rotulo="Concluídas" valor={String(painel.concluidasNoPeriodo)}
            sub={`${brl(painel.valorProduzidoNoPeriodo)} produzidos`} />
          <CardPainel rotulo="Rendimento"
            valor={painel.rendimentoPeriodo == null ? 'a apurar' : `${Math.round(painel.rendimentoPeriodo * 100)}%`}
            sub={painel.lotesNaMedia > 0 ? `de ${painel.lotesNaMedia} ${painel.lotesNaMedia === 1 ? 'lote' : 'lotes'}` : 'nada concluído'}
            bg={painel.faixaRendimento === 'ABAIXO' ? C.ambarBg : painel.faixaRendimento === 'NORMAL' ? C.verdeBg : undefined}
            tx={painel.faixaRendimento === 'ABAIXO' ? C.ambarTx : painel.faixaRendimento === 'NORMAL' ? C.verdeTx : undefined} />
        </div>
      )}

      {/* ⭐ 3. FAIXA condicional — dinheiro que atravessou o dia sem virar produto */}
      {painel && painel.abertasDeOntem > 0 && (
        <button onClick={() => setSoDeOntem((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs"
          style={{ background: C.ambarBg, color: C.ambarTx, borderColor: C.borda }}>
          <span className="font-medium">{painel.abertasDeOntem} ordem{painel.abertasDeOntem > 1 ? 'ns' : ''} de ontem ainda em produção</span>
          <span style={{ color: C.ambarAc }}>— o insumo saiu da prateleira e não virou produto</span>
          <span className="ml-auto underline">{soDeOntem ? 'ver todas' : `ver as ${painel.abertasDeOntem}`}</span>
        </button>
      )}

      {/* ⭐ 4. CHIPS de período + busca. Período governa SÓ as concluídas. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['hoje', 'semana', 'mes'] as const).map((p) => (
          <button key={p} onClick={() => { setCustom(null); setPeriodo(p) }}
            className="h-8 rounded-full px-3 text-xs"
            style={!custom && periodo === p
              ? { background: C.primario, color: C.primarioTexto }
              : { border: `1px solid ${C.borda}`, color: C.txt2, background: C.card }}>
            {p === 'hoje' ? 'hoje' : p === 'semana' ? 'semana' : 'mês'}
          </button>
        ))}
        <button onClick={() => setAbrirCal((v) => !v)} className="h-8 rounded-full px-3 text-xs"
          style={custom
            ? { background: C.primario, color: C.primarioTexto }
            : { border: `1px solid ${C.borda}`, color: C.txt2, background: C.card }}>
          {custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : 'período…'}
        </button>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar receita…"
          className="h-8 w-[200px] rounded-lg px-2.5 text-xs" style={{ border: `1px solid ${C.borda}`, background: C.card }} />
      </div>

      {abrirCal && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl p-3" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
          <label className="text-[11px]" style={{ color: C.txt2 }}>de
            <input type="date" defaultValue={custom?.de ?? janela(periodo).de} id="pdDe"
              className="mt-1 block h-8 rounded-lg px-2 text-xs" style={{ border: `1px solid ${C.borda}` }} />
          </label>
          <label className="text-[11px]" style={{ color: C.txt2 }}>até
            <input type="date" defaultValue={custom?.ate ?? janela(periodo).ate} id="pdAte"
              className="mt-1 block h-8 rounded-lg px-2 text-xs" style={{ border: `1px solid ${C.borda}` }} />
          </label>
          <button onClick={() => {
            const de = (document.getElementById('pdDe') as HTMLInputElement)?.value
            const ate = (document.getElementById('pdAte') as HTMLInputElement)?.value
            // ⚠️ intervalo invertido não vira query: a rota devolveria vazio e pareceria
            // "não produziu nada", que é a mentira mais fácil de acreditar.
            if (!de || !ate || de > ate) return
            setCustom({ de, ate }); setAbrirCal(false)
          }} className="h-8 rounded-lg px-3 text-xs" style={{ background: C.primario, color: C.primarioTexto }}>aplicar</button>
          {custom && <button onClick={() => { setCustom(null); setAbrirCal(false) }} className="h-8 rounded-lg px-3 text-xs" style={{ border: `1px solid ${C.borda}`, color: C.txt2 }}>limpar</button>}
        </div>
      )}

      {novo && <NovaOrdem id={id} onCriada={(ordemId) => { window.location.href = `/empresas/${id}/estoque/producao/${ordemId}` }} onFechar={() => setNovo(false)} />}

      {/* sugestão de produção (min/max) */}
      {sugestoes.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><TrendingDown className="h-4 w-4" /> Sugestão de produção ({sugestoes.length})</h2>
          <div className="space-y-2">
            {sugestoes.map((s) => (
              <Card key={s.fichaId} className="border-amber-200"><CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{s.nome}</p>
                  <p className="text-xs text-slate-500">saldo {s.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {s.unidade} · abaixo do mínimo {s.estoqueMin} · faltam ~{s.faltam.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} {s.unidade}{s.rendimentoMedio == null && ' · rendimento a apurar'}</p>
                </div>
                <button onClick={() => produzirSugestao(s)} disabled={criando === s.fichaId} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">{criando === s.fichaId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />} produzir {fmtQtd(s.faltam)} {s.unidade}</button>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}

      {ordens.length === 0 && !novo ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Factory className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma ordem de produção ainda.</p>
          <p className="max-w-md text-xs text-slate-500">Crie uma ordem a partir de uma ficha (ex: 200 porções de carne). O sistema já pré-preenche a separação com os insumos e as quantidades.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* ⭐⭐ 5. ABERTAS — A REGRA CENTRAL: ordem aberta NUNCA obedece o período.
              Planejada/Separada/Em produção aparecem SEMPRE, em qualquer filtro.
              Trabalho aberto não é histórico — some do filtro e o dono perde o insumo
              parado de vista. Só a busca e o clique na faixa de ontem as filtram. */}
          <ListaAbertas id={id}
            ordens={abertas
              .filter((o) => !soDeOntem || o.deOntem)
              .filter((o) => !busca.trim() || o.nomeProduzido.toLowerCase().includes(busca.trim().toLowerCase()))} />

          {/* 6. CONCLUÍDAS — essas SIM obedecem os chips */}
          <ListaConcluidas id={id} periodo={custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : periodo}
            mostrar={mostrar} onMais={() => setMostrar((m) => m + PAGINA)}
            itens={concluidas.filter((c) => {
              if (!busca.trim()) return true
              const o = ordens.find((x) => x.id === c.ordemId)
              return (o?.nomeProduzido ?? '').toLowerCase().includes(busca.trim().toLowerCase())
            })}
            nomePorOrdem={new Map(ordens.map((o) => [o.id, o.nomeProduzido]))} />
        </>
      )}
    </div>
  )
}

type CampoO = 'produto' | 'escala' | 'data' | 'setor' | 'estado'
function Secao({ titulo, ordens, id }: { titulo: string; ordens: Ordem[]; id: string }) {
  const { col, dir, alternar, ordenar } = useSort<CampoO>('data', 'desc')
  const lista = ordenar(ordens, (o, c) => (
    c === 'produto' ? o.nomeProduzido : c === 'escala' ? o.escalaReceitas * o.loteBase : c === 'data' ? o.dataProducao
      : c === 'setor' ? (o.setorNome ?? '') : o.estado
  ))
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{titulo} ({ordens.length})</h2>
      <Card><CardContent className="p-0">
        <table className="density-normal hidden w-full sm:table">
          <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <SortableTh campo="produto" col={col} dir={dir} onSort={alternar}>Produto</SortableTh>
            <SortableTh campo="escala" col={col} dir={dir} onSort={alternar} align="right">Quanto</SortableTh>
            <SortableTh campo="data" col={col} dir={dir} onSort={alternar}>Data</SortableTh>
            <SortableTh campo="setor" col={col} dir={dir} onSort={alternar}>Setor</SortableTh>
            <SortableTh campo="estado" col={col} dir={dir} onSort={alternar}>Estado</SortableTh>
            <th className="w-10 px-3 py-2" />
          </tr></thead>
          <tbody>
            {lista.map((o) => {
              const e = ESTADO[o.estado] ?? { label: o.estado, cls: 'bg-slate-100 text-slate-600' }
              return (
                <tr key={o.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50">
                  <td className="px-3 py-0 text-[13px]"><a href={`/empresas/${id}/estoque/producao/${o.id}`} className="font-medium text-slate-800 hover:text-[#185FA5]">{o.nomeProduzido}</a></td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-500">{fmtQtd(o.escalaReceitas * o.loteBase)} {o.unidadeProduzido}</td>
                  <td className="whitespace-nowrap px-3 py-0 text-[13px] tabular-nums text-slate-500">{fmtDia(o.dataProducao)}</td>
                  <td className="px-3 py-0 text-[13px] text-slate-500">{o.setorNome ?? '—'}</td>
                  <td className="px-3 py-0"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${e.cls}`}>{e.label}</span></td>
                  <td className="px-3 py-0 text-right"><a href={`/empresas/${id}/estoque/producao/${o.id}`}><ChevronRight className="h-4 w-4 text-slate-300" /></a></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="divide-y divide-slate-50 sm:hidden">
          {lista.map((o) => {
            const e = ESTADO[o.estado] ?? { label: o.estado, cls: 'bg-slate-100 text-slate-600' }
            return (
              <a key={o.id} href={`/empresas/${id}/estoque/producao/${o.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{o.nomeProduzido}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.cls}`}>{e.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{fmtQtd(o.escalaReceitas * o.loteBase)} {o.unidadeProduzido} · {fmtDia(o.dataProducao)}{o.setorNome ? ` · ${o.setorNome}` : ''}</p>
              </a>
            )
          })}
        </div>
      </CardContent></Card>
    </div>
  )
}

function NovaOrdem({ id, onCriada, onFechar }: { id: string; onCriada: (ordemId: string) => void; onFechar: () => void }) {
  const [fichas, setFichas] = useState<FichaOpt[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [fichaId, setFichaId] = useState('')
  // ⭐ o dono pensa em UNIDADES ("faz 200 porções"); a escala é derivada na hora de gravar.
  const [quanto, setQuanto] = useState('')
  const [data, setData] = useState('')
  const [setorId, setSetorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json())
      // ⛔ SÓ RECEITA DE PRODUÇÃO. Sem isto a busca listava XIS COMPLETO e PIZZA — produto
      // de VENDA, montado na hora, que não se produz em lote. Régua compartilhada com a
      // tela de Receitas (fonte única, não uma 2ª lista de tipos aqui).
      .then((j) => setFichas((j.fichas ?? []).filter(ehReceitaDeProducao))).catch(() => {})
    fetch(`/api/empresas/${id}/estoque/setores`).then((r) => r.json()).then((j) => setSetores(j.setores ?? [])).catch(() => {})
  }, [id])

  const ficha = fichas.find((f) => f.id === fichaId) ?? null
  const rend = ficha ? { teorico: ficha.loteBase, medido: ficha.rendimentoMedio, lotes: ficha.rendimentoLotes } : null
  const regua = rend ? reguaDoRendimento(rend) : null

  const criar = async () => {
    setErro(null)
    const alvo = Number(quanto.replace(',', '.'))
    if (!fichaId || !rend) return setErro('Escolha a ficha.')
    if (!(alvo > 0)) return setErro('Diga quanto você quer produzir.')
    // a escala continua sendo o que o banco guarda — só não é mais o que se digita
    const esc = escalaParaSaida(alvo, rend)
    if (esc == null || !(esc > 0)) return setErro('Não consegui converter — confira o lote base da ficha.')
    if (!data) return setErro('Informe a data de produção.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId, escalaReceitas: esc, dataProducao: data, setorId: setorId || null }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui criar.'); return }
      onCriada(j.ordemId)
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-900">Nova ordem de produção</p><button onClick={onFechar} className="text-xs text-slate-400 hover:text-slate-600">fechar</button></div>
      {fichas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma ficha ainda — <a href={`/empresas/${id}/estoque/fichas/nova`} className="text-[#185FA5] hover:underline">crie uma ficha</a> primeiro.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[200px] text-xs text-slate-500">Ficha (o que produzir)
              <select value={fichaId} onChange={(e) => setFichaId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">escolher…</option>{fichas.map((f) => <option key={f.id} value={f.id}>{f.nomeProduzido}</option>)}</select>
            </label>
            <label className="text-xs text-slate-500">Quantas unidades quer produzir?
              <div className="mt-1 flex items-center gap-1.5">
                <input value={quanto} onChange={(e) => setQuanto(e.target.value)} inputMode="decimal" placeholder="200" className="block w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
                <span className="text-xs text-slate-400">{ficha?.unidadeProduzido ?? ''}</span>
              </div>
              {regua && (
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  {regua.daMedia ? `pela sua média de ${regua.lotes} lotes` : 'pelo teórico da ficha · sua média: a apurar'}
                </span>
              )}
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">Data de produção
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" />
            </label>
            <label className="text-xs text-slate-500">Setor
              <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">—</option>{setores.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
            </label>
            <a href={`/empresas/${id}/estoque/producao/cadastros`} className="inline-flex items-center gap-1 pb-2 text-[11px] text-slate-400 hover:text-slate-600"><Settings className="h-3 w-3" /> setores</a>
          </div>
          {erro && <p className="text-xs text-rose-600">{erro}</p>}
          <button onClick={criar} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar ordem</button>
        </>
      )}
    </CardContent></Card>
  )
}

/** Card do painel. Flat, cantos 12px, cor só quando significa. */
function CardPainel({ rotulo, valor, sub, bg, tx, acento, ativo, onClick }: {
  rotulo: string; valor: string; sub?: string; bg?: string; tx?: string; acento?: string
  ativo?: boolean; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`rounded-xl px-3.5 py-3 text-left ${onClick ? 'transition-colors hover:brightness-[0.99]' : ''}`}
      style={{ background: bg ?? C.card, border: `1px solid ${ativo === false ? C.borda : C.borda}` }}>
      <p className={T.cardRot} style={{ color: tx ? acento ?? tx : C.txt2, fontWeight: 500 }}>{rotulo}</p>
      <p className={`mt-0.5 ${T.cardNum} tabular-nums`} style={{ color: tx ?? C.nomeTx, fontWeight: 500 }}>{valor}</p>
      {sub && <p className="mt-0.5 text-[12px]" style={{ color: tx ? acento ?? tx : C.txt3 }}>{sub}</p>}
    </Tag>
  )
}

/** ⭐ ABERTAS — sempre visíveis, com a previsão de saída e a etiqueta coral de ontem. */
function ListaAbertas({ id, ordens }: { id: string; ordens: Aberta[] }) {
  if (!ordens.length) return null
  return (
    <section>
      <h2 className={`mb-1.5 ${T.titulo}`} style={{ color: C.tituloTx, fontWeight: 500 }}>Abertas ({ordens.length})</h2>
      <div className="overflow-hidden rounded-xl" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
        {ordens.map((o, i) => {
          const p = PILL[o.estado] ?? PILL.PLANEJADA
          return (
            <a key={o.id} href={`/empresas/${id}/estoque/producao/${o.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 hover:bg-black/[0.02]"
              style={i > 0 ? { borderTop: `1px solid ${C.borda}` } : undefined}>
              <span className={`rounded-xl px-2 py-0.5 ${T.pill}`} style={{ background: p.bg, color: p.tx, fontWeight: 500 }}>
                {ESTADO[o.estado]?.label ?? o.estado}
              </span>
              <span className={`min-w-0 flex-1 truncate ${T.nome}`} style={{ color: C.nomeTx, fontWeight: 500 }}>{o.nomeProduzido}</span>
              <span className={`${T.qtd} tabular-nums`} style={{ color: C.qtdTx }}>
                ~{fmtQtd(o.escalaReceitas * o.loteBase)} {o.unidadeProduzido} esperadas
              </span>
              {o.deOntem && (
                <span className={`rounded-xl px-2 py-0.5 ${T.pill}`} style={{ background: C.coralBg, color: C.coralTx }}>
                  desde ontem {fmtDia(o.dataProducao)}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.txt3 }} />
            </a>
          )
        })}
      </div>
    </section>
  )
}

/** CONCLUÍDAS do período — % do rendimento colorido pelas faixas do avaliarVariacao. */
function ListaConcluidas({ id, itens, periodo, nomePorOrdem, mostrar, onMais }: {
  id: string; itens: Conclusao[]; periodo: string; nomePorOrdem: Map<string, string>
  mostrar: number; onMais: () => void
}) {
  const rotulo = periodo === 'hoje' ? 'hoje' : periodo === 'semana' ? 'últimos 7 dias' : periodo === 'mes' ? 'últimos 30 dias' : periodo
  // ⚠️ PAGINAÇÃO: período grande não pode travar a tela. E o "carregar mais" DIZ quantos
  // faltam — botão que só some quando acaba deixa a pessoa sem saber se viu tudo.
  const visiveis = itens.slice(0, mostrar)
  const faltam = itens.length - visiveis.length
  return (
    <section>
      <h2 className={`mb-1.5 ${T.titulo}`} style={{ color: C.tituloTx, fontWeight: 500 }}>Concluídas · {rotulo} ({itens.length})</h2>
      {itens.length === 0 ? (
        <div className="rounded-xl px-3.5 py-6 text-center text-xs" style={{ background: C.card, border: `1px solid ${C.borda}`, color: C.txt3 }}>
          Nada concluído {rotulo}. As ordens abertas continuam acima.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
          {visiveis.map((c, i) => (
            <a key={c.id} href={`/empresas/${id}/estoque/producao/${c.ordemId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 hover:bg-black/[0.02]"
              style={i > 0 ? { borderTop: `1px solid ${C.borda}` } : undefined}>
              <span className={`rounded-xl px-2 py-0.5 ${T.pill}`} style={{ background: C.verdeBg, color: C.verdeTx, fontWeight: 500 }}>Concluída</span>
              {/* ⭐ peso 500 escuro SÓ aqui e no custo — as duas coisas da regra */}
              <span className={`min-w-0 flex-1 truncate ${T.nome}`} style={{ color: C.nomeTx, fontWeight: 500 }}>{nomePorOrdem.get(c.ordemId) ?? '—'}</span>
              <span className={`${T.qtd} tabular-nums`} style={{ color: C.qtdTx }}>{fmtQtd(c.qtdGerada)} un</span>
              <span className={`${T.custo} tabular-nums`} style={{ color: C.nomeTx, fontWeight: 500 }}>{brl(c.custoUnitarioReal)}/un</span>
              {/* ⭐ ITEM 3: o selo de % por linha — faixas do `avaliarVariacao`, a MESMA
                  régua do card e do aviso que o operador viu ao concluir. */}
              {c.pct != null && c.faixa !== 'SEM_REGUA' && (
                <span className={`rounded-xl px-2 py-0.5 ${T.pill} tabular-nums`} style={
                  c.faixa === 'ABAIXO' ? { background: C.ambarBg, color: C.ambarTx }
                    : c.faixa === 'ACIMA' ? { background: C.azulBg, color: C.azulTx }
                      : { background: C.verdeBg, color: C.verdeTx }}>
                  {Math.round(c.pct * 100)}%
                </span>
              )}
              {c.motivo && <span className={`${T.quem} italic`} style={{ color: C.txt3 }}>{c.motivo}</span>}
              {c.colaboradorNome && <span className={T.quem} style={{ color: C.txt3 }}>{c.colaboradorNome}</span>}
              <span className={`${T.hora} tabular-nums`} style={{ color: C.txt2 }}>{hhmm(c.criadoEm)}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.txt3 }} />
            </a>
          ))}
          {faltam > 0 && (
            <button onClick={onMais} className="w-full py-2.5 text-xs hover:bg-black/[0.02]"
              style={{ borderTop: `1px solid ${C.borda}`, color: C.txt2 }}>
              carregar mais ({faltam} restante{faltam > 1 ? 's' : ''})
            </button>
          )}
        </div>
      )}
    </section>
  )
}
