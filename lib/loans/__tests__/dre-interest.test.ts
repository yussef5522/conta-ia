import { describe, it, expect } from 'vitest'
import {
  buildLoanN1InterestTx,
  type LoanN1Row,
} from '../dre-interest'

const CAT = 'cat-juros'
const D = (s: string) => new Date(s + 'T00:00:00.000Z')

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

describe('DRE juros de empréstimo — represar via dreHeld (uma fonte só: paid*, R54)', () => {
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
    const n1 = buildLoanN1InterestTx([rowN1({ dreHeld: false })], CAT)[0]
    expect(n1.date).toEqual(D('2026-07-15'))
  })
})
