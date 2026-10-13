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
import type { OrigemDoPedido } from '@/lib/stock/producao/pedido-da-ordem'
import type { OrdemView } from '@/lib/stock/producao/ordens'
import { tabelaDaPergunta, rotuloDoConfirmar, vereditoDaLinha } from '@/lib/stock/producao/pergunta-do-pedido'
import { avisosDaEscala } from '@/lib/stock/producao/escala-do-pedido'
import { fraseDoRetalho, linhaDoRetalho, fraseDaSeparacao } from '@/lib/stock/producao/retalho'
import { sanitizarQtd, valorQtd } from '@/lib/stock/quantidade'

interface Linha { itemId: string; nome: string; unidade: string; unidadeControle: string; porLote: number; qtdPlanejada: number; qtdSeparada: number; qtdConsumida: number; saldoDisponivel: number; custoMedio: number | null; fichaIdComponente: string | null }
/**
 * ⭐⭐ O TIPO DERIVA DO QUE O SERVIDOR DEVOLVE (`OrdemView`), em vez de ser reescrito à mão —
 * e isso paga a dívida registrada em 01/09: *"interface escrita à mão sobre payload é promessa,
 * não prova"*. Foi assim que o `.name` de uma relação nullable derrubou a carteira de
 * empréstimos com o `tsc` VERDE, e foi assim que a home PF leu `cards` de uma rota que devolvia
 * outra chave — 200, silêncio, widget vazio.
 *
 * ⚠️ Campo novo no servidor passa a existir aqui **de graça**; campo renomeado fica VERMELHO no
 * `tsc` em vez de virar `undefined` na tela.
 */
type Ordem = OrdemView
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

/**
 * ⚠️ `estornada` = declaração DESFEITA pela correção do gerente. Ela chega aqui de propósito
 * (o rastro é lei) e **não entra em soma nenhuma** — ver o `valem` lá embaixo.
 */
interface Conclusao { id: string; qtdGerada: number; colaboradorNome: string | null; rendimento: number; custoLoteReal: number; custoUnitarioReal: number | null; validadeAte: string | null; parcial: boolean; criadoEm: string; estornada?: boolean; conferencia: CarimboDaConclusao | null }
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
  /**
   * ⚠️ A ORIGEM **DERIVA DO TIPO DA LIB** — esta união estava digitada à mão e, ao nascer o
   * `AGUARDANDO`, a tela não conseguiria nem mencioná-lo (é a dívida de 01/09: *"interface
   * escrita à mão sobre payload é promessa, não prova"*).
   */
  const [pedido, setPedido] = useState<{ unidades: number | null; origem: OrigemDoPedido | null; comoSoube: string | null } | null>(null)
  const [diaQueContinua, setDiaQueContinua] = useState('')
  // ⛔ as etapas ABERTAS: concluir por aqui vai LEVÁ-LAS junto, sem tempo medido. O
  // encarregado tem que saber ANTES de apertar — escolha consciente, não efeito colateral.
  const [etapasAbertas, setEtapasAbertas] = useState<EtapaAbertaNaTela[]>([])
  const [rendimentoMedio, setRendimentoMedio] = useState<number | null>(null)
  const [rendimentoLotes, setRendimentoLotes] = useState(0)
  /**
   * ⭐⭐ O CAMPO DA PERGUNTA ÚNICA (11/10) — *"quantas unidades produzir?"*.
   *
   * ⚠️ Ele NASCE VAZIO, inclusive na correção: pré-preencher com o pedido anterior é confirmar
   * um número sem recontar (*"número sugerido vira número confirmado sem ninguém contar"* — a
   * régua do campo de conclusão, 05/10). O valor anterior aparece **ao lado**, como referência.
   */
  const [quanto, setQuanto] = useState('')
  /** ⭐ a correção aberta na MESMA tela (o dono pediu: *"pela MESMA tela"*) */
  const [corrigindoPedido, setCorrigindoPedido] = useState(false)
  /**
   * ⭐ o retalho de ontem — a pergunta mudou da criação pra cá (junto do número, porque é a
   * MESMA decisão). ⚠️ `temRetalho` nasce `null` (nem sim nem não) e o kg nasce VAZIO.
   */
  const [temRetalho, setTemRetalho] = useState<'NAO' | 'SIM' | null>(null)
  const [retalhoKg, setRetalhoKg] = useState('')
  const [retalho, setRetalho] = useState<{ aceita: boolean; pesoUnidadeG?: number; ultimoKg?: number | null; declaradoKg?: number | null } | null>(null)
  const [rastroPedido, setRastroPedido] = useState<Array<{ unidades: number; correcao: boolean; quem: string | null; quando: string }>>([])

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}`).then((r) => r.json()).then((j) => {
    if (!j.ordem) { setOrdem(null); return }
    setOrdem(j.ordem); setLinhas(j.linhas ?? [])
    setConclusoes(j.conclusoes ?? []); setColaboradores(j.colaboradores ?? []); setRendimentoMedio(j.rendimentoMedio ?? null); setRendimentoLotes(j.rendimentoLotes ?? 0)
    setParada(j.parada ?? null)
    setPedido(j.pedido ?? null)
    setRetalho(j.retalho ?? null); setRastroPedido(j.rastroPedido ?? [])
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

  /**
   * ⭐⭐⭐ O GESTO DA PERGUNTA ÚNICA — e ele tem **ROTA PRÓPRIA**, não o `/acao`.
   *
   * ⛔ Declarar o pedido não é uma transição de estado da ordem (separar/iniciar/cancelar):
   * é a ESCRITA do que o dono quer, e ela tem um writer único (`confirmarPedido`) que grava
   * a meta, o rastro e a escala na MESMA transação. Enfiá-la no `/acao` faria o switch dos
   * gestos virar o 2º lugar que escreve o pedido — exatamente o fantasma que morreu hoje.
   *
   * ⚠️ `retalhoKg` só viaja quando a resposta é **SIM com kg** — `null` APAGA o retalho de uma
   * declaração anterior (corrigir pra "não tem" tem que tirar o bônus), e por isso a ausência
   * da resposta nunca pode ser confundida com um "não".
   */
  const confirmarPedido = async () => {
    const un = valorQtd(quanto)
    if (un == null || !(un > 0)) { setErro('Diga quantas unidades produzir.'); return }
    /**
     * ⛔⛔ AS TRÊS RESPOSTAS DO RETALHO — e a do meio é a que o defeito de 12/10 criou:
     *   · não respondeu (`temRetalho === null`) → **o campo não viaja** → o servidor MANTÉM o
     *     que estava. Como o campo nasce vazio inclusive na correção, *"não respondi"* é o caso
     *     COMUM de quem só queria corrigir o número — e mandar `null` ali **apagava os 10 KG**;
     *   · *"Não tem"* → manda `null` → apaga (resposta explícita);
     *   · *"Sim" + kg* → manda o kg.
     */
    const kg = temRetalho === 'SIM' ? valorQtd(retalhoKg) : null
    const respondeu = temRetalho !== null
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/pedido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unidades: un,
          ...(respondeu ? { retalhoKg: kg && kg > 0 ? kg : null } : {}),
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui gravar o pedido.'); return }
      /** ⭐ a página vira a ordem normal de hoje: a pergunta sai da tela e a separação entra */
      setCorrigindoPedido(false); setQuanto(''); setTemRetalho(null); setRetalhoKg('')
      carregar()
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
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

  /**
   * ⭐⭐⭐ A PERGUNTA ÚNICA (11/10) — *"quantas unidades produzir?"*.
   *
   * ⛔ A tabela vem da LIB (`tabelaDaPergunta`), que chama a **porta da separação**
   * (`insumoDoPedido`). Multiplicar `dose × pedido` aqui seria a 2ª conta: a tela prometeria um
   * material e a ordem separaria outro — e o dono descobriria com a carne na mão.
   */
  const aguardando = pedido?.origem === 'AGUARDANDO'
  /**
   * ⛔⛔⛔ FICHA PENDENTE: A PÁGINA **NÃO PERGUNTA** (11/10, item 2b).
   *
   * **Ordem do dono:** *"a ficha é a ÚNICA casa do número (writer único)"* — *"nada de pergunta
   * na ordem, nada de config paralela"*. Enquanto a ficha não disser quantas unidades saem de 1
   * receita, perguntar o PEDIDO aqui seria pedir um número que o sistema não tem como dividir:
   * `escala = pedido ÷ loteBase`, e o `loteBase` está declarado na unidade errada.
   *
   * ⚠️ **E o veredito vem do SERVIDOR** (`ordem.rendimentoPendente`), nunca de uma comparação
   * aqui: duas réguas fariam a ordem cobrar o que o sininho considera resolvido.
   */
  const esperaRendimento = !!ordem?.rendimentoPendente
  const perguntando = ordem?.estado === 'PLANEJADA' && !esperaRendimento && (aguardando || corrigindoPedido)
  const pedidoNum = valorQtd(quanto)
  const tabela = useMemo(
    () => tabelaDaPergunta(
      linhas.map((l) => ({
        itemId: l.itemId, nome: l.nome, unidade: l.unidade,
        porLote: l.porLote, saldo: l.saldoDisponivel, custoMedio: l.custoMedio,
      })),
      pedidoNum, ordem?.loteBase ?? 1,
    ),
    [linhas, pedidoNum, ordem?.loteBase],
  )
  /**
   * ⭐⭐ O AVISO DO ATO DA CRIAÇÃO (03/10) **MUDOU DE TELA COM O NÚMERO** — ele é sobre o
   * pedido, então vive onde o pedido é digitado. *Remoção sem realocação é perda*, e deixá-lo na
   * criação (que não pergunta mais quantidade) o tornaria inalcançável.
   */
  const maiorDose = useMemo(
    () => linhas.reduce<{ nome: string; dose: number } | null>(
      (m, c) => (!m || c.porLote > m.dose ? { nome: c.nome, dose: c.porLote } : m), null),
    [linhas],
  )
  const avisosPergunta = useMemo(
    () => (ordem && pedidoNum != null && pedidoNum > 0
      ? avisosDaEscala({
          pedido: pedidoNum, loteBase: ordem.loteBase, unidadeLoteBase: ordem.unidadeLoteBase,
          unidadeProduto: ordem.unidadeProduzido, maiorDose, espelho,
        })
      : []),
    [ordem, pedidoNum, maiorDose, espelho],
  )
  /**
   * ⭐⭐⭐ A LINHA DO RETALHO (12/10) — *"10 UN pedidas · retalho de ontem: 10 KG → +50 UN"*.
   *
   * ⛔ Ela sai da LIB, nunca de uma conta aqui: o bônus é o MESMO `unidadesDoRetalho` que o
   * fiscal usa pra achar o `permitido`. Uma divisão por 200 no JSX seria a 2ª régua, e ela
   * divergiria do fiscal no dia em que o dono mudar o peso da metade na ficha.
   *
   * ⚠️ Vale em TODO estado (é por isso que a rota passou a mandar o `declaradoKg` sempre): o
   * defeito do dono era justamente o retalho invisível numa ordem que não estava em PLANEJADA.
   */
  const linhaRet = useMemo(
    () => (ordem
      ? linhaDoRetalho({
          aceita: !!retalho?.aceita, kg: retalho?.declaradoKg ?? null,
          pesoUnidadeG: retalho?.pesoUnidadeG ?? null, unidade: ordem.unidadeProduzido,
        })
      : null),
    [ordem, retalho],
  )

  /** ⭐ a frase curta do retalho — *"vai sair ~246 UN no total"* (a conta mora na lib) */
  const fraseRet = useMemo(
    () => (ordem && retalho?.aceita && temRetalho === 'SIM'
      ? fraseDoRetalho({
          pedido: pedidoNum, kg: valorQtd(retalhoKg),
          pesoUnidadeG: retalho.pesoUnidadeG ?? null, unidade: ordem.unidadeProduzido,
        })
      : null),
    [ordem, retalho, temRetalho, pedidoNum, retalhoKg],
  )

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
  /**
   * ⭐⭐⭐ AS CONCLUSÕES QUE **VALEM** (12/10) — a declaração desfeita pela correção do gerente
   * fica na lista como HISTÓRIA e **sai de toda SOMA**.
   *
   * ⛔⛔ Sem isto a própria página da ordem dizia *"fez 68,53"* (34,236 + 34,296) e a eficiência
   * comparava o dobro do que saiu contra o material de um lote — o fiscal acusaria um lote
   * CERTO. É o mesmo defeito da lista do dia, por dentro.
   */
  const valem = useMemo(() => conclusoes.filter((c) => !c.estornada), [conclusoes])

  const eficiencia = useMemo(() => {
    if (!ordem || ordem.estado !== 'CONCLUIDA' || !valem.length) return null
    const saiu = valem.reduce((s, c) => s + c.qtdGerada, 0) // ⭐ soma as parciais
    return eficienciaDaOrdem({
      escala: ordem.escalaReceitas, loteBase: ordem.loteBase, qtdGerada: saiu,
      componentes: linhas.map((l) => ({ nome: l.nome, unidade: l.unidade, porLote: l.porLote, consumido: l.qtdConsumida })),
    })
  }, [ordem, valem, linhas])

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
              * ⭐⭐⭐ O RETALHO DE ONTEM — *"retalho de ontem: 10 KG → +50 UN"* (12/10).
              *
              * ⛔⛔ **A ausência tem DUAS saídas, nunca o silêncio:** receita que aceita e ordem
              * sem retalho diz *"sem retalho declarado"* (cinza, discreto) — senão "nada na tela"
              * significaria *"não declarei"* E *"a receita não aceita"*, e o dono ficaria na
              * dúvida justo quando esqueceu de declarar. Receita que não aceita: a lib devolve
              * `null` e aqui nada aparece, como sempre foi.
              *
              * ⚠️ **NÃO é cola de prova** (a lei de 05/10): o bônus é a conversão do kg que ELE
              * pesou pela régua que ELE declarou na ficha — não é o que a ficha promete nem a
              * média histórica. A modal de conclusão segue intocada.
              */}
            {linhaRet && (
              <p className="mt-0.5 text-[12px]"
                style={{ color: linhaRet.declarado ? 'var(--fam-indigo-ink)' : 'var(--prod-muted)' }}>
                {linhaRet.texto}
              </p>
            )}

            {/**
              * ⭐⭐⭐ ORDEM CONCLUÍDA (item 6): o par *"pedido 305 · fez X"* + a pílula
              * **"N% do pedido"** — da MESMA lib da lista (`pilulaDoPedido`). ⛔ Ela não é o
              * fiscal nem o P8: o bloco de eficiência/fiscal segue embaixo, intocado.
              * ⚠️ Soma as PARCIAIS (`qtdGerada`), porque uma ordem pode fechar em dois dias.
              */}
            {(() => {
              if (ordem.estado !== 'CONCLUIDA' || !valem.length) return null
              /** ⛔ as que VALEM: somar a desfeita diria "fez 68,53" num dia de 34,30 */
              const fez = valem.reduce((t, c) => t + c.qtdGerada, 0)
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

      {/**
        * ⛔⛔⛔ A FICHA AINDA NÃO DIZ O RENDIMENTO — o LINK, nunca a pergunta (item 2b).
        *
        * ⚠️ E ele leva pra a ficha **com o campo aceso** (`?foco=rendimento`) e com o caminho de
        * VOLTA pra esta ordem (`?voltar=`): perder no caminho a informação que a tela acabou de
        * dar é obrigar o dono a procurar de novo (o defeito do Bamberg, 13/09).
        */}
      {esperaRendimento && ordem?.estado === 'PLANEJADA' && (
        <Card style={{ borderColor: 'var(--fam-ambar-mid)' }}><CardContent className="space-y-2 p-4">
          <p className="text-[15px] font-medium" style={{ color: 'var(--fam-ambar-ink)' }}>
            Esta ficha ainda não diz quantas {ordem.unidadeProduzido} rendem de 1 receita
          </p>
          <p className="text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
            {ordem.rendimentoPendente!.porQue} Sem esse número não dá pra dividir o pedido na
            separação — por isso a pergunta mora na ficha, uma vez, e não aqui a cada ordem.
          </p>
          <a
            href={`/empresas/${id}/estoque/fichas/${ordem.fichaId}?foco=rendimento&voltar=${encodeURIComponent(`/empresas/${id}/estoque/producao/${ordemId}`)}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium"
            style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}
          >
            completar a ficha →
          </a>
        </CardContent></Card>
      )}

      {/* ⭐⭐⭐ A PERGUNTA ÚNICA DO PEDIDO (11/10) — "quantas unidades produzir?" */}
      {perguntando && (
        <Card style={{ borderColor: 'var(--fam-indigo-mid)' }}><CardContent className="space-y-4 p-4">
          <div>
            <p className="text-[17px] font-medium" style={{ color: 'var(--prod-primary)' }}>
              Quantas unidades produzir?
            </p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
              {corrigindoPedido
                ? 'corrigir o pedido — ainda dá, porque nada foi separado'
                : 'a prateleira está do lado: digite e confira o que vai sair'}
            </p>
          </div>

          {/* ⭐ O CAMPO GRANDE (24px tabular) — nasce VAZIO, mesmo na correção */}
          <div className="flex items-end gap-2">
            <input
              aria-label="quantas unidades produzir"
              inputMode="decimal" autoFocus
              value={quanto}
              onChange={(e) => setQuanto(sanitizarQtd(e.target.value, ordem.unidadeProduzido))}
              placeholder="0"
              className="w-[160px] rounded-md px-3 py-2 text-[24px] font-medium tabular-nums outline-none"
              style={{ border: '1px solid var(--prod-line)', background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }}
            />
            <span className="pb-2 text-[14px]" style={{ color: 'var(--prod-muted)' }}>{ordem.unidadeProduzido}</span>
          </div>

          {/* ⭐⭐ A TABELA AO VIVO — INSUMO · VAI TIRAR · NA PRATELEIRA · veredito.
              ⛔ "vai tirar" vem da PORTA DA SEPARAÇÃO (tabelaDaPergunta → insumoDoPedido):
                 nunca uma 2ª derivação, senão a tela promete um material e a ordem separa outro. */}
          <div className="overflow-hidden rounded-md" style={{ border: '1px solid var(--prod-line)' }}>
            <table className="density-normal w-full">
              <thead>
                <tr style={{ background: 'var(--prod-surface-1)' }}>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>insumo</th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>vai tirar</th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>na prateleira</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>dá?</th>
                </tr>
              </thead>
              <tbody style={{ opacity: tabela.semNumero ? 0.45 : 1 }}>
                {tabela.linhas.map((l) => {
                  const v = vereditoDaLinha(l)
                  return (
                    <tr key={l.itemId} style={v.falta ? { background: 'var(--fam-coral-bg)' } : undefined}>
                      <td className="px-3 py-0 text-[13px]" style={{ color: 'var(--prod-primary)' }}>{l.nome}</td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                        {l.quantidade == null ? '—' : formatarQtd(l.quantidade, l.unidade)}
                      </td>
                      <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
                        {l.saldo == null ? '—' : formatarQtd(l.saldo, l.unidade)}
                      </td>
                      <td className="px-3 py-0 text-[13px]" style={{ color: v.falta ? 'var(--fam-coral-ink)' : 'var(--prod-secondary)' }}>
                        {v.texto}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ⛔ FALTA NÃO BLOQUEIA — a regra da separação de hoje fica como está (ela grava o
              movimento negativo); a tela só mostra ANTES o que antes se descobria depois. */}
          {tabela.faltando > 0 && (
            <p className="text-[12.5px]" style={{ color: 'var(--fam-coral-ink)' }}>
              {tabela.faltando === 1 ? 'Falta 1 insumo' : `Faltam ${tabela.faltando} insumos`} — dá pra confirmar assim mesmo;
              a separação registra o que sair e o saldo fica negativo até a compra entrar.
            </p>
          )}
          {tabela.semCusto > 0 && (
            <p className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>
              {tabela.semCusto} insumo(s) sem custo médio — o custo deste lote sai incompleto.
            </p>
          )}

          {/* ⭐ O RETALHO vem AQUI, junto do número (saiu da criação) */}
          {retalho?.aceita && (
            <div className="space-y-2 rounded-md p-3" style={{ background: 'var(--fam-indigo-bg)' }}>
              <p className="text-[13px] font-medium" style={{ color: 'var(--fam-indigo-ink)' }}>
                Tem retalho de ontem? Quer adicionar na receita?
              </p>
              {/**
                * ⭐⭐ NA CORREÇÃO, O QUE JÁ ESTÁ DECLARADO FICA À VISTA — e a tela DIZ que ele
                * continua se o dono não responder.
                *
                * ⛔ É a metade honesta da trava nova: o campo nasce vazio (ordem do dono), então
                * sem esta frase o dono não teria como saber que os 10 KG seguem valendo — e
                * silêncio sobre dado gravado é como a confiança na tela se perde.
                */}
              {retalho.declaradoKg != null && temRetalho === null && (
                <p className="text-[12px]" style={{ color: 'var(--fam-indigo-ink)' }}>
                  esta ordem está com {formatarQtd(retalho.declaradoKg, 'KG')} declarado — se você
                  não responder, ele continua
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => { setTemRetalho('NAO'); setRetalhoKg('') }}
                  className="rounded-md px-2.5 py-1 text-[12.5px]"
                  style={{
                    border: '1px solid var(--prod-line)',
                    background: temRetalho === 'NAO' ? 'var(--prod-acao-bg)' : 'transparent',
                    color: temRetalho === 'NAO' ? 'var(--prod-acao-ink)' : 'var(--prod-secondary)',
                  }}>
                  Não tem
                </button>
                <button type="button" onClick={() => setTemRetalho('SIM')}
                  className="rounded-md px-2.5 py-1 text-[12.5px]"
                  style={{
                    border: '1px solid var(--prod-line)',
                    background: temRetalho === 'SIM' ? 'var(--prod-acao-bg)' : 'transparent',
                    color: temRetalho === 'SIM' ? 'var(--prod-acao-ink)' : 'var(--prod-secondary)',
                  }}>
                  Sim
                </button>
                {temRetalho === 'SIM' && (
                  <span className="flex items-center gap-1.5">
                    <input aria-label="quantos kg de retalho" inputMode="decimal"
                      value={retalhoKg} onChange={(e) => setRetalhoKg(sanitizarQtd(e.target.value, 'KG'))}
                      placeholder="0"
                      className="w-[88px] rounded-md px-2 py-1 text-[13px] tabular-nums outline-none"
                      style={{ border: '1px solid var(--prod-line)', background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }} />
                    <span className="text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>kg</span>
                  </span>
                )}
              </div>
              {/* ⚠️ NUNCA pré-preenchido: ele pesa todo dia. O "da última vez" só serve pra
                  reconhecer grandeza absurda (92 onde é 9,2). */}
              {retalho.ultimoKg != null && temRetalho === 'SIM' && (
                <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                  da última vez: {formatarQtd(retalho.ultimoKg, 'KG')}
                </p>
              )}
              {fraseRet && (
                <p className="text-[12.5px]" style={{ color: 'var(--fam-indigo-ink)' }}>{fraseRet}</p>
              )}
              {/** ⚠️ a separação NÃO muda, e a tela DIZ — senão o dono espera mais material na câmara */}
              <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                o material que sai da câmara continua sendo o do pedido — o retalho já está na cozinha
              </p>
            </div>
          )}

          {/* ⭐ OS AVISOS DO ATO — mudaram de tela COM o número (remoção sem realocação é perda) */}
          {avisosPergunta.map((a) => (
            <div key={a.motivo} className="rounded-md p-3 text-[12.5px]"
              style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
              {a.frase}
              {/**
                * ⚠️ O ATALHO vai SÓ no `LOTE_NAO_COMPARAVEL`: o `MEDIA_DESTOA` não se resolve
                * convertendo lote nenhum (lá a decisão é de ficha, não de rótulo de unidade).
                * ⭐ Sem ele o aviso diz o problema e não diz onde resolver — foi a 11ª volta
                * da "porta sem maçaneta" na criação, e ela não volta aqui.
                */}
              {a.motivo === 'LOTE_NAO_COMPARAVEL' && (
                <a href={`/empresas/${id}/estoque/fichas/${ordem.fichaId}?foco=rendimento&voltar=${encodeURIComponent(`/empresas/${id}/estoque/producao/${ordemId}`)}`}
                  className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium underline"
                  style={{ color: 'var(--fam-ambar-ink)' }}>
                  completar a ficha
                </a>
              )}
            </div>
          ))}

          {erro && <p className="text-[12.5px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {/* ⭐ O WRITER ÚNICO: este botão é o ÚNICO caminho que grava a meta + a escala */}
            <button
              onClick={confirmarPedido}
              disabled={busy || pedidoNum == null || !(pedidoNum > 0)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium disabled:opacity-40"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {rotuloDoConfirmar(pedidoNum, ordem.unidadeProduzido)}
            </button>
            {corrigindoPedido && (
              <button onClick={() => { setCorrigindoPedido(false); setQuanto('') }}
                className="h-9 rounded-md px-3 text-[13px]"
                style={{ border: '1px solid var(--prod-line)', color: 'var(--prod-secondary)' }}>
                deixar como está
              </button>
            )}
          </div>

          {/* ⭐ O RASTRO — quem declarou e quando (a meta tem `criadoEm DEFAULT now()`, então
              sem esta lista a correção deixaria o "quem·quando" na PRIMEIRA declaração) */}
          {rastroPedido.length > 0 && (
            <div className="space-y-0.5 pt-1" style={{ borderTop: '1px solid var(--prod-line)' }}>
              {rastroPedido.map((r, i) => (
                <p key={i} className="pt-1 text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                  {r.correcao ? 'corrigido pra ' : 'pedido '}
                  <strong style={{ color: 'var(--prod-secondary)' }}>{fmtPedido(r.unidades, ordem.unidadeProduzido)} {ordem.unidadeProduzido}</strong>
                  {r.quem ? ` por ${r.quem}` : ''} · {new Date(r.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}

      {/* separação — ⛔ ESCONDIDA enquanto a pergunta está na tela: até declarar o pedido
          não existe "o que separar" (a escala é o DEFAULT 1 do banco, não um pedido). */}
      {!perguntando && (<>
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

        {/**
          * ⛔⛔⛔ **O CAMPO "QUERO FAZER" MORREU AQUI (11/10) — ELE ERA O FANTASMA.**
          *
          * **Defeito do dono:** *"a quantidade é perguntada 2× — na criação E depois de criar — e
          * números diferentes deixam o 1º assombrando a tela."* O mecanismo, lido no código: este
          * campo recalculava `sep` (as linhas de separação) **em estado local** e **nunca
          * regravava a meta nem a escala**. Digitar 20 fazia a cozinha separar material pra 20
          * enquanto o cabeçalho, a home, a lista e os relatórios seguiam imprimindo **30** —
          * todos leem o pedido do banco.
          *
          * ⭐ Agora a pergunta é **UMA** (`<PerguntaDoPedido>`, logo abaixo), ela **GRAVA** pelo
          * writer único, e ela mostra a prateleira — que é por isso que ela mora aqui e não na
          * criação: aquela tela não carrega saldo nenhum.
          *
          * ⚠️ **A EDIÇÃO POR LINHA FICA** e não é um 2º campo de pedido: ali o dono ajusta *o
          * que REALMENTE tirou da câmara*, que é outro fato (e é o que mantém o invariante P1
          * honesto). O que não existe mais é um segundo lugar que responda *"quanto produzir"*.
          */}
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
        {/**
          * ⭐⭐ O ESPELHO DA SEPARAÇÃO — *"com isso deve sair ~N"* (REALOCADO, 11/10).
          *
          * ⚠️ É o sentido INVERSO da pergunta do pedido: ali o dono diz as unidades e a tela
          * mostra o material; aqui ele ajusta o material (o que REALMENTE tirou da câmara) e a
          * tela mostra quantas unidades aquilo dá. **São duas perguntas, não duas contas** —
          * e esta sobreviveu à morte do campo "Quero fazer" porque *remoção sem realocação é
          * perda*: sem ela, mexer numa linha deixaria de ter resposta na tela.
          *
          * ⛔ Ela NUNCA grava nem sugere pedido — é leitura do que já está nas linhas.
          */}
        {planejada && previsao && (
          <div className="px-4 pb-4 text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
            {/**
              * ⭐⭐⭐ A FRASE VIROU O **TOTAL** (12/10, ordem do dono): *"deve sair ~62 UN no
              * total (~12 da massa nova + 50 do retalho)"*. Dizer só *"~12"* numa ordem que vai
              * render 62 é a tela escondendo metade do lote — e foi isso que fez o dono
              * desconfiar do pedido.
              *
              * ⛔ A soma mora na LIB (`fraseDaSeparacao`): somar `massa nova + bônus` aqui seria
              * a 2ª derivação do mesmo total, e ela divergiria do `permitido` do fiscal.
              * ⚠️ A régua usada (sua média × o que a receita promete) continua NOMEADA na frase.
              */}
            {fraseDaSeparacao({
              daMassaNova: Math.round(previsao.medido ?? previsao.esperadoDaFicha),
              porMedia: previsao.medido != null,
              bonusDoRetalho: linhaRet?.bonus ?? null,
              unidade: ordem.unidadeProduzido,
            })}
          </div>
        )}
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
          {/**
            * ⭐⭐ CORRIGIR O PEDIDO — *"ATÉ separar, o pedido pode ser corrigido pela MESMA
            * tela; DEPOIS de separada, não — a separação já obedeceu"* (o dono, 11/10).
            *
            * ⛔ Ele REABRE o MESMO componente da pergunta (não existe um 2º campo de pedido):
            * era o 2º lugar de perguntar que criou o fantasma. E `quanto` nasce VAZIO de
            * propósito — número pré-preenchido vira número confirmado sem ninguém conferir.
            */}
          {planejada && pedido?.origem === 'DECLARADO' && (
            <button onClick={() => { setQuanto(''); setCorrigindoPedido(true); setErro(null) }} disabled={busy}
              className="rounded-lg border px-4 py-2 text-[13px] disabled:opacity-50"
              style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
              Corrigir o pedido
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
      </>)}

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
          <h2 className="mb-2 text-sm font-semibold text-[var(--prod-primary)]">
            Conclusões ({valem.length})
            {conclusoes.length > valem.length && (
              <span className="ml-1 text-[11.5px] font-normal" style={{ color: 'var(--prod-muted)' }}>
                + {conclusoes.length - valem.length} corrigida(s), abaixo como história
              </span>
            )}
          </h2>
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
              /**
               * ⛔⛔⛔ **A DESFEITA É HISTÓRIA, NÃO TRABALHO (12/10).** Era a AUSÊNCIA de carimbo
               * nela que a fazia parecer *"aguardando conferência"* — pedindo um trabalho que o
               * gerente já tinha feito. Ela fica (o rastro é lei) e perde os dois gestos:
               * corrigir de novo estornaria um movimento já estornado, e a etiqueta sairia com
               * o número velho na caixa do freezer.
               */
              const desfeita = !!c.estornada
              const podeCorrigir =
                !desfeita && !carregandoPerm && podePerm('stock.manage') &&
                (conf == null || conf.estado === 'AGUARDANDO_CONFERENCIA')
              const abertoAqui = corrigindo === c.id
              return (
              <Card key={c.id} style={desfeita ? { opacity: 0.6 } : undefined}><CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--prod-primary)', textDecoration: desfeita ? 'line-through' : undefined }}>
                    {num(c.qtdGerada)} {ordem.unidadeProduzido} {c.parcial && <span className="text-[11px] font-normal text-[var(--fam-ambar-ink)]">(parcial)</span>}
                  </p>
                  {desfeita && (
                    <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                      ⊘ declaração corrigida pelo gerente — fica aqui como história e não conta em
                      lista nem em total
                    </p>
                  )}
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
                  {/* ⛔ etiqueta de lote desfeito não sai (o servidor também recusa) */}
                  {!desfeita && (
                    <a href={`/empresas/${id}/estoque/producao/conclusoes/${c.id}/etiqueta`} className="inline-flex items-center gap-1 rounded-lg border border-[var(--prod-line-strong)] px-3 py-1.5 text-xs text-[var(--prod-secondary)] hover:bg-[var(--prod-surface-1)]"><Tag className="h-3.5 w-3.5" /> etiqueta</a>
                  )}
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
  /** ⚠️ DERIVA do tipo da lib — ver o bloco do `pedido` acima (a dívida de 01/09) */
  pedido: { unidades: number | null; origem: OrigemDoPedido | null } | null
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
