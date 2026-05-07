import { describe, it, expect } from 'vitest'
import { calculateDRE } from '../lib/dre/calculator'
import type { TransactionForDRE, CategoryForDRE } from '../lib/dre/types'

const cat = (id: string, dreGroup: string, name = id): CategoryForDRE => ({
  id,
  name,
  code: null,
  dreGroup,
  parentId: null,
  isActive: true,
  type: 'CREDIT',
})

const tx = (
  id: string,
  amount: number,
  categoryId: string | null,
  date = new Date('2026-03-15'),
): TransactionForDRE => ({
  id,
  type: 'CREDIT',
  amount,
  date,
  competenceDate: date,
  paymentDate: date,
  categoryId,
})

const period = (start = '2026-03-01', end = '2026-03-31') => ({
  startDate: new Date(start),
  endDate: new Date(end),
  regime: 'competence' as const,
})

describe('calculateDRE — básico', () => {
  it('DRE vazio (sem transações)', () => {
    const result = calculateDRE([], [], { period: period() })
    expect(result.groups.length).toBe(0)
    expect(result.totals.receitaBruta).toBe(0)
    expect(result.totals.lucroLiquido).toBe(0)
  })

  it('Receita simples', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA', 'Vendas')]
    const txs = [tx('t1', 1000, 'c1')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.groups.length).toBe(1)
    expect(result.groups[0].group).toBe('RECEITA_BRUTA')
    expect(result.groups[0].total).toBe(1000)
    expect(result.totals.receitaBruta).toBe(1000)
    expect(result.totals.receitaLiquida).toBe(1000)
  })

  it('Receita - Deduções = Receita Líquida', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'DEDUCOES'),
    ]
    const txs = [tx('t1', 10000, 'c1'), tx('t2', 1000, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.totals.receitaBruta).toBe(10000)
    expect(result.totals.totalDeducoes).toBe(1000)
    expect(result.totals.receitaLiquida).toBe(9000)
  })

  it('Lucro Bruto = Receita Líquida - CUSTO_PRODUTO_VENDIDO', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'CUSTO_PRODUTO_VENDIDO'),
    ]
    const txs = [tx('t1', 10000, 'c1'), tx('t2', 4000, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.totals.lucroBruto).toBe(6000)
  })

  it('Lucro Líquido completo (estrutura BR)', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'DEDUCOES'),
      cat('c3', 'CUSTO_PRODUTO_VENDIDO'),
      cat('c4', 'DESPESAS_COMERCIAIS'),
      cat('c5', 'DESPESAS_ADMINISTRATIVAS'),
      cat('c6', 'IMPOSTOS_SOBRE_LUCRO'),
    ]
    const txs = [
      tx('t1', 100000, 'c1'),  // Receita Bruta
      tx('t2', 10000, 'c2'),   // Deduções
      tx('t3', 30000, 'c3'),   // CMV/CSP
      tx('t4', 8000, 'c4'),    // Despesas Comerciais
      tx('t5', 12000, 'c5'),   // Despesas Admin
      tx('t6', 5000, 'c6'),    // IRPJ + CSLL
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.totals.receitaBruta).toBe(100000)
    expect(result.totals.receitaLiquida).toBe(90000)
    expect(result.totals.lucroBruto).toBe(60000)
    expect(result.totals.totalDespesasOperacionais).toBe(20000)
    expect(result.totals.resultadoOperacional).toBe(40000)
    expect(result.totals.lair).toBe(40000)
    expect(result.totals.lucroLiquido).toBe(35000)
  })

  it('Resultado Financeiro = Receitas - Despesas Financeiras', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'RECEITAS_FINANCEIRAS'),
      cat('c3', 'DESPESAS_FINANCEIRAS'),
    ]
    const txs = [
      tx('t1', 10000, 'c1'),
      tx('t2', 500, 'c2'),
      tx('t3', 200, 'c3'),
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.totals.receitasFinanceiras).toBe(500)
    expect(result.totals.despesasFinanceiras).toBe(200)
    expect(result.totals.resultadoFinanceiro).toBe(300)
  })

  it('Margens calculadas corretamente', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'CUSTO_PRODUTO_VENDIDO'),
    ]
    const txs = [tx('t1', 1000, 'c1'), tx('t2', 400, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    // Margem Bruta = (1000 - 400) / 1000 = 60%
    expect(result.totals.margemBruta).toBe(60)
  })

  it('Transação fora do período é ignorada', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 1000, 'c1', new Date('2026-02-15')),  // FEV (fora)
      tx('t2', 500, 'c1', new Date('2026-03-15')),   // MAR (dentro)
    ]
    const result = calculateDRE(txs, cats, {
      period: period('2026-03-01', '2026-03-31'),
    })

    expect(result.totals.receitaBruta).toBe(500)
  })

  it('Transação sem categoria vai pra uncategorized', () => {
    const txs = [tx('t1', 1000, null)]
    const result = calculateDRE(txs, [], { period: period() })

    expect(result.uncategorized.total).toBe(1000)
    expect(result.uncategorized.transactionCount).toBe(1)
    expect(result.totals.receitaBruta).toBe(0)
  })

  it('Período inválido (start > end) throws', () => {
    expect(() =>
      calculateDRE([], [], {
        period: {
          startDate: new Date('2026-03-31'),
          endDate: new Date('2026-03-01'),
          regime: 'competence',
        },
      }),
    ).toThrow()
  })

  it('Categoria com dreGroup desconhecido vai pra uncategorized', () => {
    const cats = [cat('c1', 'GRUPO_INEXISTENTE')]
    const txs = [tx('t1', 1000, 'c1')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.uncategorized.total).toBe(1000)
    expect(result.uncategorized.transactionCount).toBe(1)
    expect(result.groups.length).toBe(0)
  })

  it('Categoria com dreGroup vazio vai pra uncategorized', () => {
    const cats = [cat('c1', '')]
    const txs = [tx('t1', 500, 'c1')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.uncategorized.total).toBe(500)
  })

  it('Transação com categoryId que não existe no map vai pra uncategorized', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 700, 'c-deletada')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.uncategorized.total).toBe(700)
  })

  it('Múltiplos grupos coexistem na ordem oficial', () => {
    const cats = [
      cat('c1', 'IMPOSTOS_SOBRE_LUCRO'),
      cat('c2', 'RECEITA_BRUTA'),
      cat('c3', 'DESPESAS_PESSOAL'),
    ]
    const txs = [
      tx('t1', 1000, 'c1'),
      tx('t2', 5000, 'c2'),
      tx('t3', 1500, 'c3'),
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    // Ordem oficial: RECEITA_BRUTA antes de DESPESAS_PESSOAL antes de IMPOSTOS_SOBRE_LUCRO
    expect(result.groups[0].group).toBe('RECEITA_BRUTA')
    expect(result.groups[1].group).toBe('DESPESAS_PESSOAL')
    expect(result.groups[2].group).toBe('IMPOSTOS_SOBRE_LUCRO')
  })

  it('DESPESAS_PESSOAL é linha separada com totalDespesasPessoal', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'DESPESAS_PESSOAL'),
      cat('c3', 'DESPESAS_ADMINISTRATIVAS'),
    ]
    const txs = [
      tx('t1', 10000, 'c1'),
      tx('t2', 4000, 'c2'),
      tx('t3', 1000, 'c3'),
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.totals.totalDespesasPessoal).toBe(4000)
    expect(result.totals.totalDespesasAdministrativas).toBe(1000)
    expect(result.totals.totalDespesasOperacionais).toBe(5000)  // 4000 + 1000
  })

  it('NonDREGroup (DISTRIBUICAO_LUCROS) não entra no DRE mas é reportado', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'DISTRIBUICAO_LUCROS'),
    ]
    const txs = [tx('t1', 10000, 'c1'), tx('t2', 3000, 'c2')]
    const result = calculateDRE(txs, cats, { period: period() })

    // Não afeta resultado
    expect(result.totals.lucroLiquido).toBe(10000)
    // Mas é reportado em nonDreGroups
    expect(result.nonDreGroups.length).toBe(1)
    expect(result.nonDreGroups[0].group).toBe('DISTRIBUICAO_LUCROS')
    expect(result.nonDreGroups[0].total).toBe(3000)
    expect(result.nonDreGroups[0].transactionCount).toBe(1)
  })

  it('Os 3 grupos não-DRE são reportados separadamente', () => {
    const cats = [
      cat('c1', 'DISTRIBUICAO_LUCROS'),
      cat('c2', 'INVESTIMENTOS'),
      cat('c3', 'TRANSFERENCIA'),
    ]
    const txs = [tx('t1', 100, 'c1'), tx('t2', 200, 'c2'), tx('t3', 300, 'c3')]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.nonDreGroups.length).toBe(3)
    expect(result.nonDreGroups.map((g) => g.group)).toEqual([
      'DISTRIBUICAO_LUCROS',
      'INVESTIMENTOS',
      'TRANSFERENCIA',
    ])
    expect(result.uncategorized.total).toBe(0)
    expect(result.totals.lucroLiquido).toBe(0)
  })

  it('Metadata reporta transactionsProcessed e categoriesUsed', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA'),
      cat('c2', 'DESPESAS_ADMINISTRATIVAS'),
    ]
    const txs = [
      tx('t1', 1000, 'c1'),
      tx('t2', 500, 'c1'),
      tx('t3', 200, 'c2'),
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.metadata.transactionsProcessed).toBe(3)
    expect(result.metadata.categoriesUsed).toBe(2)
    expect(result.metadata.calculatedAt).toBeInstanceOf(Date)
  })

  it('Múltiplas categorias mesmo grupo agrupam corretamente', () => {
    const cats = [
      cat('c1', 'RECEITA_BRUTA', 'Mensalidades'),
      cat('c2', 'RECEITA_BRUTA', 'Personal Training'),
    ]
    const txs = [
      tx('t1', 5000, 'c1'),
      tx('t2', 2000, 'c2'),
    ]
    const result = calculateDRE(txs, cats, { period: period() })

    expect(result.groups[0].total).toBe(7000)
    expect(result.groups[0].categories.length).toBe(2)
    // Ordenação por nome PT-BR: Mensalidades < Personal Training
    expect(result.groups[0].categories[0].category.name).toBe('Mensalidades')
    expect(result.groups[0].categories[1].category.name).toBe('Personal Training')
  })
})
