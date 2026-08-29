// REGRA 1 — O BURACO DOS R$ 2.444,62 TERIA ACORDADO VERMELHO ÀS 3H DA MESMA NOITE.
//
// O que houve: o extrato do Banrisul foi exportado NO MESMO DIA e veio sem uma transação
// que ainda não tinha liquidado. Sistema e banco ficaram diferentes — e só apareceu porque
// o dono importou de novo. Com cliente, viveria semanas mudo.
//
// ⚠️⚠️ O INVARIANTE ÓBVIO SERIA INÚTIL: o `balance` da conta é ANCORADO no LEDGERBAL, então
// "saldo na data da âncora == LEDGERBAL" é CIRCULAR e daria verde inclusive com o buraco
// aberto. O teste abaixo prova que a versão que MORDE é outra: dois LEDGERBAL consecutivos
// têm que ser reconciliados pelas transações do intervalo.

import { describe, it, expect } from 'vitest'
import { avaliarConta, estadoDaConferencia, ondeDescolou, DIAS_SEM_CONFERIR, type LeituraConta } from '../ledgerbal-invariants'

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const HOJE = D('2026-08-28')

/** os números REAIS do Banrisul da Caçula */
const ANCORA_25 = { data: D('2026-08-25'), valor: -9434.99 }
const ANCORA_28 = { data: D('2026-08-28'), valor: -1267.03 }
const SOMA_CORRETA = 8167.96 // linhas de 26–28/08 COM o empréstimo
const SOMA_SEM_EMPRESTIMO = 10612.58 // o que o sistema teria sem a linha descartada

const conta = (over: Partial<LeituraConta> = {}): LeituraConta => ({
  bankAccountId: 'banrisul',
  contaNome: 'banrisul',
  companyId: 'cacula',
  ancoras: [ANCORA_25, ANCORA_28],
  somaNoIntervalo: () => SOMA_CORRETA,
  balanceGravado: -1267.03,
  ledgerBalVigente: -1267.03,
  ledgerBalDataVigente: D('2026-08-28'),
  somaPosAncora: 0,
  ...over,
})

describe('⭐⭐ B1 — o buraco real teria sido pego na mesma noite', () => {
  it('⭐ faltando a linha de 2.444,62 → VERMELHO com o valor e a instrução', () => {
    const r = avaliarConta(conta({ somaNoIntervalo: () => SOMA_SEM_EMPRESTIMO }), HOJE)
    const b1 = r.find((c) => c.invariante === 'B1')!
    expect(b1).toBeDefined()
    expect(b1.nivel).toBe('erro')
    expect(Math.abs(b1.diferenca!)).toBeCloseTo(2444.62, 2)
    expect(b1.detalhe).toContain('25/08')
    expect(b1.detalhe).toContain('28/08')
    expect(b1.detalhe).toMatch(/Re-exporte o extrato/i) // instrução acionável, não enigma
  })

  it('⭐ com a linha dentro → silêncio (é o estado de agora, depois do fix)', () => {
    expect(avaliarConta(conta(), HOJE)).toEqual([])
  })

  it('⚠️ e diz de que LADO está o buraco (sistema a mais × banco a mais)', () => {
    // ⚠️ o sinal diz de que LADO sobra; a causa tem DUAS possibilidades e a mensagem
    // apresenta as duas — afirmar uma só mandaria o dono procurar no lugar errado.
    const somaMenos = avaliarConta(conta({ somaNoIntervalo: () => SOMA_CORRETA - 500 }), HOJE)[0]
    expect(somaMenos.detalhe).toContain('sobram')
    expect(somaMenos.detalhe).toContain('faltar uma ENTRADA')
    expect(somaMenos.detalhe).toContain('SAÍDA duplicada')
    const somaMais = avaliarConta(conta({ somaNoIntervalo: () => SOMA_CORRETA + 500 }), HOJE)[0]
    expect(somaMais.detalhe).toContain('faltar uma SAÍDA')
    expect(somaMais.detalhe).toContain('ENTRADA duplicada')
  })

  it('tolerância de 1 centavo (arredondamento não vira alarme)', () => {
    expect(avaliarConta(conta({ somaNoIntervalo: () => SOMA_CORRETA + 0.01 }), HOJE)).toEqual([])
    expect(avaliarConta(conta({ somaNoIntervalo: () => SOMA_CORRETA + 0.02 }), HOJE)).toHaveLength(1)
  })

  it('⚠️ duas declarações do MESMO dia não viram intervalo (o banco re-declara)', () => {
    // aconteceu de verdade em 26/08: dois imports, mesma âncora (25/08), LEDGERBAL
    // diferentes (−6.408,68 e −9.434,99). Comparar os dois como "intervalo" seria ruído.
    const r = avaliarConta(conta({
      ancoras: [{ data: D('2026-08-25'), valor: -6408.68 }, { data: D('2026-08-25'), valor: -9434.99 }, ANCORA_28],
      somaNoIntervalo: () => SOMA_CORRETA,
    }), HOJE)
    expect(r.filter((c) => c.invariante === 'B1')).toEqual([])
  })
})

describe('⚠️ o invariante CIRCULAR que eu quase escrevi', () => {
  it('"saldo == LEDGERBAL na data da âncora" daria verde COM o buraco aberto', () => {
    // o balance é ancorado: balance = ledgerBal + Σ(pós-âncora). Comparar os dois é
    // comparar o número com ele mesmo — passa sempre, inclusive errado.
    const comBuraco = conta({ somaNoIntervalo: () => SOMA_SEM_EMPRESTIMO })
    expect(comBuraco.balanceGravado).toBe(comBuraco.ledgerBalVigente! + comBuraco.somaPosAncora)
    // e mesmo assim o B1 acusa — é ele que enxerga o que o circular não vê
    expect(avaliarConta(comBuraco, HOJE).some((c) => c.invariante === 'B1')).toBe(true)
  })
})

describe('B2 — o cache do saldo driftou?', () => {
  it('balance ≠ âncora + movimento posterior → erro com o número', () => {
    const r = avaliarConta(conta({ balanceGravado: -1000, somaPosAncora: 0 }), HOJE)
    const b2 = r.find((c) => c.invariante === 'B2')!
    expect(b2.nivel).toBe('erro')
    expect(b2.detalhe).toContain('Recalcule')
  })

  it('com movimento pós-âncora, a reconstrução considera ele', () => {
    expect(avaliarConta(conta({ balanceGravado: -267.03, somaPosAncora: 1000 }), HOJE)).toEqual([])
  })
})

describe('B3 — conta sem conferência (aviso, não erro)', () => {
  it(`avisa depois de ${DIAS_SEM_CONFERIR} dias`, () => {
    const r = avaliarConta(conta({ ledgerBalDataVigente: D('2026-08-01') }), D('2026-08-28'))
    const b3 = r.find((c) => c.invariante === 'B3')!
    expect(b3.nivel).toBe('aviso')
    expect(b3.detalhe).toContain('27 dias')
  })

  it('conta que NUNCA conferiu (cofre, caixa) avisa que o saldo é digitado', () => {
    const r = avaliarConta(conta({ ancoras: [], ledgerBalVigente: null, ledgerBalDataVigente: null }), HOJE)
    expect(r).toHaveLength(1)
    expect(r[0].invariante).toBe('B3')
    expect(r[0].detalhe).toContain('digitado')
  })

  it('⚠️ conferida hoje não avisa nada', () => {
    expect(avaliarConta(conta(), HOJE)).toEqual([])
  })
})

describe('⭐ o estado que a TELA de Contas mostra', () => {
  it('conferido → "conferido com o banco em DD/MM"', () => {
    const e = estadoDaConferencia(conta(), HOJE)
    expect(e.conferido).toBe(true)
    // com ANO: "conferido em 28/08" fica ambíguo quando a conta está parada há meses —
    // e conta parada é justamente o caso em que o dono precisa enxergar a data.
    expect(e.rotulo).toBe('conferido com o banco em 28/08/2026')
  })

  it('divergente → "divergente em R$ X desde DD/MM"', () => {
    const e = estadoDaConferencia(conta({ somaNoIntervalo: () => SOMA_SEM_EMPRESTIMO }), HOJE)
    expect(e.conferido).toBe(false)
    expect(e.rotulo).toContain('divergente em')
    expect(e.rotulo).toContain('2.444,62')
    expect(e.rotulo).toContain('28/08/2026')
  })

  it('nunca conferida → diz isso, não finge que está ok', () => {
    const e = estadoDaConferencia(conta({ ancoras: [], ledgerBalVigente: null, ledgerBalDataVigente: null }), HOJE)
    expect(e.rotulo).toBe('nunca conferida com o banco')
  })
})

describe('⭐ diagnóstico guiado do import (item 3)', () => {
  it('aponta o PRIMEIRO intervalo que não fecha, com instrução pro leigo', () => {
    const d = ondeDescolou(conta({ somaNoIntervalo: () => SOMA_SEM_EMPRESTIMO }))!
    expect(d.de).toEqual(D('2026-08-25'))
    expect(d.ate).toEqual(D('2026-08-28'))
    expect(d.instrucao).toContain('25/08')
    expect(d.instrucao).toContain('re-exporte o extrato')
    expect(d.instrucao).toContain('2.444,62')
  })

  it('tudo fechando → null (não inventa diagnóstico)', () => {
    expect(ondeDescolou(conta())).toBeNull()
  })
})
