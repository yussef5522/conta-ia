// ⛔⛔⛔ O LOTE RELÂMPAGO NÃO ENTRA NA MÉDIA (13/09/2026)
//
// **O dono, depois do raio-x:** *"Piso de 5 minutos: execução medida abaixo disso é
// RELÂMPAGO — conta à parte (como o 'sem tempo' já é), fora das médias, dito no rodapé.
// **Nenhum lote real fica pronto em menos de 5 min; registro retroativo é o caso, e vai se
// repetir.** Os 2 lotes atuais ficam classificados pelo piso — não mexe neles na mão, a
// régua resolve."*
//
// **O QUE MOTIVOU, medido em prod:** 4 de 48 execuções medidas duram 1-2 minutos, e **3
// delas estão na porção de queijo** — a tarefa mais produzida. Elas cortavam a média pela
// metade (44min com, 88min sem), e o *"rodrigo −49% · 2h07 (média 44min)"* comparava com
// uma régua envenenada.
//
// ⭐ É a família do *"tempo zero não é velocidade infinita"* (06/09) um degrau acima: lá a
// régua matou o `0`, e o `1` passava. ⛔ **E a cura é a mesma: o trabalho NÃO some** — o
// relâmpago é contado à parte e DITO, como o "sem tempo" já era. Sumir com ele esconderia
// unidades que saíram de verdade.

import { describe, it, expect } from 'vitest'
import { mediaDaTarefa, placarDaEquipe, PISO_DE_DURACAO_MIN, ehRelampago, foiMedido, type Execucao } from '../desempenho'
import { relatorioDaTarefa, geralDoPeriodo, seriePorDia, type Lote } from '../relatorios'

const ex = (o: Partial<Execucao> & { tarefa: string; colaboradorId: string; minutos: number | null; unidades: number }): Execucao => ({
  ordemId: o.ordemId ?? `o-${o.colaboradorId}-${o.minutos}-${o.unidades}`,
  nome: o.nome ?? o.colaboradorId, quando: o.quando ?? new Date('2026-09-12T10:00:00Z'), ...o,
})
const lote = (o: Partial<Lote> & { tarefa: string; entregue: number }): Lote => ({
  ordemId: o.ordemId ?? `l-${o.tarefa}-${o.entregue}-${o.minutos}`,
  pedido: o.pedido ?? null, custoUnitario: o.custoUnitario ?? null,
  minutos: o.minutos ?? null, dia: o.dia ?? '2026-09-12', ...o,
})

const QUEIJO = 'porçao queijo 135 grama'

describe('⭐ o piso tem UM dono, e ele é 5', () => {
  it('a régua é do módulo, não um número solto em cada tela', () => {
    expect(PISO_DE_DURACAO_MIN).toBe(5)
  })

  it.each([
    [null, false, false], [0, false, false], [1, true, false], [4, true, false],
    [5, false, true], [6, false, true], [127, false, true],
  ])('minutos=%s → relâmpago %s · conta na média %s', (min, rel, medido) => {
    expect(ehRelampago(min as number | null)).toBe(rel)
    expect(foiMedido(min as number | null)).toBe(medido)
  })

  it('⚠️ zero NÃO é relâmpago — é "sem tempo", que já tinha nome', () => {
    // relâmpago é registro retroativo (alguém tocou iniciar e finalizar); zero é o que o
    // módulo já chamava de não-medido. Misturar os dois apagaria uma distinção real.
    expect(ehRelampago(0)).toBe(false)
    expect(foiMedido(0)).toBe(false)
  })
})

/** ⭐⭐ O CASO REAL DE PROD, com os números medidos: 3 relâmpagos entre 6 medidas */
const QUEIJO_REAL: Execucao[] = [
  ex({ tarefa: QUEIJO, colaboradorId: 'cristian', minutos: 1, unidades: 504 }),   // 06/09
  ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 1, unidades: 153 }),    // 10/09
  ex({ tarefa: QUEIJO, colaboradorId: 'carlisle', minutos: 1, unidades: 2 }),
  ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 52, unidades: 306 }),
  ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 84, unidades: 400 }),
  ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 127, unidades: 410 }),
  ex({ tarefa: QUEIJO, colaboradorId: 'lucas', minutos: null, unidades: 0 }),
]

describe('⛔⛔ a média do queijo — o caso que motivou o piso', () => {
  const m = mediaDaTarefa(QUEIJO, QUEIJO_REAL)

  it('⭐ a média sobe de 44 pra 88 — os 3 relâmpagos saem da conta', () => {
    expect(m.minutosPorLote).toBe(87.7)   // (52+84+127)/3 — antes do piso dava 44,3
    expect(m.medianaMinutos).toBe(84)     // antes do piso a mediana era 26,5
  })

  it('⚠️ e eles são CONTADOS À PARTE, nunca somidos', () => {
    expect(m.lotesMedidos).toBe(3)
    expect(m.lotesRelampago).toBe(3)
    expect(m.lotesSemTempo).toBe(1)
  })

  it('⛔ sobrando menos de 3 medidas, a tarefa PERDE a média — e o porquê cita o relâmpago', () => {
    // ⭐ é o desfecho honesto: se o que sustentava a média era registro retroativo, não há
    // média. Melhor "sem média ainda" que uma régua que compara gente com um toque de botão.
    const sem = QUEIJO_REAL.filter((e) => e.minutos !== 84 && e.minutos !== 127)
    const m2 = mediaDaTarefa(QUEIJO, sem)
    expect(m2.minutosPorLote).toBeNull()
    expect(m2.porQue).toContain('relâmpago')
  })
})

describe('⛔ o placar não compara ninguém com um relâmpago', () => {
  it('a pessoa cujo único lote foi relâmpago fica SEM MÉDIA, não "+98% mais rápida"', () => {
    // era exatamente o que prod mostrava: "Carlisle +98% vs média" por um lote de 1 min
    const p = placarDaEquipe([ex({ tarefa: QUEIJO, colaboradorId: 'carlisle', minutos: 1, unidades: 2 })], QUEIJO_REAL)
    expect(p[0].selo).toBe('SEM_MEDIA')
    expect(p[0].vsMediaPct).toBeNull()
    expect(p[0].tarefasRelampago).toBe(1)
  })

  it('⭐ e o VOLUME dela continua contado — o trabalho não some', () => {
    const p = placarDaEquipe([ex({ tarefa: QUEIJO, colaboradorId: 'cristian', minutos: 1, unidades: 504 })], QUEIJO_REAL)
    expect(p[0].unidades).toBe(504)
    expect(p[0].tarefas).toBe(1)
    expect(p[0].minutosMedidos).toBe(0)   // ⚠️ e o minuto NÃO entra: un/min seria absurdo
  })

  it('rodrigo, contra a média limpa, deixa de parecer metade do que é', () => {
    const p = placarDaEquipe([ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 127, unidades: 410 })], QUEIJO_REAL)
    // 127 contra 87,7 = −45%; com a média envenenada de 44,3 seria −187%
    expect(p[0].vsMediaPct).toBeGreaterThan(-60)
  })
})

describe('⭐ o piso vale no LOTE também (era lá que nascia o "melhor: 1min p/ 504 un")', () => {
  it('⛔ o destaque verde não coroa um registro retroativo', () => {
    const r = relatorioDaTarefa(QUEIJO, [
      lote({ tarefa: QUEIJO, entregue: 504, minutos: 1 }),    // o falso recorde de prod
      lote({ tarefa: QUEIJO, entregue: 410, minutos: 127 }),
    ], [], QUEIJO_REAL)
    expect(r.melhor?.unidades).toBe(410)
  })

  it('a linha do tempo não desenha ponto de relâmpago — o dia fica sem ponto, não em 1min', () => {
    const s = seriePorDia([
      lote({ tarefa: QUEIJO, entregue: 504, minutos: 1, dia: '2026-09-06' }),
      lote({ tarefa: QUEIJO, entregue: 410, minutos: 127, dia: '2026-09-12' }),
    ])
    expect(s[0].minutosPorLote).toBeNull()
    expect(s[0].unidades).toBe(504)        // ⚠️ o volume do dia continua
    expect(s[1].minutosPorLote).toBe(127)
  })

  it('as horas de cozinha não somam relâmpago — e o geral DIZ quantos foram', () => {
    const g = geralDoPeriodo([
      lote({ tarefa: QUEIJO, entregue: 504, minutos: 1 }),
      lote({ tarefa: QUEIJO, entregue: 410, minutos: 120 }),
      lote({ tarefa: QUEIJO, entregue: 100 }),
    ])
    expect(g.horas).toBe(2)
    expect(g.lotesRelampago).toBe(1)
    expect(g.lotesSemTempo).toBe(1)
    expect(g.lotes).toBe(3)
    expect(g.unidades).toBe(1014)
  })

  it('⭐ e o relatório da tarefa relata os relâmpagos do período', () => {
    const r = relatorioDaTarefa(QUEIJO, [
      lote({ tarefa: QUEIJO, entregue: 504, minutos: 1 }),
      lote({ tarefa: QUEIJO, entregue: 410, minutos: 127 }),
    ], [], QUEIJO_REAL)
    expect(r.lotesRelampago).toBe(1)
    expect(r.unidades).toBe(914)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────
// ⭐⭐ E O LEITOR MAIS ANTIGO DA FAMÍLIA (a tela "Por pessoa", 06/09) usa a MESMA régua.
//
// ⚠️ Se ele ficasse com a dele (`minutos > 0`), o mesmo registro retroativo entraria ali e
// ficaria fora dos Relatórios: **duas telas, dois vereditos sobre a mesma pessoa** — que é
// exatamente a doença que este módulo mais paga.
// ─────────────────────────────────────────────────────────────────────────────────────
import { porTarefaDaEquipe, type ExecucaoDeTarefa } from '../por-tarefa-da-equipe'

const et = (o: Partial<ExecucaoDeTarefa> & { colaboradorId: string; nome: string; minutos: number }): ExecucaoDeTarefa => ({
  tarefa: o.tarefa ?? 'moldar', produto: o.produto ?? 'beef', unidades: o.unidades ?? 20, ...o,
})
const tres = (o: Parameters<typeof et>[0]) => [et(o), et(o), et(o)]

describe('⭐ a tela "Por pessoa" herda o piso do dono único', () => {
  it('⛔ o relâmpago sai da CONTA, exatamente como o zero já saía', () => {
    const [l] = porTarefaDaEquipe([
      ...tres({ colaboradorId: 'b', nome: 'Bia', minutos: 1 }),
      ...tres({ colaboradorId: 'c', nome: 'Cris', minutos: 9 }),
    ])
    // ⚠️ a Cris é coroada — é a política de 06/09 ("quem TEM minuto medido continua
    // concorrendo, mesmo com um zero na mistura"), e o piso NÃO a muda: relâmpago é o zero
    // um minuto acima, não um caso novo. Eu tentei endurecer isso e os testes daquele dia
    // me pararam; mudar a régua da coroa é decisão do dono, não efeito colateral do piso.
    expect(l.maisRapido?.nome).toBe('Cris')
    // ⭐ o que o piso garante: o 1 min da Bia não vira velocidade nem entra na média
    expect(l.mediaDaEquipe).toBe(0.45)   // 27min ÷ 60un — só a Cris
    // ⚠️ e a Bia CONTINUA contada como quem fez a tarefa: o trabalho dela não some
    expect(l.pessoas).toBe(2)
    expect(l.volume).toBe(120)
  })

  it('⭐ e a média da equipe não é puxada pelo relâmpago', () => {
    const [l] = porTarefaDaEquipe([
      ...tres({ colaboradorId: 'b', nome: 'Bia', minutos: 1, unidades: 20 }),
      ...tres({ colaboradorId: 'c', nome: 'Cris', minutos: 10, unidades: 20 }),
      ...tres({ colaboradorId: 'd', nome: 'Dai', minutos: 20, unidades: 20 }),
    ])
    // só Cris e Dai contam: (30+60) ÷ (20×6) = 90/120 = 0,75
    // ⚠️ com a Bia dentro daria (30+60+3) ÷ 180 = 0,52 — a régua ficaria 30% mais dura
    // pra todo mundo por causa de três toques de botão
    expect(l.mediaDaEquipe).toBe(0.75)
    expect(l.maisRapido?.nome).toBe('Cris')
  })
})
