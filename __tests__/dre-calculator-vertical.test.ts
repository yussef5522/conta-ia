import { describe, it, expect } from 'vitest'
import { calculateDRE } from '../lib/dre/calculator'
import type { CategoryForDRE, TransactionForDRE } from '../lib/dre/types'

const cat = (id: string, dreGroup: string): CategoryForDRE => ({
  id, name: id, code: null, dreGroup, parentId: null, isActive: true, type: 'CREDIT',
})

const tx = (id: string, amount: number, categoryId: string): TransactionForDRE => ({
  id,
  type: 'CREDIT',
  amount,
  date: new Date('2026-03-15'),
  competenceDate: new Date('2026-03-15'),
  paymentDate: new Date('2026-03-15'),
  categoryId,
})

const period = () => ({
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31'),
  regime: 'competence' as const,
})

describe('calculateDRE — análise vertical', () => {
  it('Receita Bruta = 100% da Receita Líquida (sem deduções)', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 1000, 'c1')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.groups[0].verticalPct).toBe(100)
  })

  it('CUSTO_PRODUTO_VENDIDO percentual sobre Receita Líquida', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA'), cat('c2', 'CUSTO_PRODUTO_VENDIDO')]
    const txs = [tx('t1', 1000, 'c1'), tx('t2', 400, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    const cmv = result.groups.find((g) => g.group === 'CUSTO_PRODUTO_VENDIDO')!
    // CMV / Receita Líquida = 400 / 1000 = 40%
    expect(cmv.verticalPct).toBe(40)
  })

  it('Categoria individual também tem verticalPct', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 1000, 'c1')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.groups[0].categories[0].verticalPct).toBe(100)
  })

  it('Múltiplas categorias mesmo grupo somam pra 100% (sem deduções)', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA'), cat('c2', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 600, 'c1'), tx('t2', 400, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.groups[0].total).toBe(1000)
    expect(result.groups[0].verticalPct).toBe(100)
  })

  it('Sem Receita Líquida (= 0): verticalPct fica null', () => {
    const cats = [cat('c1', 'DESPESAS_ADMINISTRATIVAS')]
    const txs = [tx('t1', 1000, 'c1')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.groups[0].verticalPct).toBe(null)
  })

  it('Receita 100k, Deduções 10k: Deducoes ≈ 11.11% da Receita Líquida', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA'), cat('c2', 'DEDUCOES')]
    const txs = [tx('t1', 100000, 'c1'), tx('t2', 10000, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.totals.receitaLiquida).toBe(90000)
    const deducoes = result.groups.find((g) => g.group === 'DEDUCOES')!
    expect(deducoes.verticalPct).toBeCloseTo(11.11, 2)
  })

  it('Margem Bruta = Lucro Bruto / Receita Líquida', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA'), cat('c2', 'CUSTO_PRODUTO_VENDIDO')]
    const txs = [tx('t1', 1000, 'c1'), tx('t2', 300, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    // Lucro Bruto = 700, Receita Líquida = 1000 → 70%
    expect(result.totals.margemBruta).toBe(70)
  })

  it('Vertical respeita Receita Líquida (não Receita Bruta)', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'DEDUCOES'),
      cat('c3', 'CUSTO_PRODUTO_VENDIDO'),
    ]
    const txs = [
      tx('t1', 100, 'c1'),
      tx('t2', 10, 'c2'),
      tx('t3', 18, 'c3'),
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    // Receita Líquida = 100 - 10 = 90
    // CMV % = 18 / 90 = 20%
    const cmv = result.groups.find((g) => g.group === 'CUSTO_PRODUTO_VENDIDO')!
    expect(cmv.verticalPct).toBe(20)
  })

  it('Receita Bruta vertical com deduções pode > 100% (Bruta > Líquida)', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA'), cat('c2', 'DEDUCOES')]
    const txs = [tx('t1', 110, 'c1'), tx('t2', 10, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    // Receita Líquida = 100. Bruta = 110. 110/100 = 110%.
    const bruta = result.groups.find((g) => g.group === 'RECEITA_BRUTA')!
    expect(bruta.verticalPct).toBeCloseTo(110, 5)
  })
})
