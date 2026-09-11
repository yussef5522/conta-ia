// ⛔⛔⛔ A PARCELA PAGA MOSTRAVA A PREVISÃO, NÃO O FATO (10/09/2026)
//
// **O dono, com a #3 do C61021346-2 recém-conciliada:** *"a linha do cronograma mostra
// JUROS R$ 0,00 · PARCELA R$ 2.777,80, como se eu tivesse pago sem juro nenhum. (…) É
// pós-fixado: o juros só nasce no vencimento — quando nasce, a linha ADOTA o nascido."*
//
// ⚠️ OS NÚMEROS SÃO OS DE PROD, medidos antes de escrever a régua.

import { describe, it, expect } from 'vitest'
import { linhaDoCronograma, jurosRealizados } from '../linha-do-cronograma'
import { buildLoanN1InterestTx } from '../dre-interest'

/** as 4 primeiras do C61021346-2, como estão no banco em 10/09 */
const P1 = { number: 1, interest: 1518.43, correcao: 0, amortization: 2777.80, payment: 4296.23,
  status: 'PAID', paidTotal: 4296.23, paidInterest: 1518.43, paidCorrection: 0, paidPenalty: 0,
  paidDate: new Date('2026-07-10') }
const P2 = { number: 2, interest: 473.23, correcao: 1097.68, amortization: 2777.73, payment: 4348.64,
  status: 'PAID', paidTotal: 4348.64, paidInterest: 473.23, paidCorrection: 1097.68, paidPenalty: 0,
  paidDate: new Date('2026-08-10') }
/** ⭐ a que o dono acabou de conciliar: agenda diz 2.777,80 sem juros; o banco cobrou 4.337,52 */
const P3 = { number: 3, interest: 0, correcao: 0, amortization: 2777.80, payment: 2777.80,
  status: 'PAID', paidTotal: 4337.52, paidInterest: 459.71, paidCorrection: 1100.01, paidPenalty: 0,
  paidDate: new Date('2026-09-10') }
const P4 = { number: 4, interest: 0, correcao: 0, amortization: 2777.77, payment: 2777.77,
  status: 'OPEN', paidTotal: null, paidInterest: null, paidCorrection: null, paidDate: null }

describe('⭐⭐ parcela PAGA relata o que aconteceu', () => {
  const l = linhaDoCronograma(P3)

  it('a #3 mostra os juros REAIS (1.559,72), não o zero da previsão', () => {
    expect(l.juros).toBeCloseTo(1559.72, 2)
    expect(l.realizado).toBe(true)
  })

  it('e a parcela REAL — 4.337,52, não 2.777,80', () => {
    expect(l.parcela).toBeCloseTo(4337.52, 2)
  })

  it('⚠️ a linha FECHA: amortização + encargos == parcela', () => {
    expect(round(l.amortizacao + l.juros)).toBeCloseTo(l.parcela, 2)
    expect(l.amortizacao).toBeCloseTo(2777.80, 2)
  })

  // ⚠️⚠️ REGRA 11 PEGOU UM TESTE MEU QUE NÃO MORDIA: eu repus o defeito (usar a
  // amortização da AGENDA na linha paga) e os 169 continuaram verdes — porque na #3 os
  // dois valores COINCIDEM (2.777,80). O caso que separa é o pagamento que não bate com a
  // previsão: aí a linha tem que fechar pelo FATO, senão amort + juros ≠ parcela e a
  // linha de dinheiro deixa de somar.
  it('⛔ pagou MAIS que a previsão: a amortização é a do FATO, não a da agenda', () => {
    const extra = linhaDoCronograma({ ...P3, paidTotal: 5000 })
    expect(extra.juros).toBeCloseTo(1559.72, 2)
    expect(extra.amortizacao).toBeCloseTo(3440.28, 2)   // ⛔ não 2.777,80 da agenda
    expect(round(extra.amortizacao + extra.juros)).toBeCloseTo(5000, 2)
  })

  it('⭐ com a abertura que o vínculo soube separar, e a data do pagamento', () => {
    expect(l.detalhe).toEqual({ juros: 459.71, correcao: 1100.01, mora: 0 })
    expect(l.pagoEm).toEqual(new Date('2026-09-10'))
  })
})

describe('⭐ parcela FUTURA continua prevendo', () => {
  it('a #4 segue com juros 0 — no pós é o estado honesto', () => {
    const l = linhaDoCronograma(P4)
    expect(l.juros).toBe(0)
    expect(l.parcela).toBeCloseTo(2777.77, 2)
    expect(l.realizado).toBe(false)
    expect(l.pagoEm).toBeNull()
  })

  it('⛔ e PAID sem vínculo nenhum NÃO inventa fato — mostra a previsão', () => {
    // ⚠️ o gatilho é o VÍNCULO, nunca o `status`: campo gravado envelhece (foi assim que
    // a CreditCardInvoice.status ficou eternamente OPEN depois de vencer).
    const l = linhaDoCronograma({ ...P4, status: 'PAID' })
    expect(l.realizado).toBe(false)
    expect(l.parcela).toBeCloseTo(2777.77, 2)
  })
})

describe('⚠️ a #1 e a #2 são a PROVA de que a régua é segura', () => {
  it('nelas o real BATE com a agenda — a régua não muda nada', () => {
    // o documento do Sicredi já trazia o efetivo das parcelas pagas
    expect(linhaDoCronograma(P1).juros).toBeCloseTo(P1.interest, 2)
    expect(linhaDoCronograma(P1).parcela).toBeCloseTo(P1.payment, 2)
    expect(linhaDoCronograma(P2).juros).toBeCloseTo(P2.interest + P2.correcao, 2)
    expect(linhaDoCronograma(P2).parcela).toBeCloseTo(P2.payment, 2)
  })
})

describe('⭐⭐ o TOTAL da coluna juros soma só o realizado', () => {
  const todas = [P1, P2, P3, P4, ...Array.from({ length: 32 }, (_, k) => ({ ...P4, number: k + 5 }))]

  it('4.649,06 = 1.518,43 + 1.570,91 + 1.559,72 — e ZERO do futuro', () => {
    expect(jurosRealizados(todas)).toBeCloseTo(4649.06, 2)
  })

  it('⛔ a régua antiga (Σ da agenda) dava 3.089,34 — nem realizado, nem projeção', () => {
    const antiga = round(todas.reduce((s, p) => s + p.interest + (p.correcao ?? 0), 0))
    expect(antiga).toBeCloseTo(3089.34, 2)
    // a diferença é EXATAMENTE a parcela que o dono conciliou
    expect(round(jurosRealizados(todas) - antiga)).toBeCloseTo(1559.72, 2)
  })
})

// ⭐⭐⭐ O CRONOGRAMA E O DRE FALAM O MESMO NÚMERO — provado rodando os DOIS.
//
// **O dono:** *"o total da coluna juros (…) é o número que conversa com a despesa
// financeira do DRE"*. Conversa **por construção**: os dois derivam dos MESMOS campos do
// vínculo (`paidInterest + paidCorrection + paidPenalty`, datados por `paidDate`). Este
// teste é o que impede alguém de, um dia, fazer um dos dois somar outra coisa.
describe('⭐⭐ cronograma × DRE: a mesma parcela, o mesmo número', () => {
  it('a #3 vale 1.559,72 nos dois lados', () => {
    const doCronograma = linhaDoCronograma(P3).juros
    const [doDre] = buildLoanN1InterestTx(
      [{ id: 'i3', paidInterest: P3.paidInterest, paidCorrection: P3.paidCorrection,
        paidPenalty: P3.paidPenalty, paidDate: P3.paidDate, dreHeld: false } as never],
      'cat-juros',
    )
    expect(doDre.amount).toBeCloseTo(doCronograma, 2)
    expect(doDre.amount).toBeCloseTo(1559.72, 2)
    // ⚠️ e a competência é o dia do PAGAMENTO — é o que põe os 1.559,72 em SETEMBRO
    expect(doDre.competenceDate).toEqual(P3.paidDate)
  })

  it('⛔ parcela sem vínculo não entra no DRE — nem com status PAID', () => {
    expect(buildLoanN1InterestTx(
      [{ id: 'i4', paidInterest: null, paidCorrection: null, paidPenalty: null,
        paidDate: null, dreHeld: false } as never], 'cat-juros',
    )).toHaveLength(0)
    expect(linhaDoCronograma({ ...P4, status: 'PAID' }).realizado).toBe(false)
  })
})

function round(n: number) { return Math.round((n + 1e-9) * 100) / 100 }
