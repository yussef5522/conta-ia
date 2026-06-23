// Sprint 11 — testes do helper puro applyOptimisticMove.
// Garante que recategorizar move tx no breakdown + txCache mantendo
// invariantes (totalGeral fixo, % redistribuídos, qtdTx coerente).

import { describe, it, expect } from 'vitest'
import { applyOptimisticMove } from '../app/(dashboard)/empresas/[id]/despesas/optimistic-move'
import type {
  ExpenseBreakdownResult,
  ExpenseTransactionItem,
} from '@/lib/dashboard/expenses-breakdown'
import type { CategoriaPickerItem } from '../app/(dashboard)/empresas/[id]/despesas/category-picker'

function mkTx(
  id: string,
  amount: number,
  categoryId: string,
  categoryName: string,
  dreGroup: string,
): ExpenseTransactionItem {
  return {
    id,
    date: '2026-06-15',
    description: `desc ${id}`,
    amount,
    bankAccountName: 'banrisul',
    supplierName: null,
    categoryId,
    categoryName,
    dreGroup,
  }
}

function mkBreakdown(
  categorias: Array<{
    categoryId: string
    name: string
    dreGroup: string
    total: number
    qtdTx: number
  }>,
): ExpenseBreakdownResult {
  const totalGeral = categorias.reduce((s, c) => s + c.total, 0)
  const totalTx = categorias.reduce((s, c) => s + c.qtdTx, 0)
  const items = categorias.map((c, i) => ({
    ...c,
    pctDoTotal: totalGeral > 0 ? (c.total / totalGeral) * 100 : 0,
    isTop: i === 0,
  }))
  // porGrupo
  const grupoMap = new Map<string, { total: number; qtdTx: number }>()
  for (const c of items) {
    const prev = grupoMap.get(c.dreGroup) ?? { total: 0, qtdTx: 0 }
    grupoMap.set(c.dreGroup, { total: prev.total + c.total, qtdTx: prev.qtdTx + c.qtdTx })
  }
  return {
    companyId: 'co_1',
    regime: 'caixa',
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-06-30T23:59:59.999Z',
    totalGeral,
    totalTx,
    totalCategorias: items.length,
    categorias: items,
    porGrupo: Array.from(grupoMap.entries()).map(([dreGroup, v]) => ({ dreGroup, ...v })),
    computedAt: new Date().toISOString(),
  }
}

const CATALOGO: CategoriaPickerItem[] = [
  { id: 'cat_aluguel', name: 'Aluguel', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', color: '#aaa' },
  { id: 'cat_compras', name: 'Compras Mercadoria', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', color: '#bbb' },
  { id: 'cat_salarios', name: 'Salários', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', color: '#ccc' },
  { id: 'cat_nova', name: 'Categoria Nova', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS', color: '#ddd' },
]

describe('applyOptimisticMove — invariantes pós-recategorizar', () => {
  it('move 1 tx de origem para destino existente; totais ajustam, totalGeral inalterado', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
      { categoryId: 'cat_compras', name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 42000, qtdTx: 21 },
    ])
    const tx = mkTx('tx_1', 4000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS')
    const txCache = {
      cat_aluguel: { items: [tx], total: 1, loading: false },
    }
    const txById = new Map([[tx.id, tx]])

    const r = applyOptimisticMove({
      breakdown,
      txCache,
      txById,
      txIds: ['tx_1'],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })

    // totalGeral inalterado
    expect(r.breakdown.totalGeral).toBe(102000)
    // totalTx inalterado
    expect(r.breakdown.totalTx).toBe(51)

    const aluguel = r.breakdown.categorias.find((c) => c.categoryId === 'cat_aluguel')
    const compras = r.breakdown.categorias.find((c) => c.categoryId === 'cat_compras')
    expect(aluguel?.total).toBe(56000) // 60000 - 4000
    expect(aluguel?.qtdTx).toBe(29)
    expect(compras?.total).toBe(46000) // 42000 + 4000
    expect(compras?.qtdTx).toBe(22)

    // Soma % ~ 100
    const somaPct = r.breakdown.categorias.reduce((s, c) => s + c.pctDoTotal, 0)
    expect(somaPct).toBeCloseTo(100, 5)

    // tx removida do bucket origem no txCache
    expect(r.txCache.cat_aluguel?.items.find((t) => t.id === 'tx_1')).toBeUndefined()
  })

  it('move 3 tx em lote do mesmo origem; total e qtd corretos', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
      { categoryId: 'cat_compras', name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 42000, qtdTx: 21 },
    ])
    const txs = [
      mkTx('tx_1', 4000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS'),
      mkTx('tx_2', 2000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS'),
      mkTx('tx_3', 1000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS'),
    ]
    const txCache = { cat_aluguel: { items: txs, total: 3, loading: false } }
    const txById = new Map(txs.map((t) => [t.id, t]))

    const r = applyOptimisticMove({
      breakdown,
      txCache,
      txById,
      txIds: ['tx_1', 'tx_2', 'tx_3'],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })

    const aluguel = r.breakdown.categorias.find((c) => c.categoryId === 'cat_aluguel')
    const compras = r.breakdown.categorias.find((c) => c.categoryId === 'cat_compras')
    expect(aluguel?.total).toBe(53000)
    expect(aluguel?.qtdTx).toBe(27)
    expect(compras?.total).toBe(49000) // 42000 + 7000
    expect(compras?.qtdTx).toBe(24)
    expect(r.breakdown.totalGeral).toBe(102000) // imutável
  })

  it('categoria que zera é removida do breakdown', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_solo', name: 'Solo', dreGroup: 'OUTRAS_DESPESAS', total: 1000, qtdTx: 1 },
      { categoryId: 'cat_compras', name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 5000, qtdTx: 3 },
    ])
    const tx = mkTx('tx_solo', 1000, 'cat_solo', 'Solo', 'OUTRAS_DESPESAS')
    const txCache = { cat_solo: { items: [tx], total: 1, loading: false } }
    const txById = new Map([[tx.id, tx]])

    const r = applyOptimisticMove({
      breakdown,
      txCache,
      txById,
      txIds: ['tx_solo'],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })

    // cat_solo zerou → removida
    expect(r.breakdown.categorias.find((c) => c.categoryId === 'cat_solo')).toBeUndefined()
    expect(r.breakdown.totalCategorias).toBe(1)
  })

  it('cria nova categoria no breakdown quando destino não existia', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
    ])
    const tx = mkTx('tx_1', 5000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS')
    const txCache = { cat_aluguel: { items: [tx], total: 1, loading: false } }
    const txById = new Map([[tx.id, tx]])

    const r = applyOptimisticMove({
      breakdown,
      txCache,
      txById,
      txIds: ['tx_1'],
      novaCategoriaId: 'cat_nova', // não estava no breakdown
      categoriasCatalogo: CATALOGO,
    })

    expect(r.breakdown.totalCategorias).toBe(2)
    const nova = r.breakdown.categorias.find((c) => c.categoryId === 'cat_nova')
    expect(nova?.total).toBe(5000)
    expect(nova?.qtdTx).toBe(1)
    expect(nova?.name).toBe('Categoria Nova')
    expect(nova?.dreGroup).toBe('OUTRAS_DESPESAS')
  })

  it('cache do destino — quando NÃO está carregado, breakdown atualiza mas txCache não força fetch', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
      { categoryId: 'cat_compras', name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 42000, qtdTx: 21 },
    ])
    const tx = mkTx('tx_1', 4000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS')
    const txCache = { cat_aluguel: { items: [tx], total: 1, loading: false } }
    const txById = new Map([[tx.id, tx]])

    const r = applyOptimisticMove({
      breakdown,
      txCache,
      txById,
      txIds: ['tx_1'],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })

    // breakdown atualiza
    const compras = r.breakdown.categorias.find((c) => c.categoryId === 'cat_compras')
    expect(compras?.total).toBe(46000)
    // mas txCache do destino continua undefined (não força carregar)
    expect(r.txCache.cat_compras).toBeUndefined()
  })

  it('cache do destino — quando JÁ está carregado, tx é pré-pendida no items', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
      { categoryId: 'cat_compras', name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 42000, qtdTx: 21 },
    ])
    const txA = mkTx('tx_1', 4000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS')
    const txExistente = mkTx('tx_existente', 5000, 'cat_compras', 'Compras Mercadoria', 'CUSTO_PRODUTO_VENDIDO')
    const txCache = {
      cat_aluguel: { items: [txA], total: 1, loading: false },
      cat_compras: { items: [txExistente], total: 1, loading: false },
    }
    const txById = new Map([
      [txA.id, txA],
      [txExistente.id, txExistente],
    ])

    const r = applyOptimisticMove({
      breakdown,
      txCache,
      txById,
      txIds: ['tx_1'],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })

    expect(r.txCache.cat_compras?.items.length).toBe(2)
    // tx movida vem na frente
    expect(r.txCache.cat_compras?.items[0].id).toBe('tx_1')
    expect(r.txCache.cat_compras?.items[0].categoryId).toBe('cat_compras') // categoryId atualizado
    expect(r.txCache.cat_compras?.items[0].categoryName).toBe('Compras Mercadoria')
  })

  it('txIds vazio → no-op (mesmo breakdown e txCache)', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
    ])
    const r = applyOptimisticMove({
      breakdown,
      txCache: {},
      txById: new Map(),
      txIds: [],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })
    expect(r.breakdown).toBe(breakdown)
    expect(r.txCache).toEqual({})
  })

  it('categoria destino não está no catálogo → no-op preventivo', () => {
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
    ])
    const tx = mkTx('tx_1', 4000, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS')
    const r = applyOptimisticMove({
      breakdown,
      txCache: { cat_aluguel: { items: [tx], total: 1, loading: false } },
      txById: new Map([[tx.id, tx]]),
      txIds: ['tx_1'],
      novaCategoriaId: 'cat_inexistente',
      categoriasCatalogo: CATALOGO,
    })
    // breakdown intacto (helper retorna early)
    expect(r.breakdown.categorias.find((c) => c.categoryId === 'cat_aluguel')?.total).toBe(60000)
  })

  it('isTop sempre fica na primeira categoria após sort', () => {
    // Aluguel tem 100 (2 tx); Compras tem 50 (1 tx).
    // Movemos 1 tx de 90 → Compras vira 140 (top), Aluguel cai pra 10.
    const breakdown = mkBreakdown([
      { categoryId: 'cat_aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 100, qtdTx: 2 },
      { categoryId: 'cat_compras', name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 50, qtdTx: 1 },
    ])
    const tx = mkTx('tx_1', 90, 'cat_aluguel', 'Aluguel', 'DESPESAS_ADMINISTRATIVAS')
    const r = applyOptimisticMove({
      breakdown,
      txCache: { cat_aluguel: { items: [tx], total: 1, loading: false } },
      txById: new Map([[tx.id, tx]]),
      txIds: ['tx_1'],
      novaCategoriaId: 'cat_compras',
      categoriasCatalogo: CATALOGO,
    })
    expect(r.breakdown.categorias[0].categoryId).toBe('cat_compras')
    expect(r.breakdown.categorias[0].isTop).toBe(true)
    expect(r.breakdown.categorias[1].categoryId).toBe('cat_aluguel')
    expect(r.breakdown.categorias[1].isTop).toBe(false)
  })
})
