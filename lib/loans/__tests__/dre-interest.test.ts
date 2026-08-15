import { describe, it, expect } from 'vitest'
import {
  buildLoan1to1InterestTx,
  buildLoanN1InterestTx,
  type Loan1to1Row,
  type LoanN1Row,
} from '../dre-interest'

const CAT = 'cat-juros'
const D = (s: string) => new Date(s + 'T00:00:00.000Z')

// ── Caminho 1:1 ──────────────────────────────────────────────────────────
function row1to1(over: Partial<Loan1to1Row['loanInstallmentPaid']> & { id?: string } = {}): Loan1to1Row {
  return {
    id: over.id ?? 'tx1',
    type: 'DEBIT',
    amount: 4348.64,
    date: D('2026-07-10'),
    competenceDate: null,
    paymentDate: null,
    isCardPayment: false,
    pendingTransfer: false,
    loanInstallmentPaid: {
      interest: over.interest ?? 473.23,
      correcao: over.correcao ?? 1097.68,
      dreHeld: over.dreHeld ?? false,
    },
  }
}

// ── Caminho N:1 ──────────────────────────────────────────────────────────
function rowN1(over: Partial<LoanN1Row> = {}): LoanN1Row {
  return {
    id: over.id ?? 'inst1',
    paidDate: over.paidDate ?? D('2026-07-15'),
    paidInterest: over.paidInterest ?? 1000,
    paidCorrection: over.paidCorrection ?? 500,
    paidPenalty: over.paidPenalty ?? 0,
    dreHeld: over.dreHeld ?? false,
  }
}

describe('DRE juros de empréstimo — represar via dreHeld (os 2 caminhos)', () => {
  describe('caminho 1:1 (reconciledTransactionId)', () => {
    it('parcela dreHeld=false: juros ENTRA no DRE', () => {
      const out = buildLoan1to1InterestTx([row1to1({ dreHeld: false })], CAT)
      expect(out).toHaveLength(1)
      expect(out[0].loanInterestSplit).toBeCloseTo(1570.91, 2)
    })

    it('parcela dreHeld=true: juros REPRESADO, NÃO entra no DRE', () => {
      const out = buildLoan1to1InterestTx([row1to1({ dreHeld: true })], CAT)
      expect(out).toHaveLength(0)
    })

    it('mistura: só a não-represada entra', () => {
      const out = buildLoan1to1InterestTx(
        [row1to1({ id: 'aberta', dreHeld: false }), row1to1({ id: 'fechada', dreHeld: true })],
        CAT,
      )
      expect(out.map((t) => t.id)).toEqual(['aberta'])
    })
  })

  describe('caminho N:1 (LoanInstallmentPayment)', () => {
    it('parcela dreHeld=false: encargos ENTRAM no DRE', () => {
      const out = buildLoanN1InterestTx([rowN1({ dreHeld: false })], CAT)
      expect(out).toHaveLength(1)
      expect(out[0].loanInterestSplit).toBeCloseTo(1500, 2)
    })

    it('parcela dreHeld=true: encargos REPRESADOS, NÃO entram no DRE', () => {
      const out = buildLoanN1InterestTx([rowN1({ dreHeld: true })], CAT)
      expect(out).toHaveLength(0)
    })

    it('mistura: só a não-represada entra', () => {
      const out = buildLoanN1InterestTx(
        [rowN1({ id: 'aberta', dreHeld: false }), rowN1({ id: 'fechada', dreHeld: true })],
        CAT,
      )
      expect(out.map((t) => t.id)).toEqual(['loan-n1-aberta'])
    })
  })

  it('competência é a data da tx/paidDate, NÃO muda com o flag (soltar = competência original)', () => {
    // O flag só liga/desliga; quando entra, a data é a original.
    const t1 = buildLoan1to1InterestTx([row1to1({ dreHeld: false })], CAT)[0]
    expect(t1.date).toEqual(D('2026-07-10'))
    const n1 = buildLoanN1InterestTx([rowN1({ dreHeld: false })], CAT)[0]
    expect(n1.date).toEqual(D('2026-07-15'))
  })
})
