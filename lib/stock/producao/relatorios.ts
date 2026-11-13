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
import { mediaDaTarefa, placarDaEquipe, rendimentoDoLote, fmtMin, foiMedido, ehRelampago, somarQuantidades, type Execucao, type MediaDaTarefa, type DesempenhoDaPessoa, type Quantidade } from './desempenho'

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
  /** ⭐ a unidade do que saiu — nenhuma soma atravessa unidades diferentes */
  unidade: string
  /**
   * ⭐ QUANDO a conclusão foi lançada (ISO) — é o `quando` que o reader JÁ calcula pra decidir
   * o `dia`; só estava guardado pra ele. O relatório por dia usa pra dizer *"encerrou às HH:MM"*.
   *
   * ⚠️ OPCIONAL de propósito: campo obrigatório aqui quebraria toda fixture de `Lote` que
   * existe, e nenhum leitor antigo precisa dele.
   * ⚠️ Produção PARCIAL tem VÁRIAS conclusões no mesmo lote — este é o **1º lançamento**, o
   * mesmo instante que datou o lote. Datar pelo último faria o lote poder trocar de DIA.
   */
  encerradoAs?: string
  /**
   * ⭐ o ITEM que o lote produziu. Serve pra o dono ESCONDER uma receita do relatório por ID —
   * ⚠️ nunca por NOME: esta casa renomeia item, e por nome a receita oculta reapareceria
   * sozinha no dia do rename. OPCIONAL pelo mesmo motivo do `encerradoAs` (fixture antiga).
   */
  itemId?: string
}

export interface PontoDoDia {
  dia: string
  /** `null` = o dia TEVE lote e ninguém cronometrou — é buraco no gráfico, nunca ponto zero */
  minutosPorLote: number | null
  lotes: number
  unidades: number
  /** ⚠️ pra a tela DIZER por que o dia não tem ponto, em vez de deixar o buraco mudo */
  semTempoMedido: boolean
}

export interface RelatorioDaTarefa {
  tarefa: string
  lotes: number
  unidades: number
  /** a régua da tarefa — a MESMA que o HOJE usa pro alerta do card vivo */
  media: MediaDaTarefa
  /** rendimento do PERÍODO (Σ entregue vs Σ pedido), pela mesma função do lote */
  rendimento: ReturnType<typeof rendimentoDoLote>
  /** ⚠️ quantos lotes do período têm meta — *"2 de 3 lotes com meta · 104% nesses"* */
  lotesComMeta: number
  custoMedio: number | null
  custoMin: number | null
  custoMax: number | null
  /** ⚠️ lotes sem custo fechado — contados à parte, nunca somidos na média */
  lotesSemCusto: number
  /** ⛔ lotes abaixo do piso de duração (registro retroativo) — fora do tempo, à vista */
  lotesRelampago: number
  porDia: PontoDoDia[]
  /** o melhor lote do período por RITMO (unidades por minuto) — com a conta no rótulo */
  melhor: { minutos: number; unidades: number; dia: string; ritmo: number; frase: string } | null
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
        semTempoMedido: medidos.length === 0,
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
  tarefa: string, lotes: Lote[], execucoes: Execucao[], historico: Execucao[],
): RelatorioDaTarefa {
  const doPeriodo = lotes.filter((l) => l.tarefa === tarefa)
  const exec = execucoes.filter((e) => e.tarefa === tarefa)

  if (!doPeriodo.length) {
    return {
      tarefa, lotes: 0, unidades: 0,
      media: mediaDaTarefa(tarefa, historico),
      rendimento: rendimentoDoLote(null, 0, 'UN'), lotesComMeta: 0,
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
  // ⭐ "MELHOR" POR RITMO — e o rótulo DIZ a conta (régua do dono, 13/09). A tela mostrava
  // *"melhor: 3h10 p/ 214 un"* num lote que era o MAIS LONGO do período: quem lê não tinha
  // como saber por qual régua ele era o melhor. Rótulo que não diz a conta é rótulo que mente.
  const melhorLote = medidos.length
    ? medidos.reduce((a, b) => (a.entregue / a.minutos! >= b.entregue / b.minutos! ? a : b))
    : null

  return {
    tarefa,
    lotes: doPeriodo.length,
    unidades: entregue,
    // ⭐ a média vem da HISTÓRIA, pela função do dono único
    media: mediaDaTarefa(tarefa, historico),
    // ⛔ META PARCIAL NÃO VIRA MÉDIA SILENCIOSA: o % vale só sobre os lotes que TÊM meta, e
    // a tela diz quantos são ("2 de 3 lotes com meta · 104% nesses"). Espalhar o % sobre os
    // sem-meta inventaria um denominador que ninguém registrou.
    rendimento: rendimentoDoLote(pedido, entregueComMeta, doPeriodo[0].unidade),
    lotesComMeta: comMeta.length,
    custoMedio: custos.length ? r2(custos.reduce((s, c) => s + c, 0) / custos.length) : null,
    custoMin: custos.length ? r2(Math.min(...custos)) : null,
    custoMax: custos.length ? r2(Math.max(...custos)) : null,
    lotesSemCusto: doPeriodo.length - comCusto.length,
    lotesRelampago: doPeriodo.filter((l) => ehRelampago(l.minutos)).length,
    porDia: seriePorDia(doPeriodo),
    melhor: melhorLote
      ? {
        minutos: melhorLote.minutos!, unidades: melhorLote.entregue, dia: melhorLote.dia,
        ritmo: Math.round((melhorLote.entregue / melhorLote.minutos!) * 100) / 100,
        frase: `melhor ritmo: ${Math.round((melhorLote.entregue / melhorLote.minutos!) * 100) / 100} ${melhorLote.unidade}/min`
          + ` · ${melhorLote.dia.slice(8, 10)}/${melhorLote.dia.slice(5, 7)}`
          + ` (${melhorLote.entregue} ${melhorLote.unidade} em ${fmtMin(melhorLote.minutos!)})`,
      }
      : null,
    // ⭐ a MESMA `placarDaEquipe` do HOJE, com a janela do relatório
    pessoas: placarDaEquipe(exec, historico),
    vazio: null,
  }
}

export interface GeralDoPeriodo {
  lotes: number
  /** ⛔ por UNIDADE — "6.912 UN · 23 KG", nunca um número composto */
  quantidade: Quantidade
  /** horas de cozinha MEDIDAS — o que não foi cronometrado fica de fora e é dito */
  horas: number
  lotesSemTempo: number
  /** ⛔ lotes abaixo do piso — não somam horas, e a tela DIZ quantos foram */
  lotesRelampago: number
  /** ⭐ as tarefas do período, da maior pra menor — a tela as transforma em LINKS */
  topTarefas: { tarefa: string; lotes: number; unidades: number; unidade: string }[]
  vazio: string | null
}

/** ⭐ o rodapé do mock: todas as tarefas do período, sem entrar em nenhuma. */
export function geralDoPeriodo(lotes: Lote[]): GeralDoPeriodo {
  if (!lotes.length) {
    return { lotes: 0, quantidade: somarQuantidades([]), horas: 0, lotesSemTempo: 0, lotesRelampago: 0, topTarefas: [], vazio: 'sem produção no filtro' }
  }
  const porTarefa = new Map<string, { lotes: number; unidades: number; unidade: string }>()
  for (const l of lotes) {
    const a = porTarefa.get(l.tarefa) ?? { lotes: 0, unidades: 0, unidade: l.unidade }
    porTarefa.set(l.tarefa, { lotes: a.lotes + 1, unidades: a.unidades + l.entregue, unidade: a.unidade })
  }
  const medidos = lotes.filter((l) => foiMedido(l.minutos))
  const relampago = lotes.filter((l) => ehRelampago(l.minutos)).length
  return {
    lotes: lotes.length,
    quantidade: somarQuantidades(lotes.map((l) => ({ unidades: l.entregue, unidade: l.unidade }))),
    horas: r1(medidos.reduce((s, l) => s + l.minutos!, 0) / 60),
    lotesSemTempo: lotes.length - medidos.length - relampago,
    lotesRelampago: relampago,
    topTarefas: [...porTarefa.entries()]
      .map(([tarefa, v]) => ({ tarefa, lotes: v.lotes, unidades: r2(v.unidades), unidade: v.unidade }))
      .sort((a, b) => b.lotes - a.lotes || b.unidades - a.unidades),
    vazio: null,
  }
}

export interface BarraDaPessoa {
  colaboradorId: string
  nome: string
  /** o que a pessoa produziu NESTA unidade (texto pronto: "1.238 UN") */
  quantidade: Quantidade
  total: number
  lotes: number
  /** total ÷ maior total DA MESMA UNIDADE — a barra e o número ao lado medem a MESMA coisa */
  proporcao: number
}

/** ⭐ um bloco de barras por UNIDADE — UN com UN, KG com KG, nunca na mesma régua (lei S20) */
export interface BarrasDaUnidade {
  unidade: string
  pessoas: BarraDaPessoa[]
}

/**
 * ⭐⭐ Quanto cada pessoa produziu na janela — UM BLOCO POR UNIDADE (13/11/2026).
 *
 * ⛔⛔ O GRÁFICO MENTIA: com UN e KG na mesma janela a barra passava a medir LOTES enquanto o
 * número ao lado dizia UNIDADES — no print do dono, rodrigo "1.238 UN" com a barra MENOR que edmar
 * "1.003 UN" (menos lotes, mais unidades). Agora cada unidade é um bloco com a própria escala:
 * a barra é `total ÷ maior total da unidade`, a mesma grandeza do número escrito. Somar UN com KG
 * continua impossível: a pessoa que fez nas duas aparece nos DOIS blocos.
 */
export function unidadesPorPessoa(execucoes: Execucao[]): BarrasDaUnidade[] {
  const porUnidade = new Map<string, Execucao[]>()
  for (const e of execucoes) porUnidade.set(e.unidade, [...(porUnidade.get(e.unidade) ?? []), e])
  return [...porUnidade.entries()]
    .map(([unidade, es]) => {
      const porPessoa = new Map<string, Execucao[]>()
      for (const e of es) porPessoa.set(e.colaboradorId, [...(porPessoa.get(e.colaboradorId) ?? []), e])
      const total = (xs: Execucao[]) => r2(xs.reduce((s, e) => s + e.unidades, 0))
      const max = Math.max(0, ...[...porPessoa.values()].map(total))
      const pessoas = [...porPessoa.entries()]
        .map(([colaboradorId, xs]) => ({
          colaboradorId, nome: xs[0].nome, quantidade: somarQuantidades(xs), total: total(xs), lotes: xs.length,
          proporcao: max > 0 ? r2(total(xs) / max) : 0,
        }))
        .sort((a, b) => b.total - a.total || b.lotes - a.lotes)
      return { unidade, pessoas, peso: es.length }
    })
    .sort((a, b) => b.peso - a.peso)
    .map(({ unidade, pessoas }) => ({ unidade, pessoas }))
}
