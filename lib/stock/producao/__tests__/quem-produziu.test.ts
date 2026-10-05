/**
 * ⭐⭐ QUEM PRODUZIU — os nomes saem DAS ETAPAS, e a frase é a mesma em qualquer tela.
 *
 * ⚠️ Executa a régua (REGRA 3): a frase vivia dentro do `return` do `ConclusaoForm` e só dava
 * pra conferir por grep.
 */
import { describe, it, expect } from 'vitest'
import { quemProduziuNasEtapas, fraseDeQuemProduziu } from '../quem-produziu'

describe('⭐⭐ quemProduziuNasEtapas — fato (iniciou), nunca plano (designado)', () => {
  it('⛔⛔ o designado que NÃO iniciou não produziu nada', () => {
    expect(
      quemProduziuNasEtapas([
        { executorNome: null, participantes: [{ nome: 'rodrigo', iniciou: true }, { nome: 'nadine', iniciou: false }] },
      ]),
      'nadine foi planejada e não apareceu — pôr o nome dela escreveria o trabalho do rodrigo na conta dela',
    ).toEqual(['rodrigo'])
  })

  it('⭐ a DUPLA que trabalhou junto aparece inteira, na ordem', () => {
    expect(
      quemProduziuNasEtapas([
        { executorNome: null, participantes: [{ nome: 'rodrigo', iniciou: true }, { nome: 'nadine', iniciou: true }] },
      ]),
    ).toEqual(['rodrigo', 'nadine'])
  })

  it('⭐ duas etapas, duas mãos — cada uma entra uma vez', () => {
    expect(
      quemProduziuNasEtapas([
        { executorNome: 'eliane', participantes: [] },
        { executorNome: 'rodrigo', participantes: [] },
        { executorNome: 'eliane', participantes: [] },
      ]),
      'eliane fez duas etapas e é UMA pessoa',
    ).toEqual(['eliane', 'rodrigo'])
  })

  /** ⚠️ a cicatriz da conta `'sicredi '`: o espaço no fim existe no dado real desta casa */
  it('⚠️ "rodrigo", "Rodrigo" e "rodrigo " são a MESMA pessoa', () => {
    expect(
      quemProduziuNasEtapas([
        { executorNome: 'rodrigo', participantes: [] },
        { executorNome: 'Rodrigo', participantes: [] },
        { executorNome: 'rodrigo ', participantes: [] },
      ]),
    ).toEqual(['rodrigo'])
  })

  it('⛔ etapa sem ninguém NÃO inventa pessoa', () => {
    expect(quemProduziuNasEtapas([{ executorNome: null, participantes: [] }])).toEqual([])
    expect(quemProduziuNasEtapas([{ executorNome: '  ', participantes: [] }]), 'nem nome em branco').toEqual([])
    expect(quemProduziuNasEtapas([])).toEqual([])
  })

  /**
   * ⭐ O `executorNome` é o fallback do mundo SEM dupla (a etapa de antes de 08/09): quando há
   * participante que iniciou, ele manda; quando não há, o executor é quem carimbou o PIN.
   */
  it('⭐ participante que iniciou GANHA do executorNome na mesma etapa', () => {
    expect(
      quemProduziuNasEtapas([
        { executorNome: 'cristian', participantes: [{ nome: 'lucas', iniciou: true }] },
      ]),
    ).toEqual(['lucas'])
  })
})

describe('⭐ fraseDeQuemProduziu — a informação fica, a aula do PIN sai', () => {
  it('⭐ uma pessoa, duas, três', () => {
    expect(fraseDeQuemProduziu(['rodrigo'])).toBe('produzido por rodrigo (das etapas)')
    expect(fraseDeQuemProduziu(['rodrigo', 'nadine'])).toBe('produzido por rodrigo e nadine (das etapas)')
    expect(fraseDeQuemProduziu(['eliane', 'rodrigo', 'lucas'])).toBe(
      'produzido por eliane, rodrigo e lucas (das etapas)',
    )
  })

  /** ⚠️ `null` é estado próprio: a tela decide o que mostrar na ausência (lá, o dropdown) */
  it('⛔ ninguém assinou = null, nunca frase vazia', () => {
    expect(fraseDeQuemProduziu([])).toBeNull()
  })

  /**
   * ⛔⛔ **A EXPLICAÇÃO DO PIN NÃO VOLTA.** A ordem do dono: *"a informação fica (a linha
   * discreta), a explicação sai"*. Ensinar o mecanismo a quem acabou de usá-lo é ruído na tela
   * em que ele só quer digitar um número.
   */
  it('⛔⛔ a frase NÃO menciona PIN', () => {
    for (const nomes of [['rodrigo'], ['rodrigo', 'nadine']]) {
      expect(fraseDeQuemProduziu(nomes)!.toLowerCase()).not.toContain('pin')
    }
  })
})
