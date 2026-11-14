'use client'

// ⭐⭐⭐ PAINEL DE PRODUÇÃO DO ESCRITÓRIO — lei v9 M7 (docs/producao-referencia.html, "Produção —
// referência v9 APROVADA", 13/11/2026). Ordem EXATA da tela: título → chips → 4 KPIs → filtros
// → ZONA DE CRIAR (Nova ordem | Nova tarefa) → Conferência do dia → Em aberto → Concluídas.
//
// ⛔ MESMOS gestos e endpoints de antes — zero função nova. O que mudou é a cara:
//  · o subtítulo serifado MORREU (M7.b, dono 13/11: "texto largado sem motivo");
//  · o "+ Nova ordem" do topo MORREU: criar é pela zona de criar, UM caminho só (M7.g);
//  · a Sugestão de produção SAIU do painel (M7.f) — o chip "Receitas" leva à tela própria;
//  · TAREFA tem linha própria (M7.e): selo + nome + instrução + quem + duração — NUNCA R$/un,
//    % do pedido, "UN pedidas" nem Conferência (`lib/stock/producao/linha-da-tarefa.ts`).
// ⭐ A tela usa a ÁREA ÚTIL do app (sem teto de largura herdado do mock) e a grade vira 2ª linha
// com rótulo no celular (S18). O CSS é o da lei, com os hex trocados pelos tokens `--prod-*`.

import { CHIPS_DA_PRODUCAO } from '@/components/estoque/producao-telas'
import { useEffect, useState, use } from 'react'
import { Loader2 } from 'lucide-react'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { formatBRL } from '@/lib/format/money'
import { ConferenciaDoDia } from '@/components/estoque/conferencia-do-dia'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import { NovaTarefa } from '@/components/estoque/tarefas-do-dia'
import { rotuloDasConcluidas } from '@/lib/stock/producao/rotulos-do-painel'
import { tarefasDoPainel, type LinhaDaTarefa } from '@/lib/stock/producao/linha-da-tarefa'
import { ListaAbertas, ListaConcluidas, ListaTarefasConcluidas, type Aberta, type Contexto, type PedidoFeito, type Conclusao } from '@/components/estoque/listas-do-painel'
import type { TarefaDoEscritorio } from '@/lib/stock/producao/tarefa'
/**
 * ⭐⭐ O PEDIDO NA TELA e a pílula "% do pedido" têm DONO ÚNICO (05/10) — a tela não arredonda
 * nem divide por conta própria. Quatro telas mostram pedido; quatro `Math.round` divergiriam.
 */
import { fmtPedido } from '@/lib/stock/producao/pedido-na-tela'
import type { OrigemDoPedido } from '@/lib/stock/producao/pedido-da-ordem'
import { ehReceitaDeProducao } from '@/lib/stock/producao/tipo-receita'

interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; loteBase: number; estado: string; dataProducao: string; setorNome: string | null }
interface FichaOpt { id: string; nomeProduzido: string; unidadeProduzido: string; loteBase: number; unidadeLoteBase: string; rendimentoMedio: number | null; rendimentoLotes: number; tipoProduto: string }
interface Setor { id: string; nome: string; ativo: boolean }
interface Painel { emAberto: number; valorEmProducao: number; concluidasNoPeriodo: number; valorProduzidoNoPeriodo: number; rendimentoPeriodo: number | null; lotesNaMedia: number; faixaRendimento: string; abertasDeOntem: number }

const PAGINA = 25
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export default function ProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  /** ⚠️ REGRA 9 — hook NO TOPO: a tela tem early-returns, e hook depois deles derruba o cliente. */
  const { pode: podePerm, carregando: carregandoPerm } = usePermissoes(id)
  const [ordens, setOrdens] = useState<Ordem[] | null | undefined>(undefined)
  /**
   * ⭐ 22/09 — `?ficha=` chega na Nova ordem COM a ficha escolhida (a porta que a recusa do item
   * negativo oferece). ⭐ v9: o cartão é FIXO na zona de criar, então ele já está aberto — o
   * `fichaInicial` só pré-escolhe a receita. Lido no 1º render (sem piscar).
   */
  const fichaDaUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ficha') : null
  const [painel, setPainel] = useState<Painel | null>(null)
  const [abertas, setAbertas] = useState<Aberta[]>([])
  const [concluidas, setConcluidas] = useState<Conclusao[]>([])
  const [contexto, setContexto] = useState<Record<string, Contexto>>({})
  const [pedidoFeito, setPedidoFeito] = useState<Record<string, PedidoFeito>>({})
  /** ⭐ O PEDIDO RESOLVIDO de cada ordem da lista — vem do SERVIDOR, pelo dono único (11/10). */
  const [pedidoDasOrdens, setPedidoDasOrdens] = useState<Record<string, { pedido: number | null; origem: OrigemDoPedido | null }>>({})
  /** ⭐⭐ A RECEITA DAS CONCLUÍDAS vem resolvida POR ID (05/10) — o `ordens` é truncado. */
  const [receitaConcl, setReceitaConcl] = useState<Record<string, { nome: string; unidade: string }>>({})
  /** ⭐ (lei v9 M7.e) as tarefas do escritório: vivas + encerradas no período, pela rota de sempre */
  const [tarefas, setTarefas] = useState<TarefaDoEscritorio[]>([])
  const [nomesDeTarefa, setNomesDeTarefa] = useState<string[]>([])
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [erroTarefa, setErroTarefa] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje')
  const [busca, setBusca] = useState('')
  const [soDeOntem, setSoDeOntem] = useState(false)
  // ⭐ período livre + paginação são a MESMA feature (decisão do dono)
  const [custom, setCustom] = useState<{ de: string; ate: string } | null>(null)
  const [abrirCal, setAbrirCal] = useState(false)
  const [mostrar, setMostrar] = useState(PAGINA)

  // ⚠️⚠️ O DIA É O DE SÃO PAULO, NUNCA `toISOString()` (UTC): das 21h à meia-noite "hoje" abria vazio.
  const janela = (p: typeof periodo) => {
    if (custom) return custom
    const hoje = diaEmSaoPaulo()
    const dias = p === 'semana' ? -6 : p === 'mes' ? -29 : 0
    return { de: somarDias(hoje, dias), ate: hoje }
  }
  const carregarTarefas = () => {
    const { de, ate } = janela(periodo)
    return fetch(`/api/empresas/${id}/estoque/producao/tarefas?de=${de}&ate=${ate}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setTarefas(j.tarefas ?? []); setNomesDeTarefa(j.nomes ?? []) } })
      .catch(() => {})
  }
  const carregar = () => {
    const { de, ate } = janela(periodo)
    void carregarTarefas()
    return fetch(`/api/empresas/${id}/estoque/producao/ordens?de=${de}&ate=${ate}`).then((r) => r.json()).then((j) => {
      setOrdens(j.ordens ?? [])
      setPainel(j.painel ?? null); setAbertas(j.abertas ?? []); setConcluidas(j.concluidas ?? [])
      setContexto(j.contexto ?? {}); setPedidoFeito(j.pedidoDasConcluidas ?? {})
      setReceitaConcl(j.receitaDasConcluidas ?? {}); setPedidoDasOrdens(j.pedidoDasOrdens ?? {})
    }).catch(() => setOrdens(null))
  }
  useEffect(() => { setMostrar(PAGINA); carregar() }, [id, periodo, custom]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ⭐ o "cancelar" da tarefa — o MESMO gesto e a MESMA rota do cartão antigo, agora na linha aberta */
  const cancelarTarefa = async (t: LinhaDaTarefa) => {
    setCancelando(t.tarefaId); setErroTarefa(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/tarefas/${t.tarefaId}/cancelar`, { method: 'POST' })
      const j = await r.json().catch(() => null)
      if (!r.ok) setErroTarefa(j?.erro ?? 'Não consegui cancelar.')
      await carregarTarefas()
    } finally { setCancelando(null) }
  }

  if (ordens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (ordens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a produção.</div>

  const termo = busca.trim().toLowerCase()
  const casa = (nome: string) => !termo || nome.toLowerCase().includes(termo)
  const tp = tarefasDoPainel(tarefas, new Date())
  const podeOperar = !carregandoPerm && podePerm('stock.operate')

  return (
    <div data-tela="producao-home" className="pp -m-4 p-4 lg:-m-6 lg:p-6">
      <style>{CSS}</style>

      {/* ⭐ 1. TOPO — só o título. ⛔ Nada escrito solto embaixo; nenhum botão de criar aqui. */}
      <div className="pp-topo"><h1 className="pp-h1">Produção</h1></div>

      {/* ⭐ 2. CHIPS — os 5 da lei R1 (13/11): Painel · Ao vivo · Desempenho · Receitas · Equipe. Nenhum aceso
          aqui (quem diz onde estou é o título, lei v9); o CSV é ferramenta: tracejado. */}
      <div className="pp-chips">
        {CHIPS_DA_PRODUCAO.map((c) => (
          <a key={c.aba} className="pp-chip" href={`/empresas/${id}/estoque/producao${c.caminho}`}>{c.rotulo}</a>
        ))}
        <button type="button" className="pp-chip mut" disabled={ordens.length === 0}
          onClick={() => baixarCsv(`ordens-producao-${hojeArquivo()}`,
            ['Produto', 'Quanto', 'Data', 'Setor', 'Estado'],
            /** ⚠️ o CSV LÊ O MESMO PEDIDO RESOLVIDO da tela (11/10) */
            ordens.map((o) => {
              const p = pedidoDasOrdens[o.id]
              const t = p?.origem === 'AGUARDANDO' || p?.pedido == null ? null : fmtPedido(p.pedido, o.unidadeProduzido)
              return [o.nomeProduzido, t == null ? 'a definir' : `${t} ${o.unidadeProduzido}`, fmtDia(o.dataProducao), o.setorNome ?? '', o.estado]
            }))}>CSV</button>
      </div>

      {/**
        * ⭐⭐ 3. OS 4 KPIs (M7.c) — rótulo caps, número grande tabular, apoio curto.
        * ⛔ Zero conta nova: todo número vem do `painel` do servidor. A tela escolhe a COR, nunca o valor.
        * ⭐ RENDIMENTO: a cor segue a régua do P8 (verde ≥90, âmbar 70-90, coral <70); `null` é "a apurar", sem cor.
        */}
      {painel && (
        <div className="pp-kpis">
          <div className="pp-kpi"><span className="r">em aberto</span><b>{painel.emAberto}</b><span className="s">ordens andando</span></div>
          <div className="pp-kpi"><span className="r">na bancada</span><b>{formatBRL(painel.valorEmProducao)}</b>
            <span className="s">{painel.valorEmProducao > 0 ? 'insumo fora da prateleira' : 'nada parado agora'}</span></div>
          <div className="pp-kpi"><span className="r">{rotuloDasConcluidas(periodo, custom)}</span><b>{painel.concluidasNoPeriodo}</b>
            <span className="s">{formatBRL(painel.valorProduzidoNoPeriodo)} produzidos</span></div>
          <div className="pp-kpi"><span className="r">rendimento do dia</span>
            <b className={painel.rendimentoPeriodo == null ? 'mudo' : painel.rendimentoPeriodo >= 0.9 ? 'ok' : painel.rendimentoPeriodo >= 0.7 ? 'atencao' : 'ruim'}>
              {painel.rendimentoPeriodo == null ? 'a apurar' : `${Math.round(painel.rendimentoPeriodo * 100)}%`}</b>
            <span className="s">{painel.lotesNaMedia > 0 ? `de ${painel.lotesNaMedia} ${painel.lotesNaMedia === 1 ? 'lote' : 'lotes'}` : 'nada concluído'}</span></div>
        </div>
      )}

      {/* ⭐ FILTROS — período governa SÓ as concluídas (trabalho aberto não é histórico) */}
      <div className="pp-filtros">
        {(['hoje', 'semana', 'mes'] as const).map((p) => (
          <button key={p} type="button" className={`pp-f${!custom && periodo === p ? ' on' : ''}`}
            onClick={() => { setCustom(null); setPeriodo(p) }}>{p === 'mes' ? 'mês' : p}</button>
        ))}
        <button type="button" className={`pp-f${custom ? ' on' : ''}`} onClick={() => setAbrirCal((v) => !v)}>
          {custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : 'período…'}
        </button>
        <input className="pp-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar receita…" aria-label="buscar receita" />
      </div>

      {abrirCal && (
        <div className="pp-painel pp-cria">
          <label className="pp-rot">de<input type="date" defaultValue={custom?.de ?? janela(periodo).de} id="pdDe" /></label>
          <label className="pp-rot">até<input type="date" defaultValue={custom?.ate ?? janela(periodo).ate} id="pdAte" /></label>
          <button type="button" className="bt" onClick={() => {
            const de = (document.getElementById('pdDe') as HTMLInputElement)?.value
            const ate = (document.getElementById('pdAte') as HTMLInputElement)?.value
            // ⚠️ intervalo invertido não vira query: vazio pareceria "não produziu nada"
            if (!de || !ate || de > ate) return
            setCustom({ de, ate }); setAbrirCal(false)
          }}>aplicar</button>
          {custom && <button type="button" className="pp-f" onClick={() => { setCustom(null); setAbrirCal(false) }}>limpar</button>}
        </div>
      )}

      {/**
        * ⭐⭐ 4. ZONA DE CRIAR (M7.g) — os DOIS cartões FIXOS lado a lado (empilham no celular).
        * ⛔ NENHUM outro botão de criar na tela inteira: nada oculto, nada repetido.
        */}
      {podeOperar && (
        <div className="pp-zcriar" data-testid="zona-de-criar">
          <NovaOrdem id={id} fichaInicial={fichaDaUrl} onCriada={(ordemId) => { window.location.href = `/empresas/${id}/estoque/producao/${ordemId}` }} />
          <NovaTarefa id={id} podeLiberar={podePerm('stock.manage')} nomes={nomesDeTarefa} onCriada={() => void carregarTarefas()} />
        </div>
      )}

      {/* ⭐⭐⭐ 5. CONFERÊNCIA DO DIA — só pra gerência (o gate é do PAYLOAD). ⛔ TAREFA nunca entra aqui. */}
      <ConferenciaDoDia id={id} podeGerenciar={podePerm('stock.manage')} carregandoPerm={carregandoPerm}
        onMudou={() => void carregar()} />

      {/* ⭐⭐ 6. EM ABERTO — ordem aberta NUNCA obedece o período; só a busca e o "desde ontem" filtram. */}
      <ListaAbertas id={id} ctx={contexto}
        deOntem={painel?.abertasDeOntem ?? 0}
        soDeOntem={soDeOntem}
        onFiltrarOntem={() => setSoDeOntem((v) => !v)}
        ordens={abertas.filter((o) => !soDeOntem || o.deOntem).filter((o) => casa(o.nomeProduzido))}
        tarefas={soDeOntem ? [] : tp.abertas.filter((t) => casa(t.nome))}
        podeCancelar={podeOperar} cancelando={cancelando} onCancelar={cancelarTarefa} erroTarefa={erroTarefa} />

      {/* 7. CONCLUÍDAS — essas SIM obedecem os filtros */}
      <ListaConcluidas id={id} periodo={custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : periodo}
        mostrar={mostrar} onMais={() => setMostrar((m) => m + PAGINA)}
        itens={concluidas.filter((c) => casa((receitaConcl[c.ordemId]?.nome ?? ordens.find((x) => x.id === c.ordemId)?.nomeProduzido) ?? ''))}
        /* ⭐ as duas fontes MESCLADAS: a lista geral (truncada) + a receita resolvida por
           ID do período. A segunda manda, porque ela nunca depende do teto. */
        nomePorOrdem={new Map([
          ...ordens.map((o) => [o.id, o.nomeProduzido] as [string, string]),
          ...Object.entries(receitaConcl).map(([id, r]) => [id, r.nome] as [string, string]),
        ])}
        unidadePorOrdem={new Map([
          ...ordens.map((o) => [o.id, o.unidadeProduzido] as [string, string]),
          ...Object.entries(receitaConcl).map(([id, r]) => [id, r.unidade] as [string, string]),
        ])}
        pedidoFeito={pedidoFeito} />

      {/* 8. TAREFAS CONCLUÍDAS — bloco PRÓPRIO logo abaixo dos lotes (emenda do dono 13/11); só com tarefa no período */}
      <ListaTarefasConcluidas periodo={custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : periodo}
        tarefas={tp.concluidas.filter((t) => casa(t.nome))} />
    </div>
  )
}

/**
 * ⭐⭐ NOVA ORDEM DE PRODUÇÃO — cartão FIXO da zona de criar (v9). Ficha + data + setor + "Criar
 * ordem →". ⛔⛔ A QUANTIDADE NÃO É PERGUNTADA AQUI (G9, 11/10): a pergunta é UMA, na página da
 * Ordem, onde dá pra ver a prateleira. O corpo do POST não manda quantidade (a rota é `.strict()`).
 */
function NovaOrdem({ id, fichaInicial, onCriada }: { id: string; fichaInicial?: string | null; onCriada: (ordemId: string) => void }) {
  const [fichas, setFichas] = useState<FichaOpt[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [fichaId, setFichaId] = useState(fichaInicial ?? '')
  const [data, setData] = useState(() => diaEmSaoPaulo())
  const [setorId, setSetorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json())
      // ⛔ SÓ RECEITA DE PRODUÇÃO — produto de VENDA não se produz em lote (régua única com a tela de Receitas)
      .then((j) => setFichas((j.fichas ?? []).filter(ehReceitaDeProducao))).catch(() => {})
    fetch(`/api/empresas/${id}/estoque/setores`).then((r) => r.json()).then((j) => setSetores(j.setores ?? [])).catch(() => {})
  }, [id])

  const criar = async () => {
    setErro(null)
    if (!fichaId || !fichas.some((f) => f.id === fichaId)) return setErro('Escolha a ficha.')
    if (!data) return setErro('Informe a data de produção.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichaId, dataProducao: data, setorId: setorId || null }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui criar.'); return }
      onCriada(j.ordemId)
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    <div className="pp-painel pp-zc" data-testid="nova-ordem">
      <h3>Nova ordem de produção</h3>
      <div className="pp-cria">
        <select value={fichaId} onChange={(e) => setFichaId(e.target.value)} aria-label="ficha (o que produzir)" className="longo">
          <option value="">{fichas.length ? 'escolher a ficha…' : 'nenhuma ficha ainda'}</option>
          {fichas.map((f) => <option key={f.id} value={f.id}>{f.nomeProduzido}</option>)}
        </select>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="data de produção" />
        <select value={setorId} onChange={(e) => setSetorId(e.target.value)} aria-label="setor">
          <option value="">Setor: —</option>
          {setores.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <button type="button" onClick={criar} disabled={busy} className="bt">{busy ? 'Criando…' : 'Criar ordem →'}</button>
      </div>
      {erro && <span className="pp-pill coral pp-msg">{erro}</span>}
    </div>
  )
}

/**
 * ⭐⭐ O CSS DA LEI v9 (bloco "M7 · Painel do escritório"), 1:1 nas medidas e grades, com os hex do
 * mock trocados pelos tokens da casa (`--prod-*`/`--fam-*` — claro e escuro de graça).
 * ⛔ Sem `max-width`: a tela ocupa a área útil do app (a lição das outras telas).
 */
const CSS = `
.pp{--card:var(--prod-surface);--linha:var(--prod-line-strong);--linha-fina:var(--prod-line);
  --t1:var(--prod-primary);--t2:var(--prod-secondary);--t3:var(--prod-muted);
  --indigo:var(--prod-acao-bg);--indigo-on:var(--prod-acao-ink);--verde:var(--prod-verde);
  background:var(--prod-bg);color:var(--t1);min-height:100%}
.pp-topo{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.pp-h1{font-size:21px;font-weight:800;letter-spacing:-.02em;margin:0}
.pp-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.pp-chip{font-size:12px;font-weight:700;border:1px solid var(--linha);background:var(--card);
  color:var(--t2);border-radius:999px;padding:7px 13px;cursor:pointer;text-decoration:none;font-family:inherit}
.pp-chip.mut{border-style:dashed;color:var(--t3)}
.pp-chip:disabled{opacity:.45;cursor:default}
.pp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.pp-kpi{background:var(--card);border:1px solid var(--linha);border-radius:14px;padding:12px 14px}
.pp-kpi .r{display:block;font-size:10px;font-weight:800;letter-spacing:.07em;color:var(--t3);text-transform:uppercase}
.pp-kpi b{display:block;font-size:23px;font-weight:800;letter-spacing:-.02em;margin-top:3px;font-variant-numeric:tabular-nums}
.pp-kpi b.ok{color:var(--fam-verde-ink)}
.pp-kpi b.atencao{color:var(--fam-ambar-ink)}
.pp-kpi b.ruim{color:var(--fam-coral-ink)}
.pp-kpi b.mudo{color:var(--t3)}
.pp-kpi .s{display:block;font-size:11.5px;color:var(--t3);margin-top:2px}
.pp-filtros{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.pp-f{font-size:12px;font-weight:700;border:1px solid var(--linha);background:var(--card);
  color:var(--t2);border-radius:999px;padding:7px 14px;cursor:pointer;font-family:inherit}
.pp-f.on{background:var(--indigo);border-color:var(--indigo);color:var(--indigo-on)}
.pp-busca{flex:1 1 170px;min-height:36px;border:1px solid var(--linha);border-radius:999px;
  background:var(--card);color:var(--t1);font-size:12.5px;font-weight:600;padding:0 14px;font-family:inherit}
.pp-zcriar{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
@media(max-width:760px){ .pp-zcriar{grid-template-columns:1fr} }
.pp-painel{background:var(--card);border:1px solid var(--linha);border-radius:14px;padding:14px;margin-bottom:12px}
.pp-painel.pp-zc{margin-bottom:0}
.pp-painel h3{font-size:13.5px;font-weight:800;margin:0 0 10px}
.pp-cria{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pp-cria input,.pp-cria select{min-height:42px;border:1px solid var(--linha);border-radius:10px;background:var(--card);
  color:var(--t1);font-size:13px;font-weight:700;font-family:inherit;padding:0 11px;min-width:0}
.pp-cria select{font-size:12.5px;padding:0 8px}
.pp-cria .longo{flex:1 1 200px}.pp-cria .medio{width:140px}
.pp-rot{font-size:11px;font-weight:800;color:var(--t3);display:flex;flex-direction:column;gap:3px}
.pp .bt{min-height:42px;border:0;border-radius:10px;background:var(--indigo);color:var(--indigo-on);
  font-size:13px;font-weight:800;cursor:pointer;padding:0 15px;font-family:inherit}
.pp .bt.verde2{background:var(--fam-verde-solid);color:var(--fam-verde-on)}
.pp .bt:disabled{opacity:.5;cursor:default}
.pp-msg{display:inline-block;margin-top:9px;white-space:normal;font-size:12.5px;padding:6px 12px}
.pp-pill{font-size:10.5px;font-weight:800;border-radius:999px;padding:3px 10px;white-space:nowrap}
.pp-pill.verde{background:var(--fam-verde-bg);color:var(--fam-verde-ink)}
.pp-pill.ambar{background:var(--fam-ambar-bg);color:var(--fam-ambar-ink)}
.pp-pill.coral{background:var(--fam-coral-bg);color:var(--fam-coral-ink)}
.pp-pill.mut2{background:var(--prod-bg);color:var(--t3);border:1px solid var(--linha)}
.pp-btn-selo{cursor:pointer;font-family:inherit}
.pp-i{width:17px;height:17px;border-radius:50%;border:1px solid var(--linha);background:var(--card);color:var(--t3);
  font-size:11px;font-weight:700;cursor:pointer;vertical-align:2px;margin-left:6px;line-height:1;padding:0}
.pp-pop{display:block;font-size:11.5px;color:var(--t2);background:var(--card);border:1px solid var(--linha);
  border-radius:10px;padding:8px 11px;margin:8px 0 2px;line-height:1.6;font-weight:500}
.pp-head{display:grid;gap:10px;font-size:9.5px;font-weight:800;letter-spacing:.07em;
  color:var(--t3);text-transform:uppercase;padding:0 0 6px;border-bottom:2px solid var(--linha)}
.pp-head.c4{grid-template-columns:1fr 92px 112px 84px}
.pp-head.d4{grid-template-columns:1fr 86px 130px 150px}
.pp-head.d2,.pp-row.d2{grid-template-columns:1fr 110px}
.pp-inst{font-weight:700;color:var(--t2)}
.pp-head .r{text-align:right}
.pp-row{display:grid;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--linha-fina);color:inherit;text-decoration:none}
.pp-row:last-child{border-bottom:0}
.pp-bloco>.pp-row{border-bottom:1px solid var(--linha-fina)}
.pp-bloco:last-child>.pp-row{border-bottom:0}
a.pp-row:hover{background:var(--prod-surface-1)}
.pp-row.c4{grid-template-columns:1fr 92px 112px 84px}
.pp-row.d4{grid-template-columns:1fr 86px 130px 150px}
.pp-row.e3{grid-template-columns:8px 1fr auto;padding-left:0}
.pp-row.e3::before{content:'';width:4px;height:30px;border-radius:4px;background:var(--linha)}
.pp-row.e3.fz::before{background:var(--indigo)}
.pp-row.e3.at::before{background:var(--fam-coral-mid)}
.pp-nm{font-weight:700;font-size:13.5px;line-height:1.3;min-width:0}
.pp-sub2{display:block;font-size:11.5px;font-weight:600;color:var(--t3);margin-top:1px;font-variant-numeric:tabular-nums}
.pp-sub2.at{color:var(--fam-coral-ink)}
.pp-num{font-weight:800;font-size:14px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pp-num i{font-style:normal;font-weight:700;font-size:11.5px;color:var(--t3)}
.pp-vered,.pp-conf{text-align:right}
.pp-selo-l{margin-left:6px}
.pp-acoes{display:flex;gap:6px;justify-content:flex-end}
.pp-ok{width:38px;height:38px;border-radius:10px;border:0;background:var(--indigo);color:var(--indigo-on);font-size:15px;font-weight:800;cursor:pointer}
.pp-ok:disabled{opacity:.4}
.pp-ed{width:38px;height:38px;border-radius:10px;border:1px solid var(--linha);background:var(--card);color:var(--t2);font-size:14px;cursor:pointer}
.selo-t{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.06em;background:var(--prod-bg);border:1px solid var(--linha);
  color:var(--t3);border-radius:999px;padding:2px 8px;margin-right:7px;vertical-align:2px}
.pp-fiscal{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--fam-coral-mid);margin-right:6px;vertical-align:1px}
.pp-cancelar{display:block;margin-left:auto;margin-top:2px;font-size:11.5px;font-weight:600;color:var(--t3);background:none;border:0;
  text-decoration:underline;text-underline-offset:2px;cursor:pointer;padding:0;font-family:inherit}
.pp-cancelar:disabled{opacity:.5}
.pp-vazio{display:block;font-size:12.5px;color:var(--t3);padding:8px 0}
.pp-mais{width:100%;padding:10px 0 0;font-size:12.5px;font-weight:700;color:var(--t2);background:none;border:0;
  border-top:1px solid var(--linha-fina);cursor:pointer;font-family:inherit}
@media(max-width:640px){
  .pp-head.c4,.pp-head.d4{display:none}
  .pp-row.c4{grid-template-columns:1fr auto auto;row-gap:6px}
  .pp-row.d4{grid-template-columns:1fr 1fr;row-gap:6px}
  .pp-row.c4 .pp-nm,.pp-row.d4 .pp-nm,.pp-row.d4 .pp-conf{grid-column:1/-1}
  .pp-row [data-r]{text-align:left}
  .pp-row.tar .vazio{display:none}
  .pp-row [data-r]::before{content:attr(data-r);display:block;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--t3);text-transform:uppercase;margin-bottom:1px}
}
`
