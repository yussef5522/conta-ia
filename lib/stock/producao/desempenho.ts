// ⭐⭐⭐ O DESEMPENHO DA PRODUÇÃO TEM UM DONO SÓ (13/09/2026) — ordem do dono.
//
// **Ele:** *"O cálculo de média/velocidade/rendimento tem UM dono (lib), e HOJE (placar do
// dia) e Relatórios (período livre) chamam a MESMA função — mesma pergunta, duas janelas,
// zero divergência possível."*
//
// ⚠️ É a lição do B1 dita antes de o bug existir: quando N telas precisam da MESMA decisão,
// a decisão vira lib. Aqui as janelas são diferentes (hoje × período livre) e a PERGUNTA é
// a mesma — *"essa pessoa foi mais rápida ou mais devagar do que o normal NESTA tarefa?"*.
//
// ⛔⛔ AS RÉGUAS DE HONESTIDADE, todas em um lugar:
//   · **queijo com queijo** — a média é a DA TAREFA, nunca a geral (moldar ≠ gessar);
//   · **3+ lotes medidos** pra a tarefa ter média; com menos, `sem média ainda`;
//   · **tempo a apurar fica FORA** das médias (finalizado pelo gerente não foi cronometrado)
//     e é **contado à parte**, porque sumir com ele esconderia trabalho real;
//   · **dupla divide unidades só entre quem MEDIU** — dar unidades a quem não tem minutos
//     aumenta o denominador de alguém sem aumentar o numerador de ninguém (a lição de 08/09);
//   · **cancelada fora pelo ESTADO**, nunca por heurística de nome;
//   · **período vazio = "sem produção no filtro"**, nunca zero disfarçado.

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

/** ⭐ quantos lotes MEDIDOS uma tarefa precisa ter pra ganhar média (régua do dono) */
export const LOTES_PRA_TER_MEDIA = 3
/** ⭐ a faixa em que o rendimento é "no alvo" — fora dela, âmbar dos DOIS lados */
export const RENDIMENTO_OK = { min: 95, max: 110 } as const
/** ⚠️ abaixo disso a diferença de velocidade é ruído de medição, não desempenho */
export const RUIDO_DE_VELOCIDADE_PCT = 5

/** uma execução de tarefa por uma pessoa — o tijolo de tudo aqui */
export interface Execucao {
  ordemId: string
  /** a TAREFA: o item produzido (é por ele que se compara queijo com queijo) */
  tarefa: string
  colaboradorId: string
  nome: string
  /** `null` quando o tempo não foi medido (finalizado pelo gerente) */
  minutos: number | null
  /** unidades atribuídas a ESTA execução */
  unidades: number
  quando: Date
}

export interface MediaDaTarefa {
  tarefa: string
  /** minutos por lote — `null` quando não há lotes medidos suficientes */
  minutosPorLote: number | null
  /** ⭐ a mediana anda junto: uma média sozinha esconde o lote de 4h que puxou tudo */
  medianaMinutos: number | null
  lotesMedidos: number
  /** ⚠️ contados à parte, nunca somidos */
  lotesSemTempo: number
  /** por que não há média (pra a tela DIZER, em vez de mostrar vazio) */
  porQue: string | null
}

/** ⭐ A MÉDIA DE UMA TAREFA — pura. Recebe as execuções e devolve a régua dela. */
export function mediaDaTarefa(tarefa: string, execucoes: Execucao[]): MediaDaTarefa {
  const daTarefa = execucoes.filter((e) => e.tarefa === tarefa)
  const medidas = daTarefa.filter((e) => e.minutos != null && e.minutos > 0)
  const semTempo = daTarefa.length - medidas.length
  if (medidas.length < LOTES_PRA_TER_MEDIA) {
    return {
      tarefa, minutosPorLote: null, medianaMinutos: null,
      lotesMedidos: medidas.length, lotesSemTempo: semTempo,
      porQue: medidas.length === 0
        ? 'tarefa nova — sem média ainda'
        : `só ${medidas.length} lote(s) medido(s) — precisa de ${LOTES_PRA_TER_MEDIA}`,
    }
  }
  const mins = medidas.map((e) => e.minutos!).sort((a, b) => a - b)
  const meio = Math.floor(mins.length / 2)
  return {
    tarefa,
    minutosPorLote: r1(mins.reduce((s, m) => s + m, 0) / mins.length),
    medianaMinutos: r1(mins.length % 2 ? mins[meio] : (mins[meio - 1] + mins[meio]) / 2),
    lotesMedidos: medidas.length, lotesSemTempo: semTempo, porQue: null,
  }
}

export interface DesempenhoDaPessoa {
  colaboradorId: string
  nome: string
  tarefas: number
  unidades: number
  /** minutos MEDIDOS (o que entra na conta) */
  minutosMedidos: number
  /** ⚠️ tarefas cujo tempo não foi medido — contadas à parte, nunca escondidas */
  tarefasSemTempo: number
  /**
   * ⭐ quanto ela foi mais rápida (+) ou mais devagar (−) que a média das tarefas que fez,
   * em %. `null` quando nenhuma tarefa dela tem média.
   */
  vsMediaPct: number | null
  /** o selo pronto — a tela só pinta */
  selo: 'ACIMA' | 'NA_MEDIA' | 'ABAIXO' | 'SEM_MEDIA'
  /** a frase do selo, com os números dentro (a régua do dono: número antes de %) */
  frase: string
  /** ⭐ 0..1 — a barra do placar. Proporcional às unidades da pessoa no dia. */
  proporcao: number
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)}min`)

/**
 * ⭐⭐ O PLACAR — **a MESMA função pro HOJE e pros Relatórios**. A única coisa que muda é a
 * janela de execuções que entra; a régua é idêntica.
 *
 * @param execucoes   o que aconteceu na JANELA (hoje, 7 dias, mês…)
 * @param historico   o que forma a MÉDIA de cada tarefa (sempre a história inteira, não a
 *                    janela — senão "a média de hoje" seria a própria pessoa de hoje)
 */
export function placarDaEquipe(execucoes: Execucao[], historico: Execucao[]): DesempenhoDaPessoa[] {
  const medias = new Map<string, MediaDaTarefa>()
  for (const t of new Set(historico.map((e) => e.tarefa))) medias.set(t, mediaDaTarefa(t, historico))

  const porPessoa = new Map<string, Execucao[]>()
  for (const e of execucoes) porPessoa.set(e.colaboradorId, [...(porPessoa.get(e.colaboradorId) ?? []), e])

  const maxUn = Math.max(1, ...[...porPessoa.values()].map((es) => es.reduce((s, e) => s + e.unidades, 0)))

  const out: DesempenhoDaPessoa[] = []
  for (const [colaboradorId, es] of porPessoa) {
    const unidades = r2(es.reduce((s, e) => s + e.unidades, 0))
    const medidas = es.filter((e) => e.minutos != null && e.minutos > 0)
    const semTempo = es.length - medidas.length

    // ⭐ compara CADA execução com a média DA TAREFA dela; a % da pessoa é a média dessas
    const comparaveis = medidas
      .map((e) => ({ e, m: medias.get(e.tarefa) }))
      .filter((x): x is { e: Execucao; m: MediaDaTarefa } => !!x.m?.minutosPorLote)
    let vsMediaPct: number | null = null
    if (comparaveis.length) {
      // ⚠️ positivo = MAIS RÁPIDO (gastou menos que a média) — é o que o dono lê como "+14%"
      const ganhos = comparaveis.map(({ e, m }) => ((m.minutosPorLote! - e.minutos!) / m.minutosPorLote!) * 100)
      vsMediaPct = r1(ganhos.reduce((s, g) => s + g, 0) / ganhos.length)
    }

    let selo: DesempenhoDaPessoa['selo'] = 'SEM_MEDIA'
    let frase = comparaveis.length === 0
      ? (es.length === 1 ? 'tarefa nova — sem média ainda' : 'sem média ainda')
      : ''
    if (vsMediaPct != null) {
      if (Math.abs(vsMediaPct) < RUIDO_DE_VELOCIDADE_PCT) { selo = 'NA_MEDIA'; frase = 'na média' }
      else if (vsMediaPct > 0) { selo = 'ACIMA'; frase = `+${Math.round(vsMediaPct)}% vs média` }
      else {
        selo = 'ABAIXO'
        // ⭐ o âmbar vem com os NÚMEROS: "−31% · 2h18 (média 1h35)" — é convite, não veredito
        const pior = comparaveis.reduce((a, b) => (a.e.minutos! / a.m.minutosPorLote! > b.e.minutos! / b.m.minutosPorLote! ? a : b))
        frase = `${Math.round(vsMediaPct)}% · ${fmtMin(pior.e.minutos!)} (média ${fmtMin(pior.m.minutosPorLote!)})`
      }
    }

    out.push({
      colaboradorId, nome: es[0].nome, tarefas: es.length, unidades,
      minutosMedidos: r1(medidas.reduce((s, e) => s + (e.minutos ?? 0), 0)),
      tarefasSemTempo: semTempo, vsMediaPct, selo, frase,
      proporcao: r2(unidades / maxUn),
    })
  }
  // ⛔ ordenado por VOLUME, não por velocidade: *"sem pódio público"* — a comparação é com a
  // média de cada um, e ordenar por % faria um ranking que o dono não pediu.
  return out.sort((a, b) => b.unidades - a.unidades)
}

export interface RendimentoDoLote {
  /** o que foi PEDIDO — `null` quando ninguém registrou meta */
  pedido: number | null
  entregue: number
  /** % do pedido — `null` sem meta */
  pct: number | null
  /** o selo do rendimento: verde na faixa, âmbar dos DOIS lados */
  selo: 'OK' | 'BAIXO' | 'ALTO' | 'SEM_META'
  /** a frase do mock: "pedido 130 → entregue 137 UN" ou "sem meta registrada · entregue N" */
  frase: string
}

/**
 * ⭐ PEDIDO → ENTREGUE, a linha do lote fechado.
 *
 * ⛔ **Muito acima também é ÂMBAR** (régua do dono): *"produzir demais é custo parado"* —
 * 300% de rendimento não é uma boa notícia, é comida encalhando na câmara.
 * ⚠️ E **sem meta NÃO vira 100%**: vira "sem meta registrada", com o entregue à vista.
 */
export function rendimentoDoLote(pedido: number | null, entregue: number, unidade = 'UN'): RendimentoDoLote {
  if (pedido == null || pedido <= 0) {
    return { pedido: null, entregue, pct: null, selo: 'SEM_META', frase: `sem meta registrada · entregue ${entregue} ${unidade}` }
  }
  const pct = Math.round((entregue / pedido) * 100)
  const selo = pct < RENDIMENTO_OK.min ? 'BAIXO' : pct > RENDIMENTO_OK.max ? 'ALTO' : 'OK'
  return { pedido, entregue, pct, selo, frase: `pedido ${pedido} → entregue ${entregue} ${unidade}` }
}

/**
 * ⭐⭐ O ALERTA INTELIGENTE DO CARD VIVO: passou da média histórica DESTA tarefa?
 *
 * ⚠️ A régua das 4h continua como **teto absoluto** (ela pega a tarefa sem média também); esta
 * é a camada que sabe que massa de pizza leva 3h05 e porção de queijo leva 1h48.
 */
export function passouDaMedia(minutosCorrendo: number, media: MediaDaTarefa | null): string | null {
  if (!media?.minutosPorLote || minutosCorrendo <= media.minutosPorLote) return null
  return `passou ${fmtMin(minutosCorrendo - media.minutosPorLote)} da média`
}

export { fmtMin }
