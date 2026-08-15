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

describe('DRE — compra pessoal do cartão (Retirada/DISTRIBUICAO) NÃO entra no DRE', () => {
  const retCat: CategoryForDRE = {
    id: 'ret', name: 'Retirada via cartão', code: null, dreGroup: 'DISTRIBUICAO_LUCROS',
    parentId: null, isActive: true, type: 'EXPENSE',
  }
  it('R$ 100 de retirada → receita 0, despesa 0, lucro 0 (fora do P&L)', () => {
    const txs = [base({ id: 'compra-pessoal', type: 'DEBIT', amount: 100, categoryId: 'ret' })]
    const r = calculateDRE(txs, [retCat], { period })
    expect(r.groups.find((g) => g.group === 'DESPESAS_ADMINISTRATIVAS')).toBeUndefined()
    expect(r.totals.receitaBruta).toBe(0)
    expect(r.totals.lucroLiquido).toBe(0) // a retirada não é despesa nem receita
  })
})

describe('DRE — fila "A CLASSIFICAR" (A_CLASSIFICAR) NÃO entra no P&L', () => {
  const filaCat: CategoryForDRE = {
    id: 'fila', name: 'A CLASSIFICAR — cartão', code: null, dreGroup: 'A_CLASSIFICAR',
    parentId: null, isActive: true, type: 'EXPENSE',
  }
  it('compra parqueada → receita 0, despesa 0, lucro 0 (fora do resultado até classificar)', () => {
    const txs = [base({ id: 'parqueada', type: 'DEBIT', amount: 500, categoryId: 'fila' })]
    const r = calculateDRE(txs, [filaCat], { period })
    expect(r.groups.find((g) => g.group === 'DESPESAS_ADMINISTRATIVAS')).toBeUndefined()
    expect(r.totals.lucroLiquido).toBe(0)
  })
})
