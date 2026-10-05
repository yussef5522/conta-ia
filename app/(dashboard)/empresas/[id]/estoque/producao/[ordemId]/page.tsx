'use client'

// ESTOQUE FASE 2 item 2.1 — detalhe da ORDEM: stepper + SEPARAÇÃO pré-preenchida da ficha.
// O dono ajusta o que REALMENTE tirou da câmara → confirma → SEPARACAO_SAIDA (vai pro armazém
// virtual em-produção). Sobra volta (devolver). Conclusão "quantos saíram?" é 2.2.

import { useEffect, useMemo, useState, use } from 'react'
import { escalaDoConsumo, preverSaida, eficienciaMedia, avaliarVariacao } from '@/lib/stock/producao/previsao-rendimento'
import { insumoDoPedido } from '@/lib/stock/producao/escala-da-ordem'
import { eficienciaDaOrdem, fraseDoFiscal } from '@/lib/stock/producao/eficiencia-da-ordem'
import { fraseDoCiclo } from '@/lib/stock/producao/pedido-da-ordem'
import { formatarQtd } from '@/lib/stock/quantidade'
import { Card, CardContent } from '@/components/ui/card'
import { EtapasDaOrdem } from '@/components/estoque/etapas-da-ordem'
import { ArrowLeft, Loader2, Factory, Printer, AlertTriangle, Check, Undo2, X, Tag, TrendingUp } from 'lucide-react'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { avisoDeEtapasAbertas } from '@/lib/stock/producao/aviso-etapas-abertas'

interface Linha { itemId: string; nome: string; unidade: string; unidadeControle: string; porLote: number; qtdPlanejada: number; qtdSeparada: number; qtdConsumida: number; saldoDisponivel: number; custoMedio: number | null; fichaIdComponente: string | null }
interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; loteBase: number; estado: string; dataProducao: string; setorNome: string | null; versaoFicha: number; fichaId: string }
interface Conclusao { id: string; qtdGerada: number; colaboradorNome: string | null; rendimento: number; custoLoteReal: number; custoUnitarioReal: number | null; validadeAte: string | null; parcial: boolean; criadoEm: string }
interface Colaborador { id: string; nome: string }
interface EtapaAbertaNaTela { nome: string; executorNome: string | null }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
// ⭐ dose pequena em KG/LT sai na unidade natural ("0,3 g", não "0,0003 KG") — o padeiro
// lê grama. Dono único em lib/stock/quantidade: quatro formatações divergiriam.
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const PASSOS = ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO', 'CONCLUIDA']
const PASSO_LABEL: Record<string, string> = { PLANEJADA: 'Planejada', SEPARADA: 'Separada', EM_PRODUCAO: 'Em produção', CONCLUIDA: 'Concluída' }

export default function OrdemDetalhePage({ params }: { params: Promise<{ id: string; ordemId: string }> }) {
  const { id, ordemId } = use(params)
  const [ordem, setOrdem] = useState<Ordem | null | undefined>(undefined)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [sep, setSep] = useState<Record<string, string>>({}) // qtd separada editável (PLANEJADA)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [devolver, setDevolver] = useState<Record<string, string>>({})
  const [conclusoes, setConclusoes] = useState<Conclusao[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  // ⭐ a ordem tem etapa ASSINADA (alguém carimbou com o PIN)? Então "quem produziu" já está
  // respondido — o dropdown vira fóssil e sai da tela (06/09).
  const [etapasAssinadas, setEtapasAssinadas] = useState(false)
  /** ⭐ o aviso da ordem PARADA com as três portas (19/09) — vem do SERVIDOR, não da tela */
  const [parada, setParada] = useState<{ avisar: boolean; motivo: string | null; portas: { acao: string; rotulo: string; efeito: string; primaria?: boolean }[] } | null>(null)
  /**
   * ⭐⭐ O PEDIDO RESOLVIDO (item 2 do dono, 04/10) — vem do SERVIDOR, com a ORIGEM.
   *
   * ⛔ Resolver aqui seria a 2ª resposta pra *"qual é o pedido?"*: a tela diria um número e a
   * eficiência (que sai da mesma lib, no servidor) compararia com outro.
   */
  const [pedido, setPedido] = useState<{ unidades: number | null; origem: 'DECLARADO' | 'DERIVADO' | null; comoSoube: string | null } | null>(null)
  const [diaQueContinua, setDiaQueContinua] = useState('')
  // ⛔ as etapas ABERTAS: concluir por aqui vai LEVÁ-LAS junto, sem tempo medido. O
  // encarregado tem que saber ANTES de apertar — escolha consciente, não efeito colateral.
  const [etapasAbertas, setEtapasAbertas] = useState<EtapaAbertaNaTela[]>([])
  const [rendimentoMedio, setRendimentoMedio] = useState<number | null>(null)
  const [rendimentoLotes, setRendimentoLotes] = useState(0)
  // ⭐ "quero fazer N" — o sentido PRINCIPAL do dono ("faz 200 porções" → quantos kg pegar).
  // Vazio = quem manda são as linhas de insumo (o outro sentido).
  const [querFazer, setQuerFazer] = useState('')

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}`).then((r) => r.json()).then((j) => {
    if (!j.ordem) { setOrdem(null); return }
    setOrdem(j.ordem); setLinhas(j.linhas ?? [])
    setConclusoes(j.conclusoes ?? []); setColaboradores(j.colaboradores ?? []); setRendimentoMedio(j.rendimentoMedio ?? null); setRendimentoLotes(j.rendimentoLotes ?? 0)
    setParada(j.parada ?? null)
    setPedido(j.pedido ?? null)
    if (j.ordem.estado === 'PLANEJADA') setSep(Object.fromEntries((j.linhas ?? []).map((l: Linha) => [l.itemId, String(l.qtdPlanejada)])))
  }).catch(() => setOrdem(null))
  useEffect(() => { carregar() }, [id, ordemId]) // eslint-disable-line react-hooks/exhaustive-deps

  const acao = async (body: object) => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/acao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui.'); return false }
      setDevolver({}); carregar(); return true
    } catch { setErro('Falha de conexão.'); return false } finally { setBusy(false) }
  }

  const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const custoSeparado = useMemo(() => linhas.reduce((s, l) => { const q = ordem?.estado === 'PLANEJADA' ? parseNum(sep[l.itemId]) : l.qtdSeparada; return s + q * (l.custoMedio ?? 0) }, 0), [linhas, sep, ordem])

  // ⭐⭐ O ESPELHO e a PREVISÃO — hooks no TOPO (Regra dos Hooks: nº fixo, antes do early-return).
  // ⛔ A conta da separação é a FICHA (`insumoDoPedido`); o espelho só alimenta a frase.
  const espelho = useMemo(
    () => eficienciaMedia({ teorico: ordem?.loteBase ?? 1, medido: rendimentoMedio, lotes: rendimentoLotes }),
    [ordem?.loteBase, rendimentoMedio, rendimentoLotes],
  )

  // sentido A (kg digitado → unidades): a escala sai do que está NAS LINHAS
  const escalaAtual = useMemo(() => {
    if (ordem?.estado !== 'PLANEJADA') return null
    return escalaDoConsumo(linhas.map((l) => ({ qtd: parseNum(sep[l.itemId]), porLote: l.porLote })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, sep, ordem])

  const previsao = useMemo(
    () => (escalaAtual == null || !ordem ? null : preverSaida(escalaAtual, { teorico: ordem.loteBase, medido: rendimentoMedio, lotes: rendimentoLotes })),
    [escalaAtual, ordem, rendimentoMedio, rendimentoLotes],
  )

  // ⚠️ AVISO DE LINHAS DESENCONTRADAS (substitui o antigo "~154× a receita"): o dono não fala
  // em "×", fala em unidades. Mas se o coxão dá pra 200 e o acém só pra 150, esconder isso
  // numa média seria pior — a previsão sairia de um número que não existe em lugar nenhum.
  const desencontro = useMemo(() => {
    if (ordem?.estado !== 'PLANEJADA' || !ordem) return null
    // ⭐ a saída de cada linha pela FICHA (`loteBase`), nunca pelo rendimento medido
    const rs = linhas.filter((l) => l.porLote > 0 && parseNum(sep[l.itemId]) > 0)
      .map((l) => ({ nome: l.nome, saida: (parseNum(sep[l.itemId]) / l.porLote) * ordem.loteBase }))
    if (rs.length < 2) return null
    const min = rs.reduce((a, b) => (a.saida <= b.saida ? a : b))
    const max = rs.reduce((a, b) => (a.saida >= b.saida ? a : b))
    if (min.saida <= 0 || max.saida / min.saida < 1.1) return null
    return { min, max }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, sep, ordem])

  /**
   * ⭐⭐ A EFICIÊNCIA DA ORDEM (item 1 do dono) — hook no TOPO, antes do early-return (REGRA 9).
   *
   * ⚠️ Ela só existe pra ordem CONCLUÍDA: antes disso o "produziu" não existe, e mostrar 0%
   * numa ordem em andamento seria acusar quem ainda está com a mão na massa.
   */
  const eficiencia = useMemo(() => {
    if (!ordem || ordem.estado !== 'CONCLUIDA' || !conclusoes.length) return null
    const saiu = conclusoes.reduce((s, c) => s + c.qtdGerada, 0) // ⭐ soma as parciais
    return eficienciaDaOrdem({
      escala: ordem.escalaReceitas, loteBase: ordem.loteBase, qtdGerada: saiu,
      componentes: linhas.map((l) => ({ nome: l.nome, unidade: l.unidade, porLote: l.porLote, consumido: l.qtdConsumida })),
    })
  }, [ordem, conclusoes, linhas])

  if (ordem === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (ordem === null) return <div className="p-6 text-sm text-slate-500">Ordem não encontrada.</div>

  const planejada = ordem.estado === 'PLANEJADA'
  const separada = ordem.estado === 'SEPARADA'
  const emProducao = ordem.estado === 'EM_PRODUCAO'
  const encerrada = ordem.estado === 'CONCLUIDA' || ordem.estado === 'CANCELADA'
  const passoAtual = PASSOS.indexOf(ordem.estado === 'CANCELADA' ? 'PLANEJADA' : ordem.estado)

  const confirmarSeparacao = () => acao({ acao: 'separar', itens: linhas.map((l) => ({ itemId: l.itemId, qtdSeparada: parseNum(sep[l.itemId]) })).filter((i) => i.qtdSeparada > 0) })

  // dependência entre ordens: cria a ordem do componente que falta e navega (sem orquestração automática)
  const produzirAntes = async (fichaIdComp: string) => {
    setBusy(true); setErro(null)
    try {
      const hoje = diaEmSaoPaulo()
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId: fichaIdComp, escalaReceitas: 1, dataProducao: hoje }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`
      else setErro(j?.erro ?? 'Não consegui criar a ordem do componente.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 print:hidden"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra produção</a>

      {/* cabeçalho */}
      <div className="flex items-start gap-3">
        <Factory className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <div className="flex-1">
          <h1 className="text-base font-semibold text-slate-900">{ordem.nomeProduzido}</h1>
          {/**
            * ⭐⭐ O PEDIDO VISÍVEL O DIA INTEIRO (item 2 do dono) — *"pedido: 80 UN — em
            * produção"*. Ele é a 2ª linha do cabeçalho, acima de tudo que é detalhe.
            *
            * ⚠️ A ORIGEM VAI JUNTO quando é DERIVADO: as 471 ordens que nasceram antes deste
            * campo não têm pedido declarado, e dizer "pedido 80" seco ali afirmaria que o dono
            * pediu 80 quando foi a ficha que calculou. É a mesma disciplina do `~previsto` dos
            * empréstimos e do selo `[sistema]` do Fluxo: visível, usado, dizendo de onde veio.
            */}
          {pedido?.unidades != null && (
            <p className="text-[15px] font-medium text-slate-900">
              pedido: <span className="tabular-nums">{num(pedido.unidades)} {ordem.unidadeProduzido}</span>
              <span className="ml-1.5 text-[13px] font-normal text-slate-500">
                — {PASSO_LABEL[ordem.estado]?.toLowerCase() ?? ordem.estado.toLowerCase()}
              </span>
              {pedido.origem === 'DERIVADO' && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500" title={pedido.comoSoube ?? ''}>
                  calculado pela ficha
                </span>
              )}
            </p>
          )}
          <p className="text-sm text-slate-500">{ordem.escalaReceitas}× a receita (v{ordem.versaoFicha}) · {fmtDia(ordem.dataProducao)}{ordem.setorNome ? ` · ${ordem.setorNome}` : ''}</p>
        </div>
        {ordem.estado === 'CANCELADA' && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">Cancelada</span>}
      </div>

      {/* ⭐⭐ A ORDEM PARADA E AS TRÊS PORTAS (19/09) — aviso sem porta é beco.
          O card do painel leva pra cá; aqui ele DIZ o que cada saída faz com o dinheiro. */}
      {parada?.avisar && (
        <div className="rounded-xl border-[1.5px] border-amber-300 bg-amber-50 p-3.5 print:hidden">
          <p className="text-[13px] font-semibold leading-snug text-amber-900">{parada.motivo}</p>
          <div className="mt-2.5 space-y-1.5">
            {parada.portas.map((porta) => (
              <div key={porta.acao} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {porta.acao === 'CONCLUIR' && (
                  <a href="#concluir" className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">{porta.rotulo}</a>
                )}
                {porta.acao === 'CANCELAR_E_DEVOLVER' && (
                  <button type="button" disabled={busy}
                    onClick={() => { if (confirm('Cancelar a ordem? Os insumos separados voltam pro estoque.')) acao({ acao: 'cancelar' }) }}
                    className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50">
                    {porta.rotulo}
                  </button>
                )}
                {porta.acao === 'CONTINUA_DEPOIS' && (
                  <span className="inline-flex items-center gap-1.5">
                    <input type="date" aria-label="dia em que a produção continua" value={diaQueContinua}
                      onChange={(e) => setDiaQueContinua(e.target.value)}
                      className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs" />
                    <button type="button" disabled={busy || !diaQueContinua}
                      onClick={async () => { if (await acao({ acao: 'continua-depois', diaPrevisto: diaQueContinua })) setDiaQueContinua('') }}
                      className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-40">
                      {porta.rotulo}
                    </button>
                  </span>
                )}
                {/* ⚠️ o EFEITO à vista: escolher sem saber o que acontece com o insumo é o
                    que faz o dono não escolher nada e o lote ficar parado mais um dia */}
                <span className="text-[11px] leading-snug text-amber-800/80">{porta.efeito}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* stepper */}
      {ordem.estado !== 'CANCELADA' && (
        <div className="flex items-center gap-1 text-[11px] print:hidden">
          {PASSOS.map((p, i) => (
            <div key={p} className="flex items-center gap-1">
              <span className={`rounded-full px-2.5 py-1 font-medium ${i < passoAtual ? 'bg-emerald-50 text-emerald-700' : i === passoAtual ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-400'}`}>{PASSO_LABEL[p]}</span>
              {i < PASSOS.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      )}

      {/* separação */}
      <Card><CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-900">{planejada ? 'Separação (ajuste o que tirou da câmara)' : 'Separado'}</p>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 print:hidden"><Printer className="h-3.5 w-3.5" /> imprimir</button>
        </div>

        {/* ⭐⭐ OS DOIS CAMPOS LIGADOS — o pedido central do dono (01/09):
            *"eu falo pro funcionário 'faz 200 porções'. Ele precisa saber QUANTOS KG PEGAR.
            Hoje ele faz a conta de cabeça e depois digita o kg. O sistema tem que fazer a conta."*
            Digitar em cima preenche TODAS as linhas de insumo; digitar numa linha recalcula
            o de cima. Mesma régua nos dois sentidos, senão a ida-e-volta não fecha. */}
        {planejada && (
          <div className="border-b border-slate-100 bg-slate-50/60 p-4 print:hidden">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <label className="text-xs text-slate-500">
                Quero fazer
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    value={querFazer}
                    onChange={(e) => {
                      setQuerFazer(e.target.value)
                      const alvo = parseNum(e.target.value)
                      if (!(alvo > 0) || !ordem) return
                      // ⭐ o de cima manda: cada linha recebe o SEU insumo pra esse alvo
                      // ⛔ pela FICHA (dose × pedido ÷ loteBase) — sem rendimento no meio
                      setSep(Object.fromEntries(linhas.map((l) => {
                        const q = insumoDoPedido({ pedido: alvo, loteBase: ordem.loteBase }, l.porLote)
                        return [l.itemId, q == null ? '' : String(q).replace('.', ',')]
                      })))
                    }}
                    inputMode="decimal" placeholder="200"
                    className="w-28 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-base font-semibold tabular-nums"
                  />
                  <span className="text-sm text-slate-500">{ordem.unidadeProduzido}</span>
                </div>
              </label>

              <div className="min-w-[15rem] text-xs">
                <p className="text-slate-500">Preciso tirar</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                  {linhas.length === 0 ? '—' : linhas.map((l) => `${formatarQtd(parseNum(sep[l.itemId]), l.unidade)} de ${l.nome.toLowerCase()}`).join(' · ')}
                </p>
                {/* ⛔ A frase diz a VERDADE da conta: é a receita. O espelho vem depois. */}
                <p className="mt-0.5 text-[11px] text-slate-400">
                  pela receita da ficha
                  {espelho
                    ? ` · seus últimos ${espelho.lotes} lotes renderam ${(espelho.pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% dela`
                    : rendimentoLotes === 1
                      ? ' · 1 lote ainda não é média'
                      : ' · eficiência: a apurar'}
                </p>
              </div>

              {previsao && (
                <div className="ml-auto text-right text-xs">
                  <p className="text-slate-500">Com isso deve sair</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    ~{num(Math.round(previsao.esperadoDaFicha))} <span className="text-sm font-normal text-slate-500">{ordem.unidadeProduzido}</span>
                  </p>
                  {/* ⭐ ESPELHO: o que a sua média diria — informação, não meta. */}
                  {previsao.medido != null && espelho && (
                    <p className="text-[11px] text-slate-400">~{num(Math.round(previsao.medido))} pela sua média de {espelho.lotes} lotes</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <table className="density-normal w-full">
          <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">Insumo</th><th className="px-3 py-2 text-right font-medium">Planejado</th>
            <th className="px-3 py-2 text-right font-medium">{planejada ? 'Separar' : 'Em produção'}</th>
            <th className="px-3 py-2 text-right font-medium">Estoque</th>
            {!planejada && !encerrada && <th className="px-3 py-2 print:hidden"></th>}
          </tr></thead>
          <tbody>
            {linhas.map((l) => {
              const sepQtd = parseNum(sep[l.itemId])
              const faltou = planejada && sepQtd > l.saldoDisponivel + 0.001
              return (
                <tr key={l.itemId} className="border-t border-slate-50">
                  {/* ⭐ o INSUMO é o que o cozinheiro procura na linha: nome em 14px/500 e
                      quantidade em 14px tabular. O custo continua em tom de apoio — máx 2
                      pesos escuros por linha. */}
                  <td className="px-3 py-0 text-[14px]">
                    <p className="font-medium text-slate-900">{l.nome}</p>
                    <p className="text-[11.5px] text-slate-400">{l.custoMedio != null ? `${brl(l.custoMedio)}/${l.unidadeControle}` : 'sem custo (a definir)'}</p>
                  </td>
                  <td className="px-3 py-0 text-right text-[14px] font-medium tabular-nums text-slate-700">{formatarQtd(l.qtdPlanejada, l.unidade)}</td>
                  <td className="px-3 py-0 text-[13px] text-right">
                    {planejada ? (
                      <div className="flex items-center justify-end gap-1">
                        <input value={sep[l.itemId] ?? ''} onChange={(e) => setSep((s) => ({ ...s, [l.itemId]: e.target.value }))} inputMode="decimal" className={`w-20 rounded-lg border py-1.5 px-2 text-right text-sm tabular-nums ${faltou ? 'border-rose-300 bg-rose-50' : 'border-slate-300'}`} />
                        <span className="w-6 text-xs text-slate-400">{l.unidade}</span>
                      </div>
                    ) : <span className="tabular-nums font-medium text-slate-800">{formatarQtd(l.qtdSeparada, l.unidade)}</span>}
                  </td>
                  <td className={`px-3 py-0 text-[13px] text-right tabular-nums ${l.saldoDisponivel < 0 ? 'text-rose-600' : 'text-slate-500'}`}>{num(l.saldoDisponivel)}</td>
                  {!planejada && !encerrada && (
                    <td className="px-3 py-0 text-[13px] print:hidden">
                      {l.qtdSeparada > 0 && (
                        devolver[l.itemId] !== undefined ? (
                          <div className="flex items-center gap-1">
                            {/* ⚠️ controle inline: o rótulo vai ANTES (fixo), porque em cima
                                não cabe na linha — o que não pode é o nome do campo sumir. */}
                            <span className="text-[11px] font-medium text-slate-500">devolver</span>
                            <input aria-label={`quantidade a devolver de ${l.nome}`} value={devolver[l.itemId]} onChange={(e) => setDevolver((d) => ({ ...d, [l.itemId]: e.target.value }))} inputMode="decimal" placeholder="0" className="w-16 rounded border border-slate-300 py-1 px-1.5 text-right text-xs tabular-nums" />
                            <button disabled={busy} onClick={() => acao({ acao: 'devolver', itemId: l.itemId, qtd: parseNum(devolver[l.itemId]) })} className="rounded bg-slate-700 px-2 py-1 text-[11px] text-white disabled:opacity-50">ok</button>
                            <button onClick={() => setDevolver((d) => { const n = { ...d }; delete n[l.itemId]; return n })} className="text-slate-300"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : <button onClick={() => setDevolver((d) => ({ ...d, [l.itemId]: '' }))} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"><Undo2 className="h-3 w-3" /> devolver</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm">
          <span className="text-slate-500">Custo {planejada ? 'a separar' : 'em produção'}</span>
          <span className="font-semibold tabular-nums text-slate-900">{brl(custoSeparado)}</span>
        </div>
      </CardContent></Card>

      {/* dependência entre ordens: componente PRODUZIDO faltando → "produzir antes" (aviso + link, sem orquestração automática) */}
      {planejada && (() => {
        const faltas = linhas.filter((l) => l.fichaIdComponente && l.saldoDisponivel < parseNum(sep[l.itemId] ?? String(l.qtdPlanejada)) - 0.001)
        if (!faltas.length) return null
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 print:hidden">
            <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Falta insumo produzido pra esta ordem:</p>
            {faltas.map((l) => (
              <div key={l.itemId} className="flex items-center justify-between py-0.5">
                <span>{l.nome}: tem {formatarQtd(l.saldoDisponivel, l.unidade)}, precisa {formatarQtd(parseNum(sep[l.itemId] ?? String(l.qtdPlanejada)), l.unidade)}</span>
                <button onClick={() => produzirAntes(l.fichaIdComponente!)} disabled={busy} className="ml-2 inline-flex items-center gap-1 rounded border border-amber-400 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"><Factory className="h-3 w-3" /> produzir antes</button>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ⚠️ linhas desencontradas — em UNIDADES, nunca em "×" (o dono não fala em escala) */}
      {desencontro && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700 print:hidden">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            O que você separou não está parelho: <strong>{desencontro.max.nome}</strong> dá pra ~{num(Math.round(desencontro.max.saida))} e{' '}
            <strong>{desencontro.min.nome}</strong> só pra ~{num(Math.round(desencontro.min.saida))} {ordem.unidadeProduzido}. Confere se faltou separar algo —
            dá pra seguir assim, o rendimento vai contra o que você separou de verdade.
          </span>
        </div>
      )}

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      {/* ações */}
      {!encerrada && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {planejada && <button onClick={confirmarSeparacao} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar separação</button>}
          {separada && <button onClick={() => acao({ acao: 'iniciar' })} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />} Iniciar produção</button>}
          <button onClick={() => { if (confirm('Cancelar a ordem? Os insumos separados voltam pro estoque.')) acao({ acao: 'cancelar' }) }} disabled={busy} className="text-sm text-rose-500 hover:text-rose-700">Cancelar ordem</button>
        </div>
      )}

      {/* ⭐⭐ ETAPAS — quem faz cada parte (06/09). Fica ANTES da conclusão porque é o
          trabalho acontecendo; a conclusão é o fecho. */}
      <EtapasDaOrdem id={id} ordemId={ordemId} colaboradores={colaboradores} aoSaberAssinadas={setEtapasAssinadas} aoSaberAbertas={setEtapasAbertas} />

      {/* conclusão ("quantos saíram?") — ⭐ a âncora é o alvo da 1ª porta do aviso */}
      <div id="concluir" />
      {emProducao && <ConclusaoForm id={id} ordemId={ordemId} linhas={linhas} etapasAbertas={etapasAbertas} colaboradores={etapasAssinadas ? [] : colaboradores} rendimentoMedio={rendimentoMedio} rendimentoLotes={rendimentoLotes} loteBase={ordem.loteBase} unidadeProduzido={ordem.unidadeProduzido} onConcluida={carregar} />}

      {/* ⭐⭐ A EFICIÊNCIA DA ORDEM — item 1 do dono (03/10):
          *"pedi 10 · produziu 9 → 90%, com o consumo real do lado (plano × real por componente)"*

          ⛔⛔ Ela existe porque o rendimento SAIU da conta da separação. Antes a medição se
          escondia dentro da escala: render mal fazia separar menos, a conta "fechava" e nada
          aparecia. Com a separação fixa pela ficha, render mal SOBRA — e sobrar só vale se
          estiver na tela. **Desvio que aparece é desvio que alguém explica.**

          ⚠️ A conta vem da lib PURA (`eficienciaDaOrdem`), a MESMA que o juiz P8 usa — tela e
          e-mail não têm como discordar sobre o mesmo lote. */}
      {eficiencia && eficiencia.pct != null && (
        <Card><CardContent className="p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Eficiência desta ordem</h2>
            <span className={`rounded-xl px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
              eficiencia.faixa === 'ABAIXO' ? 'bg-rose-50 text-rose-700'
                : eficiencia.faixa === 'ACIMA' ? 'bg-sky-50 text-sky-700'
                  : 'bg-emerald-50 text-emerald-700'}`}>
              {Math.round(eficiencia.pct * 100)}%
            </span>
            {/**
              * ⭐⭐ O CICLO FECHADO que o dono pediu (item 2): *"pedido 80 · separado X ·
              * produzido 78 · 98%"*. A frase sai da LIB (`fraseDoCiclo`) — montá-la aqui faria
              * a mesma sentença existir em dois lugares (esta tela e o relatório do item 3) e
              * divergir no primeiro ajuste de rótulo.
              *
              * ⚠️ **`separado` é o CONSUMIDO em R$, não o `qtdSeparada`** — duas armadilhas num
              * campo: (a) `qtdSeparada` é *em-produção* (`SEP − DEV − CON`), ~zero numa ordem
              * CONCLUÍDA por construção, e imprimiria "separado 0" em toda ordem fechada (a
              * cicatriz de 03/10); (b) somar a QUANTIDADE dos componentes misturaria KG com UN
              * — o pecado de 13/09. Dinheiro soma; grandeza física, não.
              */}
            <span className="text-xs text-slate-500">
              {fraseDoCiclo({
                pedido: pedido?.unidades ?? eficiencia.pedido,
                unidadeProduto: ordem.unidadeProduzido,
                // ⚠️ em R$: somar KG com UN num número só é o pecado de 13/09
                separadoReais: linhas.length
                  ? Math.round((linhas.reduce((t, l) => t + l.qtdConsumida * (l.custoMedio ?? 0), 0) + 1e-9) * 100) / 100
                  : null,
                produzido: eficiencia.produzido,
              })}
            </span>
          </div>
          {/**
            * ⭐⭐⭐ O FISCAL — *"o declarado cabe no material separado?"* (04/10).
            *
            * **Ordem do dono:** a conta da régua do P8, **pela FICHA inteira**, aparece AQUI com
            * a frase de balcão: *"pelo material separado, a receita permite ~N; foram declaradas
            * M"*. ⭐ É a casa certa porque é aqui que a conta está ABERTA, componente a
            * componente, logo abaixo — o dono vê o número E de onde ele veio.
            *
            * ⛔ A frase sai da LIB (`fraseDoFiscal`); montá-la aqui faria a mesma sentença
            * existir nesta tela e no aviso do sininho, e divergir no 1º ajuste de rótulo.
            * ⚠️ O destaque CORAL é só no impossível (>120%): marcar os 110% normais de coral
            * treinaria o dono a ignorar o bloco, que é como o alarme de 26/08 morreu.
            */}
          {eficiencia.fiscal.permitido != null && (
            <p
              className={`mt-1 text-xs ${eficiencia.fiscal.impossivel ? 'font-medium text-rose-700' : 'text-slate-500'}`}
            >
              {fraseDoFiscal(eficiencia.fiscal, eficiencia.produzido, ordem.unidadeProduzido)}
            </p>
          )}
          {/* ⚠️ A FRASE SÓ NO LADO DE BAIXO: render acima do prometido não é prejuízo (é ficha
              generosa), e cobrar explicação ali treinaria o dono a ignorar o bloco. */}
          {eficiencia.alerta && (
            <p className="mt-1 text-xs text-rose-700">
              Saiu menos do que a receita promete — confira a operação, a sobra não contada, ou mude a ficha se a perda é real.
            </p>
          )}
          <table className="density-normal mt-2.5 w-full">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Componente</th>
              <th className="px-3 py-2 text-right font-medium">Plano (ficha)</th>
              <th className="px-3 py-2 text-right font-medium">Real (consumido)</th>
              <th className="px-3 py-2 text-right font-medium">Diferença</th>
            </tr></thead>
            <tbody>
              {eficiencia.componentes.map((c) => (
                <tr key={c.nome} className="border-t border-slate-50">
                  <td className="px-3 py-0 text-[14px] font-medium text-slate-900">{c.nome}</td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">{formatarQtd(c.plano, c.unidade)}</td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">{formatarQtd(c.real, c.unidade)}</td>
                  {/* ⚠️ ZERO não ganha cor: consumir exatamente a ficha é o normal, e pintar
                      o normal é o que faz ninguém mais ver a cor que importa. */}
                  <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${
                    Math.abs(c.gap) < 0.0001 ? 'text-slate-400' : c.gap > 0 ? 'text-rose-600' : 'text-sky-700'}`}>
                    {Math.abs(c.gap) < 0.0001 ? '—' : `${c.gap > 0 ? '+' : '−'}${formatarQtd(Math.abs(c.gap), c.unidade)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-slate-400">
            O plano é a receita × o que esta ordem pediu. A separação nunca foi ajustada pela medição — se a perda é real, mude a ficha.
          </p>
        </CardContent></Card>
      )}

      {/* histórico de conclusões + etiquetas */}
      {conclusoes.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Conclusões ({conclusoes.length})</h2>
          <div className="space-y-2">
            {conclusoes.map((c) => (
              <Card key={c.id}><CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{num(c.qtdGerada)} {ordem.unidadeProduzido} {c.parcial && <span className="text-[11px] font-normal text-amber-600">(parcial)</span>}</p>
                  <p className="text-xs text-slate-500">rendimento {num(c.rendimento)}/receita · custo {brl(c.custoUnitarioReal)}/un{c.colaboradorNome ? ` · ${c.colaboradorNome}` : ''}{c.validadeAte ? ` · val ${fmtDia(c.validadeAte)}` : ''}</p>
                </div>
                <a href={`/empresas/${id}/estoque/producao/conclusoes/${c.id}/etiqueta`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><Tag className="h-3.5 w-3.5" /> etiqueta</a>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConclusaoForm({ id, ordemId, linhas, colaboradores, etapasAbertas, rendimentoMedio, rendimentoLotes, loteBase, unidadeProduzido, onConcluida }: { id: string; ordemId: string; linhas: Linha[]; colaboradores: Colaborador[]; etapasAbertas: EtapaAbertaNaTela[]; rendimentoMedio: number | null; rendimentoLotes: number; loteBase: number; unidadeProduzido: string; onConcluida: () => void }) {
  const emProd = linhas.filter((l) => l.qtdSeparada > 0)
  const [consumo, setConsumo] = useState<Record<string, string>>(Object.fromEntries(emProd.map((l) => [l.itemId, String(l.qtdSeparada)])))
  const [qtdGerada, setQtdGerada] = useState('')
  const [colaboradorId, setColaboradorId] = useState('')
  const [parcial, setParcial] = useState(false)
  const [motivoDesvio, setMotivoDesvio] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const rend = { teorico: loteBase, medido: rendimentoMedio, lotes: rendimentoLotes }

  // ⭐ REGRA 4: a frase vem da MESMA função que o servidor usa pra descrever o encerramento —
  // duas redações divergiriam no dia em que uma delas mudasse.
  const avisoEtapas = avisoDeEtapasAbertas(etapasAbertas)

  const custoLote = useMemo(() => emProd.reduce((s, l) => s + parseNum(consumo[l.itemId]) * (l.custoMedio ?? 0), 0), [consumo, emProd])
  const qg = parseNum(qtdGerada)
  const custoUnit = qg > 0 ? custoLote / qg : null

  // ⭐ ESCALA do que está sendo consumido — a MESMA função que o `concluir()` usa pra gravar
  // o rendimento. Antes a tela não sabia a escala ("a escala aparece após concluir") e por
  // isso não tinha como prever nada.
  const escala = useMemo(
    () => escalaDoConsumo(emProd.map((l) => ({ qtd: parseNum(consumo[l.itemId]), porLote: l.porLote }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consumo, emProd],
  )
  const previsao = useMemo(() => (escala == null ? null : preverSaida(escala, rend)), [escala, rendimentoMedio, rendimentoLotes, loteBase]) // eslint-disable-line react-hooks/exhaustive-deps
  // ⚠️ SÓ julga depois que ele digitou — previsão antes, veredito depois.
  const variacao = useMemo(() => (escala == null || !(qg > 0) ? null : avaliarVariacao(qg, escala, rend)), [escala, qg, rendimentoMedio, rendimentoLotes, loteBase]) // eslint-disable-line react-hooks/exhaustive-deps

  const concluir = async () => {
    setErro(null)
    if (!(qg > 0)) return setErro('Diga quantos saíram.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/concluir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumo: emProd.map((l) => ({ itemId: l.itemId, qtdConsumida: parseNum(consumo[l.itemId]) })).filter((c) => c.qtdConsumida > 0), qtdGerada: qg, colaboradorId: colaboradorId || null, motivoDesvio: motivoDesvio.trim() || null, parcial }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui concluir.'); return }
      // vai pra etiqueta e já manda pra Zebra (agente local) — a etiqueta sai na conclusão
      if (j?.conclusaoId) { window.location.href = `/empresas/${id}/estoque/producao/conclusoes/${j.conclusaoId}/etiqueta?print=zebra`; return }
      onConcluida()
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    <Card className="border-[#185FA5]/30"><CardContent className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Check className="h-4 w-4 text-[#185FA5]" /> Concluir — quantos saíram?</p>

      {/* consumo real (pré = em-produção) */}
      <div>
        <p className="mb-1 text-xs text-slate-500">Confirme o que foi consumido de verdade (sobra volta pro estoque):</p>
        <div className="divide-y divide-slate-50">
          {emProd.map((l) => (
            <div key={l.itemId} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="flex-1 text-slate-700">{l.nome}</span>
              <span className="text-[11px] text-slate-400">em produção {num(l.qtdSeparada)}</span>
              <input value={consumo[l.itemId] ?? ''} onChange={(e) => setConsumo((c) => ({ ...c, [l.itemId]: e.target.value }))} inputMode="decimal" className="w-20 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-sm tabular-nums" />
              <span className="w-6 text-xs text-slate-400">{l.unidade}</span>
            </div>
          ))}
        </div>
      </div>

      {/* quantos saíram + colaborador */}
      <div className="flex flex-wrap items-end gap-3">
        {/* ⛔⛔ O CAMPO NASCE E CONTINUA VAZIO — regra dura do dono: *"a previsão SUGERE, nunca
            preenche. Se preencher, todo mundo confirma o número sem contar. É o mesmo viés
            da contagem."* O esperado vive AO LADO, nunca dentro. */}
        <label className="text-xs text-slate-500">Quantos saíram?
          <div className="mt-1 flex items-center gap-1"><input value={qtdGerada} onChange={(e) => setQtdGerada(e.target.value)} inputMode="decimal" placeholder="conte e digite" className="w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" /><span className="text-xs text-slate-400">{unidadeProduzido}</span></div>
          {previsao && (
            <p className="mt-1 text-[11px] text-slate-400">
              a receita promete ~{num(Math.round(previsao.esperadoDaFicha))}
              {previsao.medido != null && rendimentoLotes >= 2
                ? ` · a sua média daria ~${num(Math.round(previsao.medido))} (${rendimentoLotes} lotes)`
                : rendimentoLotes === 1 ? ' · 1 lote ainda não é média' : ''}
            </p>
          )}
        </label>
        {/* ⭐⭐ "QUEM PRODUZIU" DERIVA DAS ETAPAS (06/09). Quando a ordem tem etapa assinada
            pelo PIN, a pergunta já está respondida — e melhor: respondida POR ETAPA, com o
            tempo de cada mão. Manter o dropdown aqui seria pedir de novo o que o tablet já
            sabe, e abrir espaço pra as duas respostas divergirem.
            ⚠️ Ele PERMANECE na ordem antiga (sem etapa assinada): lá ninguém carimbou nada,
            e sem ele a conclusão ficaria sem dono. */}
        {colaboradores.length > 0 ? (
          <label className="text-xs text-slate-500">Quem produziu
            <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">—</option>{colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          </label>
        ) : (
          <p className="pb-2 text-[11px] text-slate-400">quem produziu vem das etapas (o PIN de cada um)</p>
        )}
        <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-500"><input type="checkbox" checked={parcial} onChange={(e) => setParcial(e.target.checked)} /> produção parcial (concluo o resto depois)</label>
      </div>

      {/* prévia custo + rendimento */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3 text-xs">
        <div><span className="text-slate-400">Custo do lote</span><p className="font-semibold tabular-nums text-slate-800">{brl(custoLote)}</p></div>
        <div><span className="text-slate-400">Custo por {unidadeProduzido}</span><p className="font-semibold tabular-nums text-slate-800">{custoUnit != null ? brl(custoUnit) : '—'}</p></div>
        <div><span className="flex items-center gap-1 text-slate-400"><TrendingUp className="h-3 w-3" /> rendimento médio</span><p className="font-semibold tabular-nums text-slate-800">{rendimentoMedio != null ? `${num(rendimentoMedio)}/receita` : 'a apurar'}</p>{rendimentoLotes > 0 && <p className="text-[10px] text-slate-400">de {rendimentoLotes} {rendimentoLotes === 1 ? 'lote' : 'lotes'}</p>}</div>
      </div>

      {/* ⭐ AVISO DE EFICIÊNCIA — contra a RECEITA (03/10). Sugere, NUNCA bloqueia. */}
      {variacao && variacao.pctFicha != null && (
        <div className={`rounded-lg border p-3 text-xs ${
          variacao.faixa === 'ABAIXO' ? 'border-rose-200 bg-rose-50/70 text-rose-700'
            : variacao.faixa === 'ACIMA' ? 'border-amber-200 bg-amber-50/70 text-amber-800'
              : variacao.faixa === 'NORMAL' ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
          <p className="font-medium">
            {(variacao.pctFicha * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do que a receita promete
            {variacao.pctMediaDaFicha != null && ` · sua média é ${(variacao.pctMediaDaFicha * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}
            {variacao.faixa === 'ABAIXO' && ' · SAIU MENOS'}
            {variacao.faixa === 'ACIMA' && ' · SAIU MAIS'}
            {variacao.faixa === 'NORMAL' && ' · dentro do esperado'}
          </p>
          {/* ⛔ SEM_REGUA agora só existe com ficha de lote base zerado — sem ele não há o
              que comparar, e inventar porcentagem ali seria pior que dizer "não sei". */}
          {variacao.faixa === 'SEM_REGUA' && (
            <p className="mt-0.5">A ficha não declara quanto 1 receita produz — sem isso não dá pra medir eficiência.</p>
          )}
          {variacao.alerta && (
            <label className="mt-2 block">
              <span className="text-[11px] opacity-80">Aconteceu alguma coisa? (opcional — fica gravado na ordem)</span>
              <input value={motivoDesvio} onChange={(e) => setMotivoDesvio(e.target.value)} placeholder="ex: queijo veio com muita casca" className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-700" />
            </label>
          )}
        </div>
      )}


      {/* ⛔⛔ O AVISO DO CAMINHO DO ENCARREGADO (06/09) — a fresta entre os dois caminhos.
          Concluir por aqui ENCERRA a etapa aberta sem tempo medido; ele precisa saber ANTES
          de apertar. ⚠️ E a frase ENSINA A SAÍDA ("peça pra finalizar no tablet primeiro"),
          porque aviso que só comunica um estrago treina a pessoa a ignorar. NÃO BLOQUEIA:
          quem decide é o encarregado — a mesma régua do aviso de rendimento logo acima. */}
      {avisoEtapas && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{avisoEtapas}</span>
        </div>
      )}

      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <button onClick={concluir} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Concluir e gerar etiqueta</button>
    </CardContent></Card>
  )
}
