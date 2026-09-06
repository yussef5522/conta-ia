// ⭐⭐ QUEM É MAIS RÁPIDO EM CADA TAREFA (06/09/2026).
//
// **A régua do dono:** *"quem faz gessado mais rápido ≠ quem molda mais rápido — comparar
// min/un de tarefas diferentes é injusto."* É o recorte que o Toast faz por cargo/função, e
// aqui ele é por ETAPA — que é a unidade real de trabalho da cozinha.
//
// ⛔⛔ E A TRAVA QUE MAIS IMPORTA AQUI: **uma pessoa só não faz um "mais rápido"**. Se apenas
// a Carlise fez porção de calabresa no mês, ela não é a mais rápida — ela é a única. Coroar
// alguém sem ninguém pra comparar é dar um prêmio que não foi disputado, e quem lê a tela
// não tem como saber disso. A linha diz *"a apurar — só uma pessoa fez"*.

/** ⚠️ mesma régua da tela: menos de 3 tarefas na etapa é amostra, não desempenho */
export const MINIMO_NA_TAREFA = 3

export interface ExecucaoDeTarefa {
  /** o nome da etapa — é ele que agrupa ("gessado", "moldar beef") */
  tarefa: string
  /** o produto, pra a linha dizer de onde vem ("beef de xis e hambúrguer") */
  produto: string
  colaboradorId: string
  nome: string
  minutos: number
  /** unidades atribuídas a esta execução (o lote já dividido entre as etapas) */
  unidades: number
}

export interface LinhaDaTarefa {
  tarefa: string
  /** os produtos em que essa tarefa apareceu, pra o subtítulo da linha */
  produtos: string[]
  /** quem foi mais rápido — `null` quando não dá pra dizer, com o motivo ao lado */
  maisRapido: { colaboradorId: string; nome: string; minPorUnidade: number } | null
  /** por que não há "mais rápido" (só uma pessoa, volume baixo, sem quantidade) */
  semVencedor: string | null
  /** a média da equipe NESTA tarefa — a régua justa, não a média geral */
  mediaDaEquipe: number | null
  volume: number
  pessoas: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * ⭐ AGRUPA POR TAREFA e elege por tarefa. PURA.
 *
 * ⚠️ A média mostrada é a **desta tarefa**, não a geral: comparar quem molda contra a média
 * que inclui gessado é a injustiça que este recorte existe pra evitar.
 */
export function porTarefaDaEquipe(execucoes: ExecucaoDeTarefa[]): LinhaDaTarefa[] {
  const porNome = new Map<string, ExecucaoDeTarefa[]>()
  for (const e of execucoes) {
    if (!porNome.has(e.tarefa)) porNome.set(e.tarefa, [])
    porNome.get(e.tarefa)!.push(e)
  }

  const linhas: LinhaDaTarefa[] = []
  for (const [tarefa, es] of porNome) {
    const produtos = [...new Set(es.map((e) => e.produto))].filter(Boolean)
    const volume = r2(es.reduce((s, e) => s + e.unidades, 0))

    // por pessoa DENTRO da tarefa
    const porPessoa = new Map<string, { nome: string; minutos: number; unidades: number; vezes: number }>()
    for (const e of es) {
      const a = porPessoa.get(e.colaboradorId) ?? { nome: e.nome, minutos: 0, unidades: 0, vezes: 0 }
      a.minutos += e.minutos; a.unidades += e.unidades; a.vezes += 1
      porPessoa.set(e.colaboradorId, a)
    }
    // ⛔⛔ TEMPO ZERO NÃO É VELOCIDADE INFINITA — é tempo não medido (achado no dado real,
    // 06/09). O módulo guarda MINUTOS; tarefa fechada em segundos arredonda pra 0, e `0 min/un`
    // na tela é lido como "o mais rápido de todos". Quem tem 0 minuto medido fica de fora da
    // taxa, como quem não tem quantidade — "a apurar", nunca um número que premia por engano.
    const comTaxa = [...porPessoa.entries()]
      .filter(([, a]) => a.unidades > 0 && a.minutos > 0 && a.vezes >= MINIMO_NA_TAREFA)
      .map(([id, a]) => ({ colaboradorId: id, nome: a.nome, minPorUnidade: r2(a.minutos / a.unidades) }))

    // ⚠️ E A MÉDIA SÓ SOMA O QUE FOI MEDIDO. Deixar a execução de 0 minuto no denominador
    // (as unidades dela) sem nada no numerador PUXA a média da equipe pra baixo — a régua
    // ficaria mais dura pra todo mundo por causa de trabalho que ninguém cronometrou.
    const medidas = es.filter((e) => e.unidades > 0 && e.minutos > 0)
    const minutosMedidos = medidas.reduce((s, e) => s + e.minutos, 0)
    const mediaDaEquipe = medidas.length
      ? r2(minutosMedidos / medidas.reduce((s, e) => s + e.unidades, 0))
      : null

    let maisRapido: LinhaDaTarefa['maisRapido'] = null
    let semVencedor: string | null = null
    if (porPessoa.size === 1) {
      // ⛔ a trava central: sem ninguém pra comparar, não há "mais rápido"
      semVencedor = 'a apurar — só uma pessoa fez'
    } else if (!comTaxa.length) {
      semVencedor = medidas.length === 0
        ? 'a apurar — o tempo medido foi menor que 1 minuto'
        : `a apurar — ninguém fez ${MINIMO_NA_TAREFA}+ vezes ainda`
    } else {
      const melhor = Math.min(...comTaxa.map((c) => c.minPorUnidade))
      const empatados = comTaxa.filter((c) => Math.abs(c.minPorUnidade - melhor) < 0.005)
      // ⚠️ empate na tarefa também não desempata no escuro — a linha diz que empatou
      if (empatados.length > 1) semVencedor = `empate: ${empatados.map((e) => e.nome).join(' e ')}`
      else maisRapido = empatados[0]
    }

    linhas.push({ tarefa, produtos, maisRapido, semVencedor, mediaDaEquipe, volume, pessoas: porPessoa.size })
  }
  // ⭐ ordem: quem move mais volume primeiro — é onde o ganho de velocidade vale dinheiro
  return linhas.sort((a, b) => b.volume - a.volume || a.tarefa.localeCompare(b.tarefa, 'pt-BR'))
}

/**
 * ⭐ A SPARKLINE: unidades por SEMANA dentro do período. PURA.
 *
 * ⚠️ Semana aqui é **bloco de 7 dias a partir do início do período**, não semana do
 * calendário: o mês começa numa quarta e "semana 1" seria 5 dias contra 7 nas outras — a
 * barra menor diria "produziu menos" quando só houve menos dias.
 */
export function unidadesPorSemana(
  eventos: { quando: Date; unidades: number }[], de: Date, ate: Date,
): number[] {
  const semanas = Math.max(1, Math.ceil((ate.getTime() - de.getTime()) / (7 * 86_400_000)))
  const out = new Array(semanas).fill(0)
  for (const e of eventos) {
    const i = Math.floor((e.quando.getTime() - de.getTime()) / (7 * 86_400_000))
    if (i >= 0 && i < semanas) out[i] += e.unidades
  }
  return out.map(r2)
}

/**
 * ⭐ O SELO: quanto a pessoa entrega do ESPERADO, em % (o mock diz "rende 103% do esperado").
 *
 * ⚠️ É o desvio + 100 — mas só existe quando há desvio medido. `null` continua sendo
 * "a apurar", nunca 100% por default: dizer que alguém entrega exatamente o esperado quando
 * não se mediu nada é inventar uma nota.
 */
export function pctDoEsperado(desvioPercentual: number | null): number | null {
  return desvioPercentual == null ? null : r2(100 + desvioPercentual)
}
