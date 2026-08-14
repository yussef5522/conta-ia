// Sprint Fatura-Estorno — REGRA 3: o estorno de cartão (CREDIT, isCardRefund) REDUZ
// a despesa da categoria, não infla. Sem o flag, um crédito na mesma categoria somaria.

import { describe, it, expect } from 'vitest'
import { calculateDRE } from '../lib/dre/calculator'
import type { TransactionForDRE, CategoryForDRE } from '../lib/dre/types'

const cat: CategoryForDRE = {
  id: 'desp', name: 'Compras', code: null, dreGroup: 'DESPESAS_ADMINISTRATIVAS',
  parentId: null, isActive: true, type: 'DEBIT',
}
const period = { startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31'), regime: 'competence' as const }
const base = (over: Partial<TransactionForDRE>): TransactionForDRE => ({
  id: 'x', type: 'DEBIT', amount: 0, date: new Date('2026-07-10'),
  competenceDate: new Date('2026-07-10'), paymentDate: new Date('2026-07-10'), categoryId: 'desp', ...over,
})

describe('DRE — estorno de cartão reduz a despesa', () => {
  it('compra 100 (DEBIT) + estorno 30 (CREDIT isCardRefund) = despesa 70', () => {
    const txs = [
      base({ id: 'compra', type: 'DEBIT', amount: 100 }),
      base({ id: 'estorno', type: 'CREDIT', amount: 30, isCardRefund: true }),
    ]
    const r = calculateDRE(txs, [cat], { period })
    const grupo = r.groups.find((g) => g.group === 'DESPESAS_ADMINISTRATIVAS')
    expect(grupo?.total).toBe(70) // 100 − 30, NÃO 130
  })

  it('sem o flag isCardRefund um crédito somaria (prova que o flag é o que resolve)', () => {
    const txs = [
      base({ id: 'compra', type: 'DEBIT', amount: 100 }),
      base({ id: 'credito', type: 'CREDIT', amount: 30 }), // sem isCardRefund
    ]
    const r = calculateDRE(txs, [cat], { period })
    const grupo = r.groups.find((g) => g.group === 'DESPESAS_ADMINISTRATIVAS')
    expect(grupo?.total).toBe(130) // soma (o comportamento do modelo por dreGroup)
  })
})
