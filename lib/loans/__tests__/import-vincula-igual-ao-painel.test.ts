// ⛔⛔⛔ O IMPORT MARCAVA "PAGA" SEM SPLIT — R$ 1.559,72 FORA DO DRE (11/09/2026)
//
// **O dono:** *"o ramo do import que grava vínculo de parcela chama o MESMO
// `computeLinkSplit` do painel — marcar PAID sem split deixaria os encargos (1.559,72 no
// caso real) FORA do DRE. Fonte única: vincular pelo import = vincular pelo painel, mesmo
// split, mesmo DRE."*
//
// **O QUE O RAMO FAZIA** (medido no código antes de mexer): `status:'PAID'` +
// `reconciledTransactionId` e **nada mais** — sem `paidTotal`, sem `paidInterest`, sem
// `paidCorrection`. E como `buildLoanN1InterestTx` (a fonte do DRE) lê **exatamente**
// esses campos, a parcela entrava paga com **encargo ZERO**.
//
// ⚠️ ESTE TESTE NÃO TOCA O BANCO: ele prova a CONTA — que o split que o import grava é o
// mesmo do painel, e que o DRE enxerga o mesmo número. A gravação em si é uma função só
// (`vincularPagamentoDeParcela`), e é isso que torna a divergência impossível.

import { describe, it, expect } from 'vitest'
import { computeLinkSplit } from '../link-payment'
import { buildLoanN1InterestTx } from '../dre-interest'
import { linhaDoCronograma } from '../linha-do-cronograma'

/** a #3 do C61021346-2 e o débito real de 10/09 */
const PARCELA = { amortization: 2777.80, openingBalance: 94444.47 }
const TAXA = 0.004867550565343048
const PAGO = 4337.52

describe('⭐⭐ vincular pelo IMPORT == vincular pelo PAINEL', () => {
  // os dois caminhos chamam `vincularPagamentoDeParcela`, que chama `computeLinkSplit`
  const split = computeLinkSplit({ installment: PARCELA, rateMonthly: TAXA, paidTotal: PAGO })

  it('o split é o mesmo número dos dois lados', () => {
    expect(split.amortization).toBeCloseTo(2777.80, 2)
    expect(split.encargos).toBeCloseTo(1559.72, 2)
    expect(split.paidInterest).toBeCloseTo(459.71, 2)
    expect(split.paidCorrection).toBeCloseTo(1100.01, 2)
  })

  it('⛔ e o DRE vê os 1.559,72 — o que o ramo antigo jogava fora', () => {
    const [doDre] = buildLoanN1InterestTx([{
      id: 'i3', paidInterest: split.paidInterest, paidCorrection: split.paidCorrection,
      paidPenalty: split.paidPenalty, paidDate: new Date('2026-09-10'), dreHeld: false,
    } as never], 'cat-juros')
    expect(doDre.amount).toBeCloseTo(1559.72, 2)
  })

  it('⛔⛔ o CONTRAFACTUAL: marcar PAID sem split deixa o DRE em ZERO', () => {
    // era exatamente isto que o import gravava — `status:'PAID'` e mais nada
    const semSplit = buildLoanN1InterestTx([{
      id: 'i3', paidInterest: null, paidCorrection: null, paidPenalty: null,
      paidDate: new Date('2026-09-10'), dreHeld: false,
    } as never], 'cat-juros')
    expect(semSplit).toHaveLength(0)      // ⛔ nenhuma despesa financeira no mês
  })

  it('⭐ e o CRONOGRAMA também relata o fato (não a previsão)', () => {
    const l = linhaDoCronograma({
      number: 3, interest: 0, correcao: 0, amortization: PARCELA.amortization,
      payment: 2777.80, status: 'PAID',
      paidTotal: PAGO, paidInterest: split.paidInterest,
      paidCorrection: split.paidCorrection, paidPenalty: split.paidPenalty,
      paidDate: new Date('2026-09-10'),
    })
    expect(l.juros).toBeCloseTo(1559.72, 2)
    expect(l.parcela).toBeCloseTo(4337.52, 2)
    expect(l.realizado).toBe(true)
  })
})
