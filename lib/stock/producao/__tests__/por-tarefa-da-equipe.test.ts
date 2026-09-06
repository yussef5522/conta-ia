// ⭐⭐ O RECORTE POR TAREFA E AS TRAVAS DELE (06/09/2026).
//
// **A régua do dono:** *"quem faz gessado mais rápido ≠ quem molda mais rápido"*. E a trava que
// mais importa: **uma pessoa só não faz um "mais rápido"** — coroar sem ninguém pra comparar é
// dar um prêmio que não foi disputado, e quem lê a tela não tem como saber disso.

import { describe, it, expect } from 'vitest'
import {
  porTarefaDaEquipe, unidadesPorSemana, pctDoEsperado,
  MINIMO_NA_TAREFA, type ExecucaoDeTarefa,
} from '../por-tarefa-da-equipe'

const ex = (o: Partial<ExecucaoDeTarefa> = {}): ExecucaoDeTarefa => ({
  tarefa: 'gessado', produto: 'beef de xis', colaboradorId: 'a', nome: 'Ana',
  minutos: 10, unidades: 20, ...o,
})
/** 3 execuções iguais — o mínimo pra a pessoa entrar na disputa da tarefa */
const tresDe = (o: Partial<ExecucaoDeTarefa>) => [ex(o), ex(o), ex(o)]

describe('⭐⭐ cada tarefa elege pela SUA régua', () => {
  it('⭐ o mais rápido da tarefa é o de MENOR min/un — e a média é a DESTA tarefa', () => {
    const linhas = porTarefaDaEquipe([
      ...tresDe({ colaboradorId: 'a', nome: 'Ana', minutos: 10, unidades: 20 }),   // 0,50
      ...tresDe({ colaboradorId: 'b', nome: 'Bia', minutos: 6, unidades: 20 }),    // 0,30
    ])
    expect(linhas).toHaveLength(1)
    expect(linhas[0].maisRapido?.nome, 'elegeu o mais LENTO').toBe('Bia')
    expect(linhas[0].maisRapido?.minPorUnidade).toBe(0.3)
    // ⚠️ (10+10+10+6+6+6) ÷ (20×6) = 48/120 = 0,40 — a média DESTA tarefa
    expect(linhas[0].mediaDaEquipe).toBe(0.4)
    expect(linhas[0].volume).toBe(120)
    expect(linhas[0].pessoas).toBe(2)
  })

  it('⭐⭐ tarefas diferentes NÃO se comparam entre si', () => {
    // ⚠️ o "moldar" é naturalmente mais rápido; num ranking único a Bia venceria por fazer
    // uma tarefa mais fácil, não por ser melhor.
    const linhas = porTarefaDaEquipe([
      ...tresDe({ tarefa: 'gessado', colaboradorId: 'a', nome: 'Ana', minutos: 10, unidades: 20 }),
      ...tresDe({ tarefa: 'gessado', colaboradorId: 'c', nome: 'Cris', minutos: 14, unidades: 20 }),
      ...tresDe({ tarefa: 'moldar', colaboradorId: 'b', nome: 'Bia', minutos: 2, unidades: 20 }),
      ...tresDe({ tarefa: 'moldar', colaboradorId: 'c', nome: 'Cris', minutos: 3, unidades: 20 }),
    ])
    const gessado = linhas.find((l) => l.tarefa === 'gessado')!
    const moldar = linhas.find((l) => l.tarefa === 'moldar')!
    expect(gessado.maisRapido?.nome).toBe('Ana')
    expect(moldar.maisRapido?.nome).toBe('Bia')
    // ⚠️ a Ana (0,50) é MAIS LENTA que a Cris no moldar (0,15) e mesmo assim vence o gessado
    expect(gessado.mediaDaEquipe).toBe(0.6)
    // ⚠️ 15/120 = 0,125 → 0,13: min/un anda em 2 casas, a MESMA régua que a tela imprime.
    // Uma média em precisão cheia aqui faria a barra dizer um número e o card outro.
    expect(moldar.mediaDaEquipe).toBe(0.13)
  })

  it('⭐ ordena por VOLUME — é onde ganho de velocidade vale dinheiro', () => {
    const linhas = porTarefaDaEquipe([
      ex({ tarefa: 'pouco', unidades: 5 }),
      ex({ tarefa: 'muito', unidades: 900 }),
    ])
    expect(linhas.map((l) => l.tarefa)).toEqual(['muito', 'pouco'])
  })
})

describe('⛔⛔ as travas do "mais rápido"', () => {
  it('⛔⛔ UMA PESSOA SÓ não é a mais rápida — é a única', () => {
    const linhas = porTarefaDaEquipe(tresDe({ tarefa: 'calabresa', colaboradorId: 'a', nome: 'Ana' }))
    expect(linhas[0].maisRapido, 'coroou alguém sem disputa').toBeNull()
    expect(linhas[0].semVencedor).toBe('a apurar — só uma pessoa fez')
    // ⚠️ a média DA TAREFA continua existindo — ela não depende de disputa
    expect(linhas[0].mediaDaEquipe).toBe(0.5)
  })

  it('⛔ abaixo do mínimo de vezes ninguém concorre — mas a linha DIZ isso', () => {
    const linhas = porTarefaDaEquipe([
      ex({ colaboradorId: 'a', nome: 'Ana', minutos: 1, unidades: 20 }),
      ex({ colaboradorId: 'b', nome: 'Bia', minutos: 30, unidades: 20 }),
    ])
    expect(linhas[0].maisRapido, 'uma execução virou "a mais rápida"').toBeNull()
    expect(linhas[0].semVencedor).toContain(`${MINIMO_NA_TAREFA}+`)
  })

  it('⛔⛔ EMPATE não elege — nomeia os dois', () => {
    const linhas = porTarefaDaEquipe([
      ...tresDe({ colaboradorId: 'a', nome: 'Ana', minutos: 10, unidades: 20 }),
      ...tresDe({ colaboradorId: 'b', nome: 'Bia', minutos: 10, unidades: 20 }),
    ])
    expect(linhas[0].maisRapido).toBeNull()
    expect(linhas[0].semVencedor).toMatch(/empate: (Ana e Bia|Bia e Ana)/)
  })

  it('⛔ sem quantidade medida não há taxa — e a média vira "a apurar", nunca 0', () => {
    const linhas = porTarefaDaEquipe([
      ...tresDe({ colaboradorId: 'a', nome: 'Ana', unidades: 0 }),
      ...tresDe({ colaboradorId: 'b', nome: 'Bia', unidades: 0 }),
    ])
    expect(linhas[0].maisRapido).toBeNull()
    expect(linhas[0].mediaDaEquipe, 'inventou média 0 sem quantidade').toBeNull()
    expect(linhas[0].volume).toBe(0)
  })

  it('⛔⛔ TEMPO ZERO não é velocidade infinita — é tempo não medido', () => {
    // ⚠️ ACHADO NO DADO REAL (06/09): o módulo guarda MINUTOS, e a tarefa fechada em segundos
    // arredonda pra 0. A tela mostrava "média 0 min/un", que se lê como "o mais rápido de
    // todos" — número inventado com cara de medição, no card que existe pra ser justo.
    const linhas = porTarefaDaEquipe([
      ...tresDe({ colaboradorId: 'a', nome: 'Ana', minutos: 0, unidades: 3 }),
      ...tresDe({ colaboradorId: 'b', nome: 'Bia', minutos: 0, unidades: 3 }),
    ])
    expect(linhas[0].mediaDaEquipe, 'zero minuto virou uma velocidade').toBeNull()
    expect(linhas[0].maisRapido, 'coroou alguém por não ter dado pra medir').toBeNull()
    expect(linhas[0].semVencedor).toBe('a apurar — o tempo medido foi menor que 1 minuto')
    // ⚠️ e o VOLUME continua contado — o que não dá pra medir é a velocidade, não a produção
    expect(linhas[0].volume).toBe(18)
  })

  it('⭐ mas quem TEM minuto medido continua concorrendo, mesmo com um zero na mistura', () => {
    const linhas = porTarefaDaEquipe([
      ...tresDe({ colaboradorId: 'a', nome: 'Ana', minutos: 0, unidades: 3 }),
      ...tresDe({ colaboradorId: 'b', nome: 'Bia', minutos: 9, unidades: 3 }),
    ])
    expect(linhas[0].maisRapido?.nome, 'o zero roubou a coroa de quem foi medido').toBe('Bia')
    // ⚠️ 27min ÷ 9 un = 3,0 — a média cobre SÓ o que foi medido. Com o trabalho de 0 minuto
    // no denominador daria 1,5, e a régua da equipe ficaria mais dura pra todo mundo por
    // causa de tarefas que ninguém cronometrou.
    expect(linhas[0].mediaDaEquipe).toBe(3)
  })

  it('⭐ o subtítulo da linha lista os produtos, sem repetir', () => {
    const linhas = porTarefaDaEquipe([
      ex({ produto: 'beef de xis' }), ex({ produto: 'beef de xis' }), ex({ produto: 'beef de hambúrguer' }),
    ])
    expect(linhas[0].produtos).toEqual(['beef de xis', 'beef de hambúrguer'])
  })
})

describe('⭐ a sparkline e o selo', () => {
  const dia = (n: number) => new Date(Date.UTC(2026, 8, n))

  it('⭐⭐ semana é BLOCO DE 7 DIAS do início do período, não semana do calendário', () => {
    // ⚠️ o mês que começa numa quarta teria "semana 1" com 5 dias contra 7 nas outras — a
    // barra menor diria "produziu menos" quando só houve menos dias.
    const s = unidadesPorSemana([
      { quando: dia(1), unidades: 10 }, { quando: dia(7), unidades: 5 },   // semana 1
      { quando: dia(8), unidades: 40 },                                    // semana 2
      { quando: dia(22), unidades: 7 },                                    // semana 4
    ], dia(1), dia(29))
    expect(s).toEqual([15, 40, 0, 7])
  })

  it('⛔ evento fora do período não entra na sparkline', () => {
    expect(unidadesPorSemana([{ quando: dia(30), unidades: 99 }], dia(1), dia(8))).toEqual([0])
  })

  it('⭐ período curto ainda tem UMA semana — nunca zero barras', () => {
    expect(unidadesPorSemana([{ quando: dia(2), unidades: 3 }], dia(1), dia(3))).toEqual([3])
  })

  it('⛔ o selo é % do esperado — e "a apurar" NUNCA vira 100%', () => {
    expect(pctDoEsperado(3)).toBe(103)
    expect(pctDoEsperado(-2)).toBe(98)
    expect(pctDoEsperado(null), 'inventou nota 100% sem medição').toBeNull()
  })
})
