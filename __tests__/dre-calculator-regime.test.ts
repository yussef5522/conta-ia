import { describe, it, expect } from 'vitest'
import { calculateDRE } from '../lib/dre/calculator'
import type { CategoryForDRE, TransactionForDRE } from '../lib/dre/types'

const cat = (id: string, dreGroup: string): CategoryForDRE => ({
  id, name: id, code: null, dreGroup, parentId: null, isActive: true, type: 'CREDIT',
})

describe('calculateDRE — regime contábil', () => {
  it('Competência: usa competenceDate', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 1000,
        date: new Date('2026-03-15'),
        competenceDate: new Date('2026-03-15'),  // dentro do período
        paymentDate: new Date('2026-04-20'),     // fora do período
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, {
      period: {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      },
    })

    expect(result.totals.receitaBruta).toBe(1000)
  })

  it('Caixa: usa paymentDate', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 1000,
        date: new Date('2026-03-15'),
        competenceDate: new Date('2026-03-15'),  // dentro do período
        paymentDate: new Date('2026-04-20'),     // fora do período
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, {
      period: {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'cash',
      },
    })

    expect(result.totals.receitaBruta).toBe(0)
  })

  it('Caixa: transação NÃO paga (paymentDate null) é ignorada', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 1000,
        date: new Date('2026-03-15'),
        competenceDate: new Date('2026-03-15'),
        paymentDate: null,
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, {
      period: {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'cash',
      },
    })

    expect(result.totals.receitaBruta).toBe(0)
  })

  it('Competência: fallback pra date se competenceDate null', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 1000,
        date: new Date('2026-03-15'),
        competenceDate: null,
        paymentDate: new Date('2026-03-15'),
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, {
      period: {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      },
    })

    // Fallback usa date como competenceDate
    expect(result.totals.receitaBruta).toBe(1000)
  })

  it('Caixa: pago antes do período fica fora', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 1000,
        date: new Date('2026-03-15'),
        competenceDate: new Date('2026-03-15'),
        paymentDate: new Date('2026-02-20'),
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, {
      period: {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'cash',
      },
    })

    expect(result.totals.receitaBruta).toBe(0)
  })

  it('Mesmo período mas regimes diferentes: resultados divergem', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 1000,
        date: new Date('2026-03-15'),
        competenceDate: new Date('2026-03-15'),  // mar
        paymentDate: new Date('2026-04-20'),     // abr
        categoryId: 'c1',
      },
    ]
    const baseRange = {
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
    }

    const competence = calculateDRE(txs, cats, {
      period: { ...baseRange, regime: 'competence' },
    })
    const cash = calculateDRE(txs, cats, {
      period: { ...baseRange, regime: 'cash' },
    })

    expect(competence.totals.receitaBruta).toBe(1000)
    expect(cash.totals.receitaBruta).toBe(0)
  })

  it('Caixa: paymentDate sem competenceDate funciona', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'CREDIT', amount: 500,
        date: new Date('2026-03-15'),
        competenceDate: null,
        paymentDate: new Date('2026-03-15'),
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, {
      period: {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'cash',
      },
    })

    expect(result.totals.receitaBruta).toBe(500)
  })
})
