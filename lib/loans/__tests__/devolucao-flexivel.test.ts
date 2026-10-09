/**
 * ⭐ AS RÉGUAS PURAS DA PORTA DE DEVOLUÇÃO (09/10/2026) — alocação, descrição e a soma.
 */
import { describe, it, expect } from 'vitest'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

import {
  proximaReferenciaAberta,
  nomeCurtoDoCredor,
  descricaoDaDevolucao,
  devolucoesDoContrato,
  fraseDoQueVaiAcontecer,
  JANELA_DA_BUSCA_DIAS,
} from '../devolucao-flexivel'

/** a agenda REAL do contrato em prod: #1..#3 pagas, #4..#7 abertas */
const AGENDA = [
  { id: 'i1', number: 1, dueDate: new Date('2026-09-15T00:00:00Z'), payment: 41428.57, status: 'PAID' },
  { id: 'i2', number: 2, dueDate: new Date('2026-10-15T00:00:00Z'), payment: 41428.57, status: 'PAID' },
  { id: 'i3', number: 3, dueDate: new Date('2026-11-15T00:00:00Z'), payment: 41428.57, status: 'PAID' },
  { id: 'i4', number: 4, dueDate: new Date('2026-12-15T00:00:00Z'), payment: 41428.57, status: 'OPEN' },
  { id: 'i5', number: 5, dueDate: new Date('2027-01-15T00:00:00Z'), payment: 41428.57, status: 'OPEN' },
]

describe('⭐ a alocação: próxima referência ABERTA por ordem', () => {
  it('⭐ com #1..#3 pagas, a devolução de hoje cai na #4 — como as 3 primeiras caíram', () => {
    const r = proximaReferenciaAberta(AGENDA)
    expect(r?.number).toBe(4)
    expect(r?.payment).toBe(41428.57)
  })

  it('⚠️ a ORDEM manda, não a posição no array — agenda fora de ordem não muda a resposta', () => {
    const bagunçada = [AGENDA[4], AGENDA[0], AGENDA[3], AGENDA[2], AGENDA[1]]
    expect(proximaReferenciaAberta(bagunçada)?.number).toBe(4)
  })

  it('⛔ PARTIAL continua ABERTA — só `PAID` sai da fila', () => {
    const comParcial = AGENDA.map((i) => (i.number === 4 ? { ...i, status: 'PARTIAL' } : i))
    expect(proximaReferenciaAberta(comParcial)?.number).toBe(4)
  })

  it('⛔ agenda toda paga devolve `null` — o gesto RECUSA em vez de inventar referência', () => {
    expect(proximaReferenciaAberta(AGENDA.map((i) => ({ ...i, status: 'PAID' })))).toBeNull()
  })
})

describe('⭐ a descrição automática', () => {
  it('⭐ o formato do dono: "Devolução de mútuo — Arafat (4ª devolução)"', () => {
    expect(descricaoDaDevolucao('Arafat (arafet thalji)', 4)).toBe(
      'Devolução de mútuo — Arafat (4ª devolução)',
    )
  })

  it('⚠️ o nome curto tira o parêntese do cadastro, e NÃO corta por tamanho', () => {
    expect(nomeCurtoDoCredor('Arafat (arafet thalji)')).toBe('Arafat')
    // ⛔ cortar por tamanho truncaria nome legítimo
    expect(nomeCurtoDoCredor('Banco Cooperativo Sicredi S.A.')).toBe('Banco Cooperativo Sicredi S.A.')
    expect(nomeCurtoDoCredor('(só parêntese)')).toBe('(só parêntese)')
  })

  it('⚠️ o N conta DEVOLUÇÕES, não o número da referência — no flexível os dois divergem', () => {
    // a 4ª devolução cai na referência #4 hoje; no dia em que ele devolver 2× no mesmo mês, não
    expect(descricaoDaDevolucao('Arafat (arafet thalji)', 5)).toContain('5ª devolução')
  })
})

describe('⭐⭐ quanto já foi devolvido — as DUAS portas de vínculo', () => {
  it('⭐ o estado real de prod: 2 por 1:1 (jul/ago) + 1 por N:1 (set) = 140.000', () => {
    const r = devolucoesDoContrato([
      { reconciledTransaction: { amount: 40000 }, payments: [] },
      { reconciledTransaction: { amount: 50000 }, payments: [] },
      { reconciledTransaction: null, payments: [{ amount: 50000 }] },
      { reconciledTransaction: null, payments: [] },
    ])
    expect(r.quantas).toBe(3)
    expect(r.totalDevolvido).toBe(140000)
  })

  it('⛔⛔ ler SÓ a porta 1:1 perderia a de setembro — foi literalmente o bug de 14/08', () => {
    const so11 = [
      { reconciledTransaction: { amount: 40000 }, payments: [] },
      { reconciledTransaction: { amount: 50000 }, payments: [] },
      { reconciledTransaction: null, payments: [{ amount: 50000 }] },
    ].filter((i) => i.reconciledTransaction)
    expect(devolucoesDoContrato(so11).totalDevolvido, 'a régua cega daria 90.000').toBe(90000)
    // ⭐ e a régua certa não é cega
    expect(
      devolucoesDoContrato([
        { reconciledTransaction: { amount: 40000 }, payments: [] },
        { reconciledTransaction: { amount: 50000 }, payments: [] },
        { reconciledTransaction: null, payments: [{ amount: 50000 }] },
      ]).totalDevolvido,
    ).toBe(140000)
  })

  it('⭐ mordidas na MESMA referência contam como devoluções separadas — cada saída é um fato', () => {
    const r = devolucoesDoContrato([
      { reconciledTransaction: null, payments: [{ amount: 20000 }, { amount: 20000 }] },
    ])
    expect(r.quantas).toBe(2)
    expect(r.totalDevolvido).toBe(40000)
  })
})

describe('⭐ a frase do que vai acontecer', () => {
  it('⭐ CASAR diz que NÃO cria saída nova — é a trava do "nunca duas saídas"', () => {
    const f = fraseDoQueVaiAcontecer('CASAR', 40000, 'caixa loja/cofre')
    expect(f).toContain('nenhuma saída nova')
    /** ⚠️ o Intl usa espaço NÃO-QUEBRÁVEL depois do R$ — comparar com literal nunca casa */
    expect(f).toContain(brl(40000))
  })

  it('⭐ CRIAR diz que a saída e o vínculo saem no MESMO gesto', () => {
    const f = fraseDoQueVaiAcontecer('CRIAR', 40000, 'caixa loja/cofre')
    expect(f).toContain('mesmo gesto')
    expect(f).toContain('caixa loja/cofre')
  })
})

describe('⚠️ a janela da busca', () => {
  it('⛔ 10 dias: curta o bastante pra NÃO alcançar a devolução do mês anterior', () => {
    // as devoluções reais estão ~29 dias uma da outra (06/07 · 04/08 · 01/09)
    expect(JANELA_DA_BUSCA_DIAS).toBeLessThan(29)
    // e larga o bastante pra o lançamento de ontem
    expect(JANELA_DA_BUSCA_DIAS).toBeGreaterThanOrEqual(2)
  })
})
