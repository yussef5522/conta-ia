// ⭐⭐⭐ RELATÓRIOS DE PRODUÇÃO (13/09/2026) — mock `producao-relatorios-mock.html`.
//
// **A ordem do dono, ao pé da letra:** *"o cálculo de média/velocidade/rendimento tem UM
// dono (lib), e HOJE e Relatórios chamam a MESMA função — mesma pergunta, duas janelas,
// zero divergência possível."*
//
// ⭐ Por isso este arquivo **não calcula desempenho**: ele MONTA A JANELA e delega a
// `desempenho.ts` (`mediaDaTarefa`, `placarDaEquipe`, `rendimentoDoLote`). O que nasce aqui
// são só os agregados que o HOJE não tem por que responder — série por dia, custo do
// período, top tarefa.
//
// ⛔ **Período vazio é DITO, nunca zero disfarçado** — a régua de honestidade do módulo.

// ⭐ `foiMedido`/`ehRelampago` vêm do DONO ÚNICO — o piso de 5 min mora lá, e este arquivo
// só consome. Reescrever `minutos > 0` aqui seria a 2ª régua de duração do módulo.
import { mediaDaTarefa, placarDaEquipe, rendimentoDoLote, fmtMin, foiMedido, ehRelampago, type Execucao, type MediaDaTarefa, type DesempenhoDaPessoa } from './desempenho'

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

/** um LOTE fechado — o tijolo das contas de rendimento e custo (≠ Execucao, que é por pessoa) */
export interface Lote {
  ordemId: string
  tarefa: string
  /** o que foi PEDIDO — `null` quando ninguém registrou meta */
  pedido: number | null
  entregue: number
  /** custo real por unidade — `null` quando o lote não tem custo fechado */
  custoUnitario: number | null
  /** duração do lote (da 1ª etapa iniciada à última finalizada) — `null` sem tempo medido */
  minutos: number | null
  /** dia do lote em ISO `YYYY-MM-DD` (já no fuso de quem produziu — quem resolve é o reader) */
  dia: string
}

export interface PontoDoDia { dia: string; minutosPorLote: number | null; lotes: number; unidades: number }

export interface RelatorioDaTarefa {
  tarefa: string
  lotes: number
  unidades: number
  /** a régua da tarefa — a MESMA que o HOJE usa pro alerta do card vivo */
  media: MediaDaTarefa
  /** rendimento do PERÍODO (Σ entregue vs Σ pedido), pela mesma função do lote */
  rendimento: ReturnType<typeof rendimentoDoLote>
  custoMedio: number | null
  custoMin: number | null
  custoMax: number | null
  /** ⚠️ lotes sem custo fechado — contados à parte, nunca somidos na média */
  lotesSemCusto: number
  /** ⛔ lotes abaixo do piso de duração (registro retroativo) — fora do tempo, à vista */
  lotesRelampago: number
  porDia: PontoDoDia[]
  /** o melhor lote do período (mais unidades por minuto) — o destaque verde do mock */
  melhor: { minutos: number; unidades: number; frase: string } | null
  /** quem fez essa tarefa — pela MESMA `placarDaEquipe` do HOJE */
  pessoas: DesempenhoDaPessoa[]
  /** ⛔ o motivo do vazio, pra a tela DIZER em vez de mostrar 0 */
  vazio: string | null
}

/** ⭐ a média do período por dia — a linha do mock. Dia sem lote MEDIDO vem `null`, não 0. */
export function seriePorDia(lotes: Lote[]): PontoDoDia[] {
  const porDia = new Map<string, Lote[]>()
  for (const l of lotes) porDia.set(l.dia, [...(porDia.get(l.dia) ?? []), l])
  return [...porDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dia, ls]) => {
      const medidos = ls.filter((l) => foiMedido(l.minutos))
      return {
        dia,
        // ⚠️ `null` ≠ 0: dia em que ninguém cronometrou não é dia de lote instantâneo — e o
        // dia que só teve relâmpago fica SEM ponto, em vez de desenhar um recorde falso
        minutosPorLote: medidos.length ? r1(medidos.reduce((s, l) => s + l.minutos!, 0) / medidos.length) : null,
        lotes: ls.length,
        unidades: r2(ls.reduce((s, l) => s + l.entregue, 0)),
      }
    })
}

/**
 * ⭐⭐ O RELATÓRIO DE UMA TAREFA no período.
 *
 * @param lotes      os lotes fechados DA JANELA
 * @param execucoes  as execuções DA JANELA (por pessoa)
 * @param historico  a história INTEIRA — é ela que forma a média, nunca a própria janela
 *                   (senão "a média do período" seria a própria pessoa do período)
 */
export function relatorioDaTarefa(
  tarefa: string, lotes: Lote[], execucoes: Execucao[], historico: Execucao[], unidade = 'UN',
): RelatorioDaTarefa {
  const doPeriodo = lotes.filter((l) => l.tarefa === tarefa)
  const exec = execucoes.filter((e) => e.tarefa === tarefa)

  if (!doPeriodo.length) {
    return {
      tarefa, lotes: 0, unidades: 0,
      media: mediaDaTarefa(tarefa, historico),
      rendimento: rendimentoDoLote(null, 0, unidade),
      custoMedio: null, custoMin: null, custoMax: null, lotesSemCusto: 0, lotesRelampago: 0,
      porDia: [], melhor: null, pessoas: [],
      vazio: 'sem produção dessa tarefa no filtro',
    }
  }

  const comCusto = doPeriodo.filter((l) => l.custoUnitario != null && l.custoUnitario > 0)
  const custos = comCusto.map((l) => l.custoUnitario!)
  const entregue = r2(doPeriodo.reduce((s, l) => s + l.entregue, 0))
  // ⚠️ lote SEM meta não vira pedido 0 — ele sai da conta do pedido, e o rendimento do
  // período só existe se ALGUÉM registrou meta (senão seria % sobre um denominador inventado)
  const comMeta = doPeriodo.filter((l) => l.pedido != null && l.pedido > 0)
  const pedido = comMeta.length ? r2(comMeta.reduce((s, l) => s + l.pedido!, 0)) : null
  const entregueComMeta = comMeta.length ? r2(comMeta.reduce((s, l) => s + l.entregue, 0)) : entregue

  // ⛔ o destaque verde NÃO coroa registro retroativo: era daqui que saía o
  // "melhor: 1min p/ 504 un" que prod mostrava
  const medidos = doPeriodo.filter((l) => foiMedido(l.minutos) && l.entregue > 0)
  const melhorLote = medidos.length
    ? medidos.reduce((a, b) => (a.entregue / a.minutos! >= b.entregue / b.minutos! ? a : b))
    : null

  return {
    tarefa,
    lotes: doPeriodo.length,
    unidades: entregue,
    // ⭐ a média vem da HISTÓRIA, pela função do dono único
    media: mediaDaTarefa(tarefa, historico),
    rendimento: rendimentoDoLote(pedido, entregueComMeta, unidade),
    custoMedio: custos.length ? r2(custos.reduce((s, c) => s + c, 0) / custos.length) : null,
    custoMin: custos.length ? r2(Math.min(...custos)) : null,
    custoMax: custos.length ? r2(Math.max(...custos)) : null,
    lotesSemCusto: doPeriodo.length - comCusto.length,
    lotesRelampago: doPeriodo.filter((l) => ehRelampago(l.minutos)).length,
    porDia: seriePorDia(doPeriodo),
    melhor: melhorLote
      ? { minutos: melhorLote.minutos!, unidades: melhorLote.entregue, frase: `melhor: ${fmtMin(melhorLote.minutos!)} p/ ${melhorLote.entregue} un` }
      : null,
    // ⭐ a MESMA `placarDaEquipe` do HOJE, com a janela do relatório
    pessoas: placarDaEquipe(exec, historico),
    vazio: null,
  }
}

export interface GeralDoPeriodo {
  lotes: number
  unidades: number
  /** horas de cozinha MEDIDAS — o que não foi cronometrado fica de fora e é dito */
  horas: number
  lotesSemTempo: number
  /** ⛔ lotes abaixo do piso — não somam horas, e a tela DIZ quantos foram */
  lotesRelampago: number
  topTarefa: { tarefa: string; unidades: number } | null
  vazio: string | null
}

/** ⭐ o rodapé do mock: todas as tarefas do período, sem entrar em nenhuma. */
export function geralDoPeriodo(lotes: Lote[]): GeralDoPeriodo {
  if (!lotes.length) {
    return { lotes: 0, unidades: 0, horas: 0, lotesSemTempo: 0, lotesRelampago: 0, topTarefa: null, vazio: 'sem produção no filtro' }
  }
  const porTarefa = new Map<string, number>()
  for (const l of lotes) porTarefa.set(l.tarefa, (porTarefa.get(l.tarefa) ?? 0) + l.entregue)
  const top = [...porTarefa.entries()].sort((a, b) => b[1] - a[1])[0]
  const medidos = lotes.filter((l) => foiMedido(l.minutos))
  const relampago = lotes.filter((l) => ehRelampago(l.minutos)).length
  return {
    lotes: lotes.length,
    unidades: r2(lotes.reduce((s, l) => s + l.entregue, 0)),
    horas: r1(medidos.reduce((s, l) => s + l.minutos!, 0) / 60),
    lotesSemTempo: lotes.length - medidos.length - relampago,
    lotesRelampago: relampago,
    topTarefa: { tarefa: top[0], unidades: r2(top[1]) },
    vazio: null,
  }
}

/** ⭐ unidades por pessoa no período — a barra horizontal do mock, todas as tarefas juntas */
export function unidadesPorPessoa(execucoes: Execucao[]): { colaboradorId: string; nome: string; unidades: number; proporcao: number }[] {
  const porPessoa = new Map<string, { nome: string; un: number }>()
  for (const e of execucoes) {
    const a = porPessoa.get(e.colaboradorId) ?? { nome: e.nome, un: 0 }
    porPessoa.set(e.colaboradorId, { nome: a.nome, un: a.un + e.unidades })
  }
  const max = Math.max(1, ...[...porPessoa.values()].map((v) => v.un))
  return [...porPessoa.entries()]
    .map(([colaboradorId, v]) => ({ colaboradorId, nome: v.nome, unidades: r2(v.un), proporcao: r2(v.un / max) }))
    .sort((a, b) => b.unidades - a.unidades)
}
