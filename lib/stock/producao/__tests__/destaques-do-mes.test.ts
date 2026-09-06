// ⭐⭐ AS RÉGUAS DE HONESTIDADE DOS DESTAQUES (06/09/2026).
//
// **A régua do dono:** *"Um prêmio único misturaria réguas diferentes; três facetas contam a
// história — quem leva as três ganhou de verdade."* E as travas contra injustiça importam
// tanto quanto o visual: **um destaque injusto é lido como acusação**, e quem foi
// injustiçado uma vez não confia mais na tela.

import { describe, it, expect } from 'vitest'
import {
  destaquesDoMes, levouAsTres, aptoNaFaceta, mediaDaEquipe,
  MINIMO_DE_TAREFAS_PRA_RANKEAR, type CandidatoADestaque,
} from '../destaques-do-mes'

const p = (nome: string, o: Partial<CandidatoADestaque> = {}): CandidatoADestaque => ({
  colaboradorId: nome.toLowerCase(), nome,
  tarefas: 5, produziu: 100, minPorUnidade: 2, rendimentoVsEsperado: 0, ...o,
})

const daFaceta = (ds: ReturnType<typeof destaquesDoMes>, f: string) => ds.find((d) => d.faceta === f)!

describe('⭐⭐ três facetas, nunca um prêmio único', () => {
  const time = [
    p('Carlise', { tarefas: 10, produziu: 400, minPorUnidade: 3.0, rendimentoVsEsperado: 2 }),
    p('Michelle', { tarefas: 8, produziu: 200, minPorUnidade: 1.5, rendimentoVsEsperado: -1 }),
    p('Nadine', { tarefas: 6, produziu: 150, minPorUnidade: 4.0, rendimentoVsEsperado: 9 }),
  ]

  it('⭐⭐ cada faceta elege por SUA régua — e o sentido de cada uma é diferente', () => {
    const d = destaquesDoMes(time)
    expect(daFaceta(d, 'MAIS_PRODUZIU').quem[0].nome).toBe('Carlise')
    // ⛔ min/un é MENOR-melhor: tratar as três com a mesma comparação premiaria a mais lenta
    expect(daFaceta(d, 'MAIS_RAPIDO').quem[0].nome).toBe('Michelle')
    expect(daFaceta(d, 'MELHOR_RENDIMENTO').quem[0].nome).toBe('Nadine')
  })

  it('⭐ e o valor vem com a unidade certa em cada card', () => {
    const d = destaquesDoMes(time)
    expect(daFaceta(d, 'MAIS_PRODUZIU')).toMatchObject({ valor: 400, unidadeDoValor: 'un' })
    expect(daFaceta(d, 'MAIS_RAPIDO')).toMatchObject({ valor: 1.5, unidadeDoValor: 'min/un' })
    expect(daFaceta(d, 'MELHOR_RENDIMENTO')).toMatchObject({ valor: 9, unidadeDoValor: '%' })
  })

  it('⭐⭐ "levou as três" só vale quando as três TÊM vencedor', () => {
    const soberana = [p('Carlise', { tarefas: 9, produziu: 500, minPorUnidade: 1.0, rendimentoVsEsperado: 12 }), p('Michelle', { tarefas: 5, produziu: 100, minPorUnidade: 3, rendimentoVsEsperado: 1 })]
    expect(levouAsTres(destaquesDoMes(soberana)).map((x) => x.nome)).toEqual(['Carlise'])
    // ⚠️ mês sem régua de rendimento: ninguém "ganhou tudo", porque não houve tudo pra ganhar
    const semRegua = soberana.map((x) => ({ ...x, rendimentoVsEsperado: null }))
    expect(levouAsTres(destaquesDoMes(semRegua))).toEqual([])
  })
})

describe('⛔⛔ as travas contra injustiça', () => {
  it('⛔⛔ VOLUME MÍNIMO: 1 tarefa não vira "mais rápido" — pode ter sido sorte', () => {
    const time = [
      p('Sortuda', { tarefas: 1, produziu: 10, minPorUnidade: 0.5 }),
      p('Constante', { tarefas: 8, produziu: 300, minPorUnidade: 2.0 }),
    ]
    const d = daFaceta(destaquesDoMes(time), 'MAIS_RAPIDO')
    expect(d.quem.map((q) => q.nome), 'uma tarefa levou o prêmio de velocidade').toEqual(['Constante'])
    expect(MINIMO_DE_TAREFAS_PRA_RANKEAR).toBe(3)
  })

  it('⭐ mas "MAIS PRODUZIU" não exige mínimo — produzir muito É o mérito', () => {
    // ⚠️ exigir 3 tarefas pra reconhecer quem fez 2 lotes gigantes seria a régua errada
    const time = [p('Dois lotes', { tarefas: 2, produziu: 900 }), p('Muitas', { tarefas: 9, produziu: 300 })]
    expect(daFaceta(destaquesDoMes(time), 'MAIS_PRODUZIU').quem[0].nome).toBe('Dois lotes')
    expect(aptoNaFaceta(time[0], 'MAIS_PRODUZIU')).toBe(true)
    expect(aptoNaFaceta(time[0], 'MAIS_RAPIDO'), 'velocidade com 2 tarefas é amostra').toBe(false)
  })

  it('⛔⛔ EMPATE mostra os DOIS — não desempata no escuro', () => {
    const time = [p('A', { minPorUnidade: 2.0 }), p('B', { minPorUnidade: 2.0 }), p('C', { minPorUnidade: 5 })]
    const d = daFaceta(destaquesDoMes(time), 'MAIS_RAPIDO')
    expect(d.quem.map((q) => q.nome).sort(), 'desempatou por ordem alfabética/id').toEqual(['A', 'B'])
  })

  it('⛔ "A APURAR" com o PORQUÊ — nunca 0% nem nota inventada', () => {
    const cru = [p('Nova', { tarefas: 1, produziu: 20, minPorUnidade: 1, rendimentoVsEsperado: null })]
    const d = destaquesDoMes(cru)
    const rapido = daFaceta(d, 'MAIS_RAPIDO')
    expect(rapido.quem).toEqual([])
    expect(rapido.semDestaque, 'card vazio sem explicar vira mistério').toMatch(/pelo menos 3 tarefas/)
    const rend = daFaceta(d, 'MELHOR_RENDIMENTO')
    expect(rend.quem).toEqual([])
    expect(rend.semDestaque).toBeTruthy()
    // ⛔ e o valor NÃO vira 0 disfarçado de nota
    expect(rend.valor).toBe(0)
    expect(rend.unidadeDoValor).toBe('')
  })

  it('⛔ período vazio não inventa vencedor', () => {
    const d = destaquesDoMes([])
    expect(d).toHaveLength(3)
    expect(d.every((x) => x.quem.length === 0)).toBe(true)
    expect(d[0].semDestaque).toMatch(/Ninguém produziu/)
    expect(levouAsTres(d)).toEqual([])
  })

  it('⛔ quem não tem quantidade medida não concorre a velocidade', () => {
    // ⚠️ unidade misturada (kg com un) devolve minPorUnidade null lá no relatório —
    // aqui a pessoa simplesmente não entra na faceta, em vez de entrar com um número torto.
    const time = [p('Sem taxa', { minPorUnidade: null }), p('Com taxa', { minPorUnidade: 3 })]
    expect(daFaceta(destaquesDoMes(time), 'MAIS_RAPIDO').quem.map((q) => q.nome)).toEqual(['Com taxa'])
  })
})

describe('⚠️ a média da equipe carrega o próprio risco', () => {
  it('⛔⛔ com menos de 3 pessoas a comparação NÃO é confiável — e a lib diz isso', () => {
    // ⚠️ com 2 pessoas, uma está sempre "abaixo da média" por construção. Lido como nota,
    // é injusto — a tela mostra a barra apagada e avisa.
    const duas = mediaDaEquipe([p('A', { minPorUnidade: 2 }), p('B', { minPorUnidade: 4 })])
    expect(duas.media).toBe(3)
    expect(duas.confiavel).toBe(false)
    expect(duas.pessoas).toBe(2)
  })

  it('⭐ com 3+ pessoas passa a valer', () => {
    const tres = mediaDaEquipe([p('A', { minPorUnidade: 2 }), p('B', { minPorUnidade: 4 }), p('C', { minPorUnidade: 3 })])
    expect(tres).toMatchObject({ media: 3, confiavel: true, pessoas: 3 })
  })

  it('⛔ e quem está abaixo do volume mínimo não entra NEM na média', () => {
    // ⚠️ senão a régua da equipe seria puxada por uma amostra de 1 tarefa
    const m = mediaDaEquipe([p('Amostra', { tarefas: 1, minPorUnidade: 0.2 }), p('A', { minPorUnidade: 2 }), p('B', { minPorUnidade: 4 })])
    expect(m.media, 'a amostra de 1 tarefa entrou na média da equipe').toBe(3)
    expect(m.pessoas).toBe(2)
  })

  it('⭐ sem ninguém com taxa, a média é "a apurar" — não zero', () => {
    expect(mediaDaEquipe([p('X', { minPorUnidade: null })])).toMatchObject({ media: null, confiavel: false })
  })
})
