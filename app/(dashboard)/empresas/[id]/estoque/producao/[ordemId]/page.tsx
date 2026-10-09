'use client'

// ESTOQUE FASE 2 item 2.1 — detalhe da ORDEM: stepper + SEPARAÇÃO pré-preenchida da ficha.
// O dono ajusta o que REALMENTE tirou da câmara → confirma → SEPARACAO_SAIDA (vai pro armazém
// virtual em-produção). Sobra volta (devolver). Conclusão "quantos saíram?" é 2.2.

import { useEffect, useMemo, useState, use } from 'react'
/**
 * ⚠️ `avaliarVariacao` SAIU DESTA TELA (05/10): era ele que imprimia *"93% do que a receita
 * promete · sua média é 102%"* na modal de concluir — os dois números que a régua de segurança
 * do dono proíbe ali. A função segue viva e usada pelo juiz/relatórios; o que morreu foi a
 * cola de prova na mão de quem declara.
 */
import { escalaDoConsumo, preverSaida, eficienciaMedia } from '@/lib/stock/producao/previsao-rendimento'
import { insumoDoPedido } from '@/lib/stock/producao/escala-da-ordem'
import { eficienciaDaOrdem, fraseDoFiscal } from '@/lib/stock/producao/eficiencia-da-ordem'
import { fraseDoCiclo } from '@/lib/stock/producao/pedido-da-ordem'
import { fmtPedido, pilulaDoPedido } from '@/lib/stock/producao/pedido-na-tela'
import { trilhoDaOrdem } from '@/lib/stock/producao/trilho-da-ordem'
import { fraseDeQuemProduziu } from '@/lib/stock/producao/quem-produziu'
import { LogoDaReceita } from '@/components/estoque/logo-da-receita'
import { PainelDeConferencia } from '@/components/estoque/painel-de-conferencia'
import { SeloDaConferencia } from '@/components/estoque/selo-da-conferencia'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import { formatarQtd } from '@/lib/stock/quantidade'
import { formatBRL } from '@/lib/format/money'
import { Card, CardContent } from '@/components/ui/card'
import { EtapasDaOrdem } from '@/components/estoque/etapas-da-ordem'
import { ArrowLeft, Loader2, Factory, Printer, AlertTriangle, Check, X, Tag, Pencil } from 'lucide-react'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { avisoDeEtapasAbertas } from '@/lib/stock/producao/aviso-etapas-abertas'

interface Linha { itemId: string; nome: string; unidade: string; unidadeControle: string; porLote: number; qtdPlanejada: number; qtdSeparada: number; qtdConsumida: number; saldoDisponivel: number; custoMedio: number | null; fichaIdComponente: string | null }
interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; loteBase: number; estado: string; dataProducao: string; setorNome: string | null; versaoFicha: number; fichaId: string }
/**
 * ⭐ O CARIMBO vem do SERVIDOR, derivado da tabela de conferência — a tela nunca o deduz.
 * ⚠️ `null` só acontece se a rota ficar atrás num deploy; o leitor devolve AGUARDANDO pra
 * quem não tem linha.
 */
interface CarimboDaConclusao {
  estado: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDA' | 'CORRIGIDA_E_CONFERIDA'
  conferidoPorNome: string | null
  corrigiuDe: number | null
  motivoDaCorrecao: string | null
}

interface Conclusao { id: string; qtdGerada: number; colaboradorNome: string | null; rendimento: number; custoLoteReal: number; custoUnitarioReal: number | null; validadeAte: string | null; parcial: boolean; criadoEm: string; conferencia: CarimboDaConclusao | null }
interface Colaborador { id: string; nome: string }
interface EtapaAbertaNaTela { nome: string; executorNome: string | null }

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
// ⭐ dose pequena em KG/LT sai na unidade natural ("0,3 g", não "0,0003 KG") — o padeiro
// lê grama. Dono único em lib/stock/quantidade: quatro formatações divergiriam.
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
/** ⭐ o tom da pílula "% do pedido" → família de token (a RÉGUA mora na lib, nunca aqui) */
const TOM_DO_PEDIDO: Record<'verde' | 'ambar' | 'vermelho', string> = { verde: 'verde', ambar: 'ambar', vermelho: 'coral' }
/**
 * ⭐⭐ O trilho e os rótulos viraram LIB em 05/10 (`trilho-da-ordem.ts`). ⛔ O `indexOf` solto
 * que vivia aqui tratava CANCELADA como se fosse PLANEJADA pra não quebrar a conta — e numa
 * BARRA de progresso isso pintaria 1 de 4 numa ordem que acabou, dizendo *"está no começo"*.
 */
import { ROTULO_DO_PASSO, type PassoDaOrdem } from '@/lib/stock/producao/trilho-da-ordem'

/** ⭐ a família de cor em 3 degraus, pelos tokens da casa (o espelho escuro inverte 50↔800) */
const fam = (f: string) => ({ bg: `var(--fam-${f}-bg)`, mid: `var(--fam-${f}-mid)`, ink: `var(--fam-${f}-ink)` })

export default function OrdemDetalhePage({ params }: { params: Promise<{ id: string; ordemId: string }> }) {
  const { id, ordemId } = use(params)
  /** ⚠️ REGRA 9 — hooks NO TOPO: esta tela tem early-returns (`ordem === undefined`/`null`),
   *  e hook depois deles muda a contagem entre renders e derruba o cliente (mordeu 21/08 nesta
   *  MESMA página, com o `useMemo` do escalaAviso). */
  const { pode: podePerm, carregando: carregandoPerm } = usePermissoes(id)
  /** ⭐ qual conclusão PASSADA está com o painel de correção aberto (item 3) */
  const [corrigindo, setCorrigindo] = useState<string | null>(null)
  const [feitoConf, setFeitoConf] = useState<string | null>(null)
  const [ordem, setOrdem] = useState<Ordem | null | undefined>(undefined)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [sep, setSep] = useState<Record<string, string>>({}) // qtd separada editável (PLANEJADA)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conclusoes, setConclusoes] = useState<Conclusao[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  // ⭐ a ordem tem etapa ASSINADA (alguém carimbou com o PIN)? Então "quem produziu" já está
  // respondido — o dropdown vira fóssil e sai da tela (06/09).
  /**
   * ⭐⭐ QUEM PRODUZIU vem DAS ETAPAS (05/10) — era um booleano (`etapasAssinadas`), e a modal
   * sabia QUE alguém assinou sem saber QUEM. Os nomes chegam pelo MESMO payload que o
   * componente de etapas já buscou; `assinadas` passa a ser **derivado** deles, em vez de um
   * 2º campo que pode discordar.
   */
  const [quemProduziu, setQuemProduziu] = useState<string[]>([])
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
      carregar(); return true
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

  if (ordem === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--prod-muted)]" /></div>
  if (ordem === null) return <div className="p-6 text-sm text-[var(--prod-muted)]">Ordem não encontrada.</div>

  const planejada = ordem.estado === 'PLANEJADA'
  const separada = ordem.estado === 'SEPARADA'
  const emProducao = ordem.estado === 'EM_PRODUCAO'
  const encerrada = ordem.estado === 'CONCLUIDA' || ordem.estado === 'CANCELADA'
  const trilho = trilhoDaOrdem(ordem.estado)

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
      <a href={`/empresas/${id}/estoque/producao`}
        className="inline-flex items-center gap-1 text-[12.5px] transition-colors print:hidden"
        style={{ color: 'var(--prod-muted)' }}>
        <ArrowLeft className="h-3.5 w-3.5" /> voltar pra produção
      </a>

      {/**
        * ⭐⭐⭐ O CABEÇALHO v4 (05/10): logo 48 + nome 19px + sublinha, e o PEDIDO em destaque à
        * direita. ⭐ O logo é o **componente único** — a mesma família/ícone que a linha desta
        * receita tem na lista de concluídas; é por isso que o olho reconhece a ordem antes de
        * ler o nome.
        */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <LogoDaReceita nome={ordem.nomeProduzido} tamanho={48} />

        <div className="min-w-[12rem] flex-1">
          <h1 className="text-[19px] font-medium leading-tight" style={{ color: 'var(--prod-primary)' }}>
            {ordem.nomeProduzido}
          </h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
            {ordem.escalaReceitas}× a receita (v{ordem.versaoFicha}) · {fmtDia(ordem.dataProducao)}
            {ordem.setorNome ? ` · ${ordem.setorNome}` : ''}
          </p>
        </div>

        {/**
          * ⭐⭐ O PEDIDO EM DESTAQUE — *"pedido · 305 UN"*, 24px tabular, **redondo pelo dono
          * único** (o mesmo `fmtPedido` da lista: a home e esta tela dizem o MESMO número).
          *
          * ⚠️⚠️ E a palavra muda com a ORIGEM: **"pedidas"** só quando o dono digitou; derivado
          * diz **"esperadas"**. As 471 ordens que nasceram antes do `stockOrdemMeta` não têm
          * pedido declarado, e chamar de "pedidas" um número que a ficha calculou afirmaria uma
          * decisão que ninguém tomou — é a mesma mentira do *"pedido 0"*.
          */}
        {/**
          * ⛔⛔⛔ **O PEDIDO DERIVADO SE CALA ENQUANTO A ORDEM ESTÁ EM PRODUÇÃO** — buraco achado
          * na prova em prod de 05/10, DEPOIS de limpar a modal.
          *
          * A régua de segurança do dono é sobre a **TELA de conclusão**, e a tela é a PÁGINA:
          * com a ordem em produção, o campo de declarar está logo abaixo, e este cabeçalho
          * imprimia a dois centímetros dele o número que a régua acabou de expulsar. ⚠️ Tirar
          * da modal e deixar no cabeçalho é a correção pela metade que esta casa já pagou
          * várias vezes.
          *
          * ⛔ E o gate é do BLOCO, não da palavra: esconder só o *"esperadas"* deixaria o
          * NÚMERO na tela — **a cola é o número**, o rótulo era só o sinal dele.
          *
          * ⭐ **DECLARADO continua em TODO estado**: é a ordem que ele recebeu de boca (*"faz
          * 200 porções"*) — ele já sabe, então não ensina nada. O DERIVADO é
          * `escala × loteBase` = o `esperadoDaFicha` que o P8 usa de régua, e **só ele** se
          * cala durante a produção; volta na ordem concluída, onde é relatório.
          */}
        {pedido?.unidades != null && !(emProducao && pedido.origem === 'DERIVADO') && (
          <div className="text-right">
            <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
              pedido
            </p>
            <p className="num text-[24px] font-medium leading-tight" style={{ color: 'var(--prod-primary)' }}>
              {fmtPedido(pedido.unidades, ordem.unidadeProduzido)}
              <span className="ml-1 text-[13px] font-normal" style={{ color: 'var(--prod-secondary)' }}>
                {ordem.unidadeProduzido} {pedido.origem === 'DECLARADO' ? 'pedidas' : 'esperadas'}
              </span>
            </p>

            {/**
              * ⭐⭐⭐ ORDEM CONCLUÍDA (item 6): o par *"pedido 305 · fez X"* + a pílula
              * **"N% do pedido"** — da MESMA lib da lista (`pilulaDoPedido`). ⛔ Ela não é o
              * fiscal nem o P8: o bloco de eficiência/fiscal segue embaixo, intocado.
              * ⚠️ Soma as PARCIAIS (`qtdGerada`), porque uma ordem pode fechar em dois dias.
              */}
            {(() => {
              if (ordem.estado !== 'CONCLUIDA' || !conclusoes.length) return null
              const fez = conclusoes.reduce((t, c) => t + c.qtdGerada, 0)
              const pil = pilulaDoPedido(fez, pedido.unidades, ordem.unidadeProduzido)
              return (
                <p className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                  <span className="num text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
                    <span style={{ color: 'var(--prod-muted)' }}>fez </span>
                    <span className="text-[15px] font-medium" style={{ color: 'var(--prod-primary)' }}>{num(fez)}</span>
                  </span>
                  {pil && (
                    <span className="num inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[12px] font-medium"
                      style={{ background: fam(TOM_DO_PEDIDO[pil.tom]).bg, color: fam(TOM_DO_PEDIDO[pil.tom]).ink }}>
                      {pil.alarme && <AlertTriangle className="h-3 w-3" aria-hidden />}
                      {pil.texto}
                    </span>
                  )}
                </p>
              )
            })()}
          </div>
        )}

        {ordem.estado === 'CANCELADA' && (
          <span className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: fam('coral').bg, color: fam('coral').ink }}>Cancelada</span>
        )}
      </div>

      {/* ⭐⭐ A ORDEM PARADA E AS TRÊS PORTAS (19/09) — aviso sem porta é beco.
          O card do painel leva pra cá; aqui ele DIZ o que cada saída faz com o dinheiro. */}
      {parada?.avisar && (
        <div className="rounded-xl border-[1.5px] border-[var(--fam-ambar-mid)] bg-[var(--fam-ambar-bg)] p-3.5 print:hidden">
          <p className="text-[13px] font-semibold leading-snug text-[var(--fam-ambar-ink)]">{parada.motivo}</p>
          <div className="mt-2.5 space-y-1.5">
            {parada.portas.map((porta) => (
              <div key={porta.acao} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {porta.acao === 'CONCLUIR' && (
                  <a href="#concluir" className="rounded-lg bg-[var(--fam-ambar-mid)] px-3 py-1.5 text-xs font-bold text-white">{porta.rotulo}</a>
                )}
                {porta.acao === 'CANCELAR_E_DEVOLVER' && (
                  <button type="button" disabled={busy}
                    onClick={() => { if (confirm('Cancelar a ordem? Os insumos separados voltam pro estoque.')) acao({ acao: 'cancelar' }) }}
                    className="rounded-lg border border-[var(--fam-ambar-mid)] bg-[var(--prod-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--fam-ambar-ink)] disabled:opacity-50">
                    {porta.rotulo}
                  </button>
                )}
                {porta.acao === 'CONTINUA_DEPOIS' && (
                  <span className="inline-flex items-center gap-1.5">
                    <input type="date" aria-label="dia em que a produção continua" value={diaQueContinua}
                      onChange={(e) => setDiaQueContinua(e.target.value)}
                      className="rounded-lg border border-[var(--fam-ambar-mid)] bg-[var(--prod-surface)] px-2 py-1 text-xs" />
                    <button type="button" disabled={busy || !diaQueContinua}
                      onClick={async () => { if (await acao({ acao: 'continua-depois', diaPrevisto: diaQueContinua })) setDiaQueContinua('') }}
                      className="rounded-lg border border-[var(--fam-ambar-mid)] bg-[var(--prod-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--fam-ambar-ink)] disabled:opacity-40">
                      {porta.rotulo}
                    </button>
                  </span>
                )}
                {/* ⚠️ o EFEITO à vista: escolher sem saber o que acontece com o insumo é o
                    que faz o dono não escolher nada e o lote ficar parado mais um dia */}
                <span className="text-[11px] leading-snug text-[var(--fam-ambar-ink)]">{porta.efeito}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/**
        * ⭐⭐ A BARRA DE PROGRESSO (item 2): 4 segmentos pintados de índigo até o estado atual,
        * ✓ nos passados, apagados nos futuros.
        *
        * ⛔ Quem decide o que é feito/atual/futuro é a LIB — inclusive a borda que importa:
        * **CANCELADA não desenha barra**, porque ela é a ordem saindo do trilho e pintar 1 de 4
        * diria *"está no começo"* numa ordem que acabou.
        * ⚠️ `role="progressbar"` com os valores: a barra tem que dizer o progresso pra quem usa
        * leitor de tela, não só pra quem vê a cor.
        */}
      {trilho.mostrar && (
        <div className="print:hidden" role="progressbar" aria-valuemin={1} aria-valuemax={4}
          aria-valuenow={trilho.pintados}
          aria-valuetext={`${trilho.segmentos.find((x) => x.atual)?.rotulo ?? ''} — passo ${trilho.pintados} de 4`}>
          <div className="flex gap-1.5">
            {trilho.segmentos.map((seg) => (
              <div key={seg.passo} className="h-[5px] flex-1 rounded-full"
                style={{ background: seg.futuro ? 'var(--prod-surface-2)' : 'var(--fam-indigo-mid)' }} />
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 text-[11.5px]">
            {trilho.segmentos.map((seg) => (
              <span key={seg.passo} className="flex flex-1 items-center gap-1 truncate"
                style={{
                  color: seg.atual ? 'var(--fam-indigo-ink)' : seg.feito ? 'var(--prod-secondary)' : 'var(--prod-muted)',
                  fontWeight: seg.atual ? 500 : 400,
                }}>
                {/* ⚠️ o ✓ é SÓ do passado: no atual ele diria que já acabou */}
                {seg.feito && <Check className="h-3 w-3 shrink-0" style={{ color: 'var(--fam-verde-mid)' }} aria-hidden />}
                {seg.rotulo}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* separação */}
      <Card><CardContent className="p-0">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--prod-line)' }}>
          {/* ⭐ o TÍTULO diz o fato: o insumo SAIU da prateleira (não "está reservado") */}
          <p className="text-[15px] font-medium" style={{ color: 'var(--prod-primary)' }}>
            {planejada ? 'Separação (ajuste o que tirou da câmara)' : 'O que saiu da prateleira'}
          </p>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1 text-[12.5px] print:hidden" style={{ color: 'var(--prod-muted)' }}>
            <Printer className="h-3.5 w-3.5" /> imprimir
          </button>
        </div>

        {/* ⭐⭐ OS DOIS CAMPOS LIGADOS — o pedido central do dono (01/09):
            *"eu falo pro funcionário 'faz 200 porções'. Ele precisa saber QUANTOS KG PEGAR.
            Hoje ele faz a conta de cabeça e depois digita o kg. O sistema tem que fazer a conta."*
            Digitar em cima preenche TODAS as linhas de insumo; digitar numa linha recalcula
            o de cima. Mesma régua nos dois sentidos, senão a ida-e-volta não fecha. */}
        {planejada && (
          <div className="border-b border-[var(--prod-line)] bg-[var(--prod-surface-1)] p-4 print:hidden">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <label className="text-xs text-[var(--prod-muted)]">
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
                    className="w-28 rounded-lg border border-[var(--prod-line-strong)] py-1.5 px-2 text-right text-base font-semibold tabular-nums"
                  />
                  <span className="text-sm text-[var(--prod-muted)]">{ordem.unidadeProduzido}</span>
                </div>
              </label>

              <div className="min-w-[15rem] text-xs">
                <p className="text-[var(--prod-muted)]">Preciso tirar</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--prod-primary)]">
                  {linhas.length === 0 ? '—' : linhas.map((l) => `${formatarQtd(parseNum(sep[l.itemId]), l.unidade)} de ${l.nome.toLowerCase()}`).join(' · ')}
                </p>
                {/* ⛔ A frase diz a VERDADE da conta: é a receita. O espelho vem depois. */}
                <p className="mt-0.5 text-[11px] text-[var(--prod-muted)]">
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
                  <p className="text-[var(--prod-muted)]">Com isso deve sair</p>
                  <p className="text-lg font-semibold tabular-nums text-[var(--prod-primary)]">
                    ~{num(Math.round(previsao.esperadoDaFicha))} <span className="text-sm font-normal text-[var(--prod-muted)]">{ordem.unidadeProduzido}</span>
                  </p>
                  {/* ⭐ ESPELHO: o que a sua média diria — informação, não meta. */}
                  {previsao.medido != null && espelho && (
                    <p className="text-[11px] text-[var(--prod-muted)]">~{num(Math.round(previsao.medido))} pela sua média de {espelho.lotes} lotes</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/**
          * ⭐⭐⭐ UMA COLUNA SÓ (item 3, decisão do dono): *"as colunas PLANEJADO × EM PRODUÇÃO
          * morrem — eram o mesmo número"*. E é verdade medida: fora do estado PLANEJADA, o
          * `qtdSeparada` É o que está em produção (nada volta), então duas colunas repetiam o
          * mesmo valor e faziam o olho procurar a diferença que não existe.
          *
          * ⛔⛔ **E O "DEVOLVER" SAIU DA TELA** — *"nunca usado; botão morto = clique errado
          * esperando"*. ⚠️ A CAPACIDADE fica: a rota `devolver` e o `devolverInsumo` seguem
          * vivos (o cancelamento devolve tudo por ali, e é o que mantém o invariante **P1** de
          * pé). O que morreu é a tela OFERECER — é o mesmo tratamento do bloco de avisos
          * guardado em 04/10: remoção da vitrine, não da função.
          */}
        <ul>
          {linhas.map((l, k) => {
            const sepQtd = parseNum(sep[l.itemId])
            const faltou = planejada && sepQtd > l.saldoDisponivel + 0.001
            return (
              <li key={l.itemId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-[13px]"
                style={k > 0 ? { borderTop: '1px solid var(--prod-line-strong)' } : undefined}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                    {l.nome}
                  </span>
                  {/**
                    * ⚠️ A SUBLINHA guarda o que a coluna perdida dizia: custo por unidade,
                    * estoque, e — **só no modo de separar** — o que a FICHA pedia. *Remoção sem
                    * realocação é perda*; aqui o número continua, no tom de apoio.
                    */}
                  <span className="block truncate text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                    {l.custoMedio != null ? `${formatBRL(l.custoMedio)}/${l.unidadeControle}` : 'sem custo (a definir)'}
                    {' · estoque '}
                    <span className="num" style={{ color: l.saldoDisponivel < 0 ? 'var(--fam-coral-mid)' : 'var(--prod-muted)' }}>
                      {num(l.saldoDisponivel)}
                    </span>
                    {planejada && ` · pela ficha ${formatarQtd(l.qtdPlanejada, l.unidade)}`}
                  </span>
                </span>

                {/* ⭐ UM número à direita — e no modo de separar ele é o campo editável */}
                {planejada ? (
                  <span className="ml-auto flex items-center gap-1.5 pl-[60px] lg:ml-0 lg:pl-0">
                    <span className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>separar</span>
                    <input value={sep[l.itemId] ?? ''} onChange={(e) => setSep((st) => ({ ...st, [l.itemId]: e.target.value }))}
                      aria-label={`quanto separar de ${l.nome}`} inputMode="decimal"
                      className="num w-24 rounded-lg py-1.5 px-2 text-right text-sm"
                      style={{
                        border: `1px solid ${faltou ? 'var(--fam-coral-mid)' : 'var(--prod-line-strong)'}`,
                        background: faltou ? 'var(--fam-coral-bg)' : 'var(--prod-surface)',
                        color: 'var(--prod-primary)',
                      }} />
                    <span className="w-7 text-[12px]" style={{ color: 'var(--prod-muted)' }}>{l.unidade}</span>
                  </span>
                ) : (
                  <span className="num ml-auto whitespace-nowrap pl-[60px] text-right lg:ml-0 lg:pl-0">
                    {/* ⭐ CONCLUÍDA: o rótulo vira "consumido" — o insumo já virou produto */}
                    <span className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                      {ordem.estado === 'CONCLUIDA' ? 'consumido ' : 'separado '}
                    </span>
                    <span className="text-[15px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                      {formatarQtd(l.qtdSeparada, l.unidade)}
                    </span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {/* ⭐ o rodapé do cartão — `formatBRL`, o formatador da casa (o "R$ 638,5" de 04/10
            nasceu de formatar moeda à mão) */}
        <div className="flex items-center justify-between p-4 text-[13.5px]"
          style={{ borderTop: '1px solid var(--prod-line-strong)' }}>
          <span style={{ color: 'var(--prod-secondary)' }}>
            Custo {planejada ? 'a separar' : ordem.estado === 'CONCLUIDA' ? 'consumido' : 'em produção'}
          </span>
          <span className="num font-medium" style={{ color: 'var(--prod-primary)' }}>{formatBRL(custoSeparado)}</span>
        </div>
      </CardContent></Card>

      {/* dependência entre ordens: componente PRODUZIDO faltando → "produzir antes" (aviso + link, sem orquestração automática) */}
      {planejada && (() => {
        const faltas = linhas.filter((l) => l.fichaIdComponente && l.saldoDisponivel < parseNum(sep[l.itemId] ?? String(l.qtdPlanejada)) - 0.001)
        if (!faltas.length) return null
        return (
          <div className="rounded-lg border border-[var(--fam-ambar-mid)] bg-[var(--fam-ambar-bg)] p-3 text-xs text-[var(--fam-ambar-ink)] print:hidden">
            <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Falta insumo produzido pra esta ordem:</p>
            {faltas.map((l) => (
              <div key={l.itemId} className="flex items-center justify-between py-0.5">
                <span>{l.nome}: tem {formatarQtd(l.saldoDisponivel, l.unidade)}, precisa {formatarQtd(parseNum(sep[l.itemId] ?? String(l.qtdPlanejada)), l.unidade)}</span>
                <button onClick={() => produzirAntes(l.fichaIdComponente!)} disabled={busy} className="ml-2 inline-flex items-center gap-1 rounded border border-[var(--fam-ambar-mid)] px-2 py-0.5 text-[11px] font-medium text-[var(--fam-ambar-ink)] hover:bg-[var(--fam-ambar-bg)] disabled:opacity-50"><Factory className="h-3 w-3" /> produzir antes</button>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ⚠️ linhas desencontradas — em UNIDADES, nunca em "×" (o dono não fala em escala) */}
      {desencontro && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--fam-ambar-mid)] bg-[var(--fam-ambar-bg)] p-3 text-xs text-[var(--fam-ambar-ink)] print:hidden">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            O que você separou não está parelho: <strong>{desencontro.max.nome}</strong> dá pra ~{num(Math.round(desencontro.max.saida))} e{' '}
            <strong>{desencontro.min.nome}</strong> só pra ~{num(Math.round(desencontro.min.saida))} {ordem.unidadeProduzido}. Confere se faltou separar algo —
            dá pra seguir assim, o rendimento vai contra o que você separou de verdade.
          </span>
        </div>
      )}

      {erro && <p className="text-sm text-[var(--fam-coral-ink)]">{erro}</p>}

      {/**
        * ⭐⭐ AS AÇÕES (item 4): **a principal é um botão índigo forte; cancelar é contorno
        * discreto.** ⛔ Dois botões fortes competindo fazem a ação principal deixar de ser
        * óbvia — é a mesma régua do *"um primário só"* da home.
        *
        * ⚠️ E a principal **muda com o estado**: planejada → confirmar a separação; separada →
        * iniciar; **em produção → concluir** (que é o formulário logo abaixo, por isso o
        * primário aqui é a âncora pra ele, não um 2º caminho de gravação).
        */}
      {!encerrada && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {planejada && (
            <button onClick={confirmarSeparacao} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-60"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar separação
            </button>
          )}
          {separada && (
            <button onClick={() => acao({ acao: 'iniciar' })} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-60"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />} Iniciar produção
            </button>
          )}
          {ordem.estado === 'EM_PRODUCAO' && (
            <a href="#concluir"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              <Check className="h-4 w-4" /> Concluir produção
            </a>
          )}
          {/* ⚠️ CANCELAR é contorno, nunca preenchido: ele existe e não convida */}
          <button onClick={() => { if (confirm('Cancelar a ordem? Os insumos separados voltam pro estoque.')) acao({ acao: 'cancelar' }) }}
            disabled={busy}
            className="rounded-lg border px-4 py-2 text-[13px] disabled:opacity-50"
            style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
            Cancelar ordem
          </button>
        </div>
      )}

      {/* ⭐⭐ ETAPAS — quem faz cada parte (06/09). Fica ANTES da conclusão porque é o
          trabalho acontecendo; a conclusão é o fecho. */}
      <EtapasDaOrdem id={id} ordemId={ordemId} colaboradores={colaboradores} aoSaberQuemProduziu={setQuemProduziu} aoSaberAbertas={setEtapasAbertas} />

      {/* conclusão ("quantos saíram?") — ⭐ a âncora é o alvo da 1ª porta do aviso */}
      <div id="concluir" />
      {emProducao && (
        <ConclusaoForm
          id={id} ordemId={ordemId} linhas={linhas} etapasAbertas={etapasAbertas}
          quemProduziu={quemProduziu}
          /* ⚠️ o dropdown só existe quando NINGUÉM assinou — e "ninguém" é derivado dos nomes */
          colaboradores={quemProduziu.length > 0 ? [] : colaboradores}
          nomeProduzido={ordem.nomeProduzido} pedido={pedido}
          /* ⭐ o MESMO número do rodapé do cartão de insumos — nunca uma 2ª conta */
          custoLote={custoSeparado}
          unidadeProduzido={ordem.unidadeProduzido} onConcluida={carregar}
        />
      )}

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
            <h2 className="text-sm font-semibold text-[var(--prod-primary)]">Eficiência desta ordem</h2>
            <span className={`rounded-xl px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
              eficiencia.faixa === 'ABAIXO' ? 'bg-[var(--fam-coral-bg)] text-[var(--fam-coral-ink)]'
                : eficiencia.faixa === 'ACIMA' ? 'bg-[var(--fam-azul-bg)] text-[var(--fam-azul-ink)]'
                  : 'bg-[var(--fam-verde-bg)] text-[var(--fam-verde-ink)]'}`}>
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
            <span className="text-xs text-[var(--prod-muted)]">
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
              className={`mt-1 text-xs ${eficiencia.fiscal.impossivel ? 'font-medium text-[var(--fam-coral-ink)]' : 'text-[var(--prod-muted)]'}`}
            >
              {fraseDoFiscal(eficiencia.fiscal, eficiencia.produzido, ordem.unidadeProduzido)}
            </p>
          )}
          {/* ⚠️ A FRASE SÓ NO LADO DE BAIXO: render acima do prometido não é prejuízo (é ficha
              generosa), e cobrar explicação ali treinaria o dono a ignorar o bloco. */}
          {eficiencia.alerta && (
            <p className="mt-1 text-xs text-[var(--fam-coral-ink)]">
              Saiu menos do que a receita promete — confira a operação, a sobra não contada, ou mude a ficha se a perda é real.
            </p>
          )}
          <table className="density-normal mt-2.5 w-full">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-[var(--prod-muted)]">
              <th className="px-3 py-2 font-medium">Componente</th>
              <th className="px-3 py-2 text-right font-medium">Plano (ficha)</th>
              <th className="px-3 py-2 text-right font-medium">Real (consumido)</th>
              <th className="px-3 py-2 text-right font-medium">Diferença</th>
            </tr></thead>
            <tbody>
              {eficiencia.componentes.map((c) => (
                <tr key={c.nome} className="border-t border-[var(--prod-line)]">
                  <td className="px-3 py-0 text-[14px] font-medium text-[var(--prod-primary)]">{c.nome}</td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-[var(--prod-secondary)]">{formatarQtd(c.plano, c.unidade)}</td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-[var(--prod-secondary)]">{formatarQtd(c.real, c.unidade)}</td>
                  {/* ⚠️ ZERO não ganha cor: consumir exatamente a ficha é o normal, e pintar
                      o normal é o que faz ninguém mais ver a cor que importa. */}
                  <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${
                    Math.abs(c.gap) < 0.0001 ? 'text-[var(--prod-muted)]' : c.gap > 0 ? 'text-[var(--fam-coral-ink)]' : 'text-[var(--fam-azul-ink)]'}`}>
                    {Math.abs(c.gap) < 0.0001 ? '—' : `${c.gap > 0 ? '+' : '−'}${formatarQtd(Math.abs(c.gap), c.unidade)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-[var(--prod-muted)]">
            O plano é a receita × o que esta ordem pediu. A separação nunca foi ajustada pela medição — se a perda é real, mude a ficha.
          </p>
        </CardContent></Card>
      )}

      {/* histórico de conclusões + etiquetas */}
      {conclusoes.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--prod-primary)]">Conclusões ({conclusoes.length})</h2>
          <div className="space-y-2">
            {conclusoes.map((c) => {
              const conf = c.conferencia
              /**
               * ⭐⭐⭐ A PORTA GERAL DA CORREÇÃO (item 3, 09/10) — **caso a caso, nunca em lote.**
               *
               * **Ordem do dono:** *"é o caminho pra eu finalmente corrigir as 2 ordens de
               * 22.864 e o 320% da NATHALIA — eu decidindo na tela, com preview e rastro."*
               *
               * ⛔ Só aparece pra quem GERENCIA (a trava de verdade é o servidor: `stock.manage`
               * + PIN + a regra dos quatro olhos; isto aqui é só não oferecer o que levaria 403).
               * ⚠️ E só na conclusão que **ainda não tem carimbo**: a já conferida é recusada
               * pelo motor (`JA_CONFERIDA`) porque o carimbo é único por conclusão — oferecer o
               * botão ali seria mandar o dono clicar pra levar um "não".
               */
              const podeCorrigir =
                !carregandoPerm && podePerm('stock.manage') &&
                (conf == null || conf.estado === 'AGUARDANDO_CONFERENCIA')
              const abertoAqui = corrigindo === c.id
              return (
              <Card key={c.id}><CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--prod-primary)]">{num(c.qtdGerada)} {ordem.unidadeProduzido} {c.parcial && <span className="text-[11px] font-normal text-[var(--fam-ambar-ink)]">(parcial)</span>}</p>
                  <p className="text-xs text-[var(--prod-muted)]">rendimento {num(c.rendimento)}/receita · custo {c.custoUnitarioReal == null ? '—' : formatBRL(c.custoUnitarioReal)}/un{c.colaboradorNome ? ` · ${c.colaboradorNome}` : ''}{c.validadeAte ? ` · val ${fmtDia(c.validadeAte)}` : ''}</p>
                  {/* ⭐ O SELO (item 2c) na página da ordem — a MESMA leitura da lista de concluídas */}
                  {conf && <SeloDaConferencia c={conf} unidade={ordem.unidadeProduzido} />}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {podeCorrigir && !abertoAqui && (
                    <button type="button" onClick={() => { setCorrigindo(c.id); setFeitoConf(null) }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--prod-line-strong)] px-3 py-1.5 text-xs text-[var(--prod-primary)] hover:bg-[var(--prod-surface-1)]">
                      <Pencil className="h-3.5 w-3.5" /> corrigir
                    </button>
                  )}
                  <a href={`/empresas/${id}/estoque/producao/conclusoes/${c.id}/etiqueta`} className="inline-flex items-center gap-1 rounded-lg border border-[var(--prod-line-strong)] px-3 py-1.5 text-xs text-[var(--prod-secondary)] hover:bg-[var(--prod-surface-1)]"><Tag className="h-3.5 w-3.5" /> etiqueta</a>
                </div>
                </div>

                {abertoAqui && (
                  /** ⛔ O MESMO painel da «Conferência do dia» — extraído, nunca copiado */
                  <PainelDeConferencia
                    id={id}
                    alvo={{
                      conclusaoId: c.id,
                      produto: ordem.nomeProduzido,
                      unidade: ordem.unidadeProduzido,
                      declarado: c.qtdGerada,
                      declaradoTxt: num(c.qtdGerada),
                    }}
                    somenteCorrigir
                    onFeito={(frase) => { setFeitoConf(frase); setCorrigindo(null); void carregar() }}
                    onFechar={() => setCorrigindo(null)}
                  />
                )}
              </CardContent></Card>
              )
            })}
            {feitoConf && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}>{feitoConf}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ⭐⭐⭐ A MODAL DE CONCLUIR — v4 (05/10/2026): **uma pergunta, dois custos, um botão.**
 *
 * **Ordem do dono:** *"Cabeçalho: logo + «Concluir produção» + sublinha «nome · pedido N UN».
 * A PERGUNTA: «Quantas unidades saíram?» com campo GRANDE. CUSTO AO VIVO: «custo deste lote»
 * (fixo) e «custo por unidade» RECALCULANDO enquanto digita. Quem produziu: linha discreta
 * «produzido por X e Y (das etapas)». Botão primário índigo + «voltar» contorno."*
 *
 * ⛔⛔⛔ **A REGRA DE SEGURANÇA QUE GOVERNA ESTA TELA (ordem do dono, 05/10):** *"NENHUM número
 * esperado/sugerido/médio aparece na tela de conclusão pra quem declara. É cola de prova —
 * ensina qual número digitar pro fiscal não pegar."*
 *
 * Morreram daqui, por isso: *"a receita promete ~61 · a sua média daria ~72 (N lotes)"* (a
 * previsão ANTES do digitado) **e** o bloco de veredito *"93% do que a receita promete · sua
 * média é 102%"* (que nomeia os dois números proibidos). ⭐ A régua dos líderes (SAP/Oracle/
 * Katana) é a mesma: **aviso vem DEPOIS do digitado, nunca sugestão antes** — e aqui "depois"
 * é o fiscal, que segue conferindo **em silêncio** e acusando no pontinho da lista, no sininho
 * e na página da ordem. ⚠️ O P8 e `fiscalDoDeclarado` seguem **intocados por baixo**.
 *
 * ⚠️⚠️ **E A APARIÇÃO CONDICIONAL DO CAMPO DE MOTIVO ERA, ELA PRÓPRIA, UM VAZAMENTO:** ele só
 * nascia quando o desvio estourava a faixa, então *"o campo apareceu"* dizia **"seu número está
 * fora"** sem escrever número nenhum — convite a corrigir o digitado. Agora ele é
 * **incondicional e sem juízo**: a capacidade fica (a rota grava, a ordem exibe) e o
 * canal lateral fecha. *Remoção sem realocação é perda; manter a faixa seria manter a cola.*
 */
function ConclusaoForm({ id, ordemId, linhas, colaboradores, etapasAbertas, quemProduziu, nomeProduzido, pedido, custoLote, unidadeProduzido, onConcluida }: {
  id: string; ordemId: string; linhas: Linha[]; colaboradores: Colaborador[]
  etapasAbertas: EtapaAbertaNaTela[]
  /** ⭐ os nomes vêm DAS ETAPAS (o payload que o componente de etapas já buscou) */
  quemProduziu: string[]
  nomeProduzido: string
  pedido: { unidades: number | null; origem: 'DECLARADO' | 'DERIVADO' | null } | null
  /**
   * ⭐⭐ O CUSTO DO LOTE VEM DE CIMA — é **o MESMO número** do rodapé do cartão de insumos
   * (`custoSeparado`). Recalculá-lo aqui seria a 2ª conta do mesmo dinheiro, e as duas
   * divergiriam no 1º insumo sem custo médio.
   */
  custoLote: number
  unidadeProduzido: string; onConcluida: () => void
}) {
  const emProd = linhas.filter((l) => l.qtdSeparada > 0)
  const [qtdGerada, setQtdGerada] = useState('')
  const [colaboradorId, setColaboradorId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

  // ⭐ REGRA 4: a frase vem da MESMA função que o servidor usa pra descrever o encerramento —
  // duas redações divergiriam no dia em que uma delas mudasse.
  const avisoEtapas = avisoDeEtapasAbertas(etapasAbertas)
  const frasePessoas = fraseDeQuemProduziu(quemProduziu)

  const qg = parseNum(qtdGerada)
  /**
   * ⭐⭐ O CUSTO POR UNIDADE RECALCULA ENQUANTO ELE DIGITA — e o guard é duplo de propósito:
   * `qg > 0` mata a **divisão por zero** (campo vazio, "0", "abc") e `Number.isFinite` mata o
   * **NaN** que escaparia de um `Infinity` entrando no `Intl`. ⛔ Campo vazio é **"—"**, nunca
   * `R$ 0,00`: zero é uma afirmação, e dizer que a unidade custa zero é a pior delas numa tela
   * que existe pra medir custo.
   */
  const custoUnit = qg > 0 ? custoLote / qg : null
  const custoUnitTexto = custoUnit != null && Number.isFinite(custoUnit) ? formatBRL(custoUnit) : '—'

  const concluir = async () => {
    setErro(null)
    // ⛔ vazio / 0 / negativo / lixo digitado: erro INLINE, e nada é gravado
    if (!(qg > 0)) return setErro('Diga quantas unidades saíram — conte antes de concluir.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/concluir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        /**
         * ⭐⭐ O CONSUMO É O SEPARADO, sem perguntar de novo (decisão do dono: *"nunca
         * devolvem"*). ⚠️ E isso **fortalece o invariante P1** (`Σ separado == Σ consumido +
         * Σ devolvido`): com o campo editável, declarar consumo MENOR que o separado sem
         * devolver deixava material preso no armazém virtual — exatamente o vazamento que o
         * **P4** acusa. Agora o estado torto é inalcançável.
         *
         * ⚠️ `parcial` NÃO é mandado: o schema da rota o tem como **opcional**, então a
         * CAPACIDADE segue viva por trás (produção em dois dias) — só a tela deixa de oferecer
         * um checkbox que ninguém usava.
         */
        body: JSON.stringify({
          consumo: emProd.map((l) => ({ itemId: l.itemId, qtdConsumida: l.qtdSeparada })).filter((c) => c.qtdConsumida > 0),
          qtdGerada: qg,
          colaboradorId: colaboradorId || null,
          motivoDesvio: motivo.trim() || null,
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui concluir.'); return }
      // vai pra etiqueta e já manda pra Zebra (agente local) — a etiqueta sai na conclusão
      if (j?.conclusaoId) { window.location.href = `/empresas/${id}/estoque/producao/conclusoes/${j.conclusaoId}/etiqueta?print=zebra`; return }
      onConcluida()
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    // ⚠️ SEM `id="concluir"` AQUI: a âncora já existe no pai, logo acima — dois ids iguais no
    // documento fazem o navegador parar no primeiro, e o botão "Concluir produção" das ações
    // pularia pro lugar errado. Um id, um alvo.
    <Card style={{ borderColor: 'var(--fam-indigo-mid)' }}><CardContent className="space-y-4 p-4">
      {/* ⭐ CABEÇALHO: o MESMO logo da lista e da ordem (componente único) */}
      <div className="flex items-start gap-3">
        <LogoDaReceita nome={nomeProduzido} tamanho={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-medium leading-tight" style={{ color: 'var(--prod-primary)' }}>Concluir produção</p>
          {/**
            * ⛔⛔⛔ **O PEDIDO SÓ APARECE QUANDO É DECLARADO — e isto é um CONFLITO ENTRE DOIS
            * ITENS DO PEDIDO DO DONO, resolvido pela medição.**
            *
            * O item 1 pede a sublinha *"nome · pedido N UN"* com *"derivado = esperadas"*. O
            * item 2(b) proíbe **qualquer número esperado** nesta tela. ⚠️ Medido no código: o
            * pedido DERIVADO é `escalaReceitas × loteBase`, e `esperadoDaFicha` (o número que o
            * item 2(b) nomeia, e que o P8 usa de régua) é **`escala × teorico` — o MESMO
            * número**. Ou seja: *"pedido 61 UN esperadas"* É a cola de prova com outro rótulo,
            * e a palavra "esperadas" era o próprio sinal disso.
            *
            * ⭐ **DECLARADO é outra coisa:** é a ORDEM que o dono deu de boca (*"faz 200
            * porções"*) — informação que quem declara **já tem na cabeça**, então mostrá-la não
            * ensina nada novo; ela identifica o tamanho do lote que ele está fechando.
            *
            * ⚠️ **Sem pedido declarado a sublinha fica só com o nome da receita** — a ordem
            * continua identificada pelo logo e pelo nome, e nenhum número esperado entra.
            */}
          <p className="mt-0.5 truncate text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
            {nomeProduzido}
            {pedido?.origem === 'DECLARADO' && pedido.unidades != null && (
              <> · pedido {fmtPedido(pedido.unidades, unidadeProduzido)} {unidadeProduzido}</>
            )}
          </p>
        </div>
      </div>

      {/**
        * ⭐⭐⭐ A PERGUNTA — campo GRANDE, porque é a única coisa que esta tela pede.
        *
        * ⛔⛔ **O CAMPO NASCE E CONTINUA VAZIO** — regra dura do dono: *"a previsão SUGERE,
        * nunca preenche. Se preencher, todo mundo confirma o número sem contar."* Agora nem
        * sugere: o esperado saiu da tela inteira.
        */}
      <div>
        <label className="block text-[13px] font-medium" style={{ color: 'var(--prod-secondary)' }} htmlFor="qtd-saiu">
          Quantas unidades saíram?
        </label>
        <div className="mt-1.5 flex items-baseline gap-2">
          <input
            id="qtd-saiu" value={qtdGerada} onChange={(e) => setQtdGerada(e.target.value)}
            inputMode="decimal" placeholder="conte e digite" autoComplete="off"
            className="num w-40 rounded-xl px-3 py-2 text-[26px] font-medium"
            style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
          />
          <span className="text-[15px]" style={{ color: 'var(--prod-secondary)' }}>{unidadeProduzido}</span>
        </div>
      </div>

      {/**
        * ⭐⭐ OS DOIS CUSTOS — o do LOTE é fixo (o material já saiu da prateleira) e o POR
        * UNIDADE anda com o que ele digita. ⚠️ Os dois pelo `formatBRL`, o dono único do R$.
        */}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[9.5rem] flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--prod-surface-1)' }}>
          <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>custo deste lote</p>
          <p className="num text-[17px] font-medium" style={{ color: 'var(--prod-primary)' }}>{formatBRL(custoLote)}</p>
        </div>
        <div className="min-w-[9.5rem] flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--prod-surface-1)' }}>
          <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>custo por {unidadeProduzido}</p>
          <p className="num text-[17px] font-medium" style={{ color: 'var(--prod-primary)' }}>{custoUnitTexto}</p>
        </div>
      </div>

      {/**
        * ⭐⭐ QUEM PRODUZIU — a resposta JÁ EXISTE nas etapas (o PIN carimbou por etapa, com o
        * tempo de cada mão). ⛔ A **explicação** do PIN saiu (ordem do dono): ensinar o
        * mecanismo a quem acabou de usá-lo é ruído. ⚠️ O dropdown **permanece** na ordem antiga
        * sem etapa assinada — lá ninguém carimbou nada, e sem ele a conclusão ficaria sem dono.
        */}
      {frasePessoas ? (
        <p className="text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>{frasePessoas}</p>
      ) : colaboradores.length > 0 ? (
        <label className="block text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
          Quem produziu
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}
            className="mt-1 block rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}>
            <option value="">—</option>{colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      ) : null}

      {/**
        * ⭐ O MOTIVO — **incondicional e sem número**. Ver o bloco do topo: a aparição
        * condicional dele era o vazamento que a régua de segurança existe pra fechar.
        * ⚠️ Opcional de propósito: cobrar motivo em produção normal treina a pessoa a escrever
        * qualquer coisa, e aí o campo deixa de valer quando o desvio for de verdade.
        */}
      <label className="block">
        <span className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>Aconteceu alguma coisa? (opcional — fica gravado na ordem)</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="ex: queijo veio com muita casca"
          className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs"
          style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-secondary)' }} />
      </label>

      {/* ⛔⛔ O AVISO DO CAMINHO DO ENCARREGADO (06/09) — a fresta entre os dois caminhos.
          Concluir por aqui ENCERRA a etapa aberta sem tempo medido; ele precisa saber ANTES
          de apertar. ⚠️ E a frase ENSINA A SAÍDA ("peça pra finalizar no tablet primeiro"),
          porque aviso que só comunica um estrago treina a pessoa a ignorar. NÃO BLOQUEIA:
          quem decide é o encarregado.
          ⚠️⚠️ E ele NÃO é "número esperado": fala de TEMPO DE ETAPA, não de quanto deve sair —
          a régua de segurança proíbe a cola do rendimento, não o aviso de consequência. */}
      {avisoEtapas && (
        <div className="flex items-start gap-2 rounded-lg p-3 text-xs"
          style={{ border: '1px solid var(--fam-ambar-mid)', background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{avisoEtapas}</span>
        </div>
      )}

      {erro && <p className="text-sm" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>}

      {/* ⭐ UM primário índigo + "voltar" de contorno (a régua do "um primário só") */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={concluir} disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Concluir e gerar etiqueta
        </button>
        <a href={`/empresas/${id}/estoque/producao`}
          className="rounded-lg px-4 py-2 text-[13px]"
          style={{ border: '1px solid var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
          voltar
        </a>
      </div>
    </CardContent></Card>
  )
}
