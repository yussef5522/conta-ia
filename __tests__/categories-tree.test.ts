import { describe, it, expect } from 'vitest'
import { buildTree, flattenTree, type CategoryFlat } from '../lib/categories/buildTree'
import {
  filterTree,
  DEFAULT_FILTERS,
  type CategoryFilters,
} from '../lib/categories/filterTree'

// Factory pra montar CategoryFlat com defaults
function cat(over: Partial<CategoryFlat> & { id: string; name: string }): CategoryFlat {
  return {
    id: over.id,
    name: over.name,
    type: over.type ?? 'EXPENSE',
    parentId: over.parentId ?? null,
    dreGroup: over.dreGroup ?? null,
    code: over.code ?? null,
    description: over.description ?? null,
    color: over.color ?? '#10b981',
    icon: over.icon ?? null,
    order: over.order ?? 0,
    visibleInRegimes: over.visibleInRegimes ?? null,
    isActive: over.isActive ?? true,
    isSystemDefault: over.isSystemDefault ?? false,
    _count: over._count,
  }
}

describe('buildTree', () => {
  it('lista vazia retorna array vazio', () => {
    expect(buildTree([])).toEqual([])
  })

  it('categorias sem parentId viram raízes', () => {
    const flat = [cat({ id: 'a', name: 'A' }), cat({ id: 'b', name: 'B' })]
    const tree = buildTree(flat)
    expect(tree).toHaveLength(2)
    expect(tree.every((n) => n.parentId === null)).toBe(true)
    expect(tree.every((n) => n.depth === 0)).toBe(true)
  })

  it('categorias com parentId viram filhos do parent', () => {
    const flat = [
      cat({ id: 'p', name: 'Pai' }),
      cat({ id: 'f1', name: 'Filho 1', parentId: 'p' }),
      cat({ id: 'f2', name: 'Filho 2', parentId: 'p' }),
    ]
    const tree = buildTree(flat)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('p')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('hierarquia de 3 níveis', () => {
    const flat = [
      cat({ id: 'a', name: 'Raiz' }),
      cat({ id: 'b', name: 'Nivel 2', parentId: 'a' }),
      cat({ id: 'c', name: 'Nivel 3', parentId: 'b' }),
    ]
    const tree = buildTree(flat)
    expect(tree[0].children[0].children[0].depth).toBe(2)
    expect(tree[0].children[0].children[0].name).toBe('Nivel 3')
  })

  it('parentId quebrado (não existe na lista) — vira raiz', () => {
    const flat = [
      cat({ id: 'a', name: 'A', parentId: 'inexistente' }),
      cat({ id: 'b', name: 'B' }),
    ]
    const tree = buildTree(flat)
    expect(tree).toHaveLength(2)
    expect(tree.find((n) => n.id === 'a')).toBeDefined()
  })

  it('detecta ciclo e quebra (vira raiz, não loop infinito)', () => {
    // a -> b -> a (ciclo)
    const flat = [
      cat({ id: 'a', name: 'A', parentId: 'b' }),
      cat({ id: 'b', name: 'B', parentId: 'a' }),
    ]
    const tree = buildTree(flat)
    // Os dois viram raízes (resiliência)
    expect(tree.length).toBeGreaterThan(0)
  })

  it('ordena por order asc, depois name asc', () => {
    const flat = [
      cat({ id: 'a', name: 'Banana', order: 2 }),
      cat({ id: 'b', name: 'Abacate', order: 1 }),
      cat({ id: 'c', name: 'Cereja', order: 1 }),
    ]
    const tree = buildTree(flat)
    expect(tree.map((n) => n.id)).toEqual(['b', 'c', 'a'])
  })

  it('preserva transactionCount via _count', () => {
    const flat = [cat({ id: 'a', name: 'A', _count: { transactions: 42 } })]
    const tree = buildTree(flat)
    expect(tree[0].transactionCount).toBe(42)
  })

  it('default transactionCount = 0 quando _count ausente', () => {
    const flat = [cat({ id: 'a', name: 'A' })]
    const tree = buildTree(flat)
    expect(tree[0].transactionCount).toBe(0)
  })
})

describe('flattenTree', () => {
  it('depth-first traversal', () => {
    const flat = [
      cat({ id: 'a', name: 'A' }),
      cat({ id: 'a1', name: 'A1', parentId: 'a' }),
      cat({ id: 'a2', name: 'A2', parentId: 'a' }),
      cat({ id: 'b', name: 'B' }),
    ]
    const tree = buildTree(flat)
    const flatBack = flattenTree(tree)
    expect(flatBack.map((n) => n.id)).toEqual(['a', 'a1', 'a2', 'b'])
  })
})

describe('filterTree', () => {
  // Árvore base de teste
  const baseFlat = [
    cat({ id: 'r', name: 'Receitas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' }),
    cat({ id: 'r1', name: 'Mensalidades', parentId: 'r', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' }),
    cat({ id: 'r2', name: 'Vendas', parentId: 'r', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' }),
    cat({ id: 'd', name: 'Despesas', type: 'EXPENSE', dreGroup: 'DESPESAS_OPERACIONAIS' }),
    cat({ id: 'd1', name: 'Aluguel', parentId: 'd', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' }),
    cat({ id: 'd2', name: 'Manutenção', parentId: 'd', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isActive: false }),
  ]
  const baseTree = buildTree(baseFlat)

  it('busca pelo nome (case-insensitive + sem acento)', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, search: 'manutencao' })
    // Manutenção é inativa e default status=ACTIVE → não bate. Vamos buscar Aluguel.
    const r2 = filterTree(baseTree, { ...DEFAULT_FILTERS, search: 'aluguel' })
    expect(r2).toHaveLength(1) // Despesas (pai mantido)
    expect(r2[0].children).toHaveLength(1)
    expect(r2[0].children[0].name).toBe('Aluguel')
  })

  it('busca preserva pai mesmo se pai não bate', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, search: 'mensalidades' })
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Receitas')
    expect(r[0].children).toHaveLength(1)
    expect(r[0].children[0].name).toBe('Mensalidades')
  })

  it('filtro por type', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, type: 'INCOME' })
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Receitas')
    expect(r[0].children).toHaveLength(2)
  })

  it('filtro por dreGroup', () => {
    const r = filterTree(baseTree, {
      ...DEFAULT_FILTERS,
      dreGroup: 'DESPESAS_ADMINISTRATIVAS',
    })
    // Apenas Aluguel bate (Manutenção é inativa). Despesas (pai) é mantido pq filho bate.
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Despesas')
    expect(r[0].children).toHaveLength(1)
    expect(r[0].children[0].name).toBe('Aluguel')
  })

  it('filtro status=ACTIVE remove inativas', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, status: 'ACTIVE' })
    const aluguelManutencao = r.find((n) => n.id === 'd')?.children ?? []
    expect(aluguelManutencao.find((n) => n.name === 'Manutenção')).toBeUndefined()
  })

  it('filtro status=INACTIVE mostra só inativas', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, status: 'INACTIVE' })
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Despesas')
    expect(r[0].children[0].name).toBe('Manutenção')
  })

  it('filtro status=ALL mostra ativas e inativas', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, status: 'ALL' })
    const despesas = r.find((n) => n.id === 'd')
    expect(despesas?.children).toHaveLength(2)
  })

  it('filtros combinados (AND lógico)', () => {
    const r = filterTree(baseTree, {
      ...DEFAULT_FILTERS,
      type: 'EXPENSE',
      search: 'aluguel',
    })
    expect(r).toHaveLength(1)
    expect(r[0].children[0].name).toBe('Aluguel')
  })

  it('busca normaliza acentos (Á → a)', () => {
    const r = filterTree(baseTree, {
      ...DEFAULT_FILTERS,
      status: 'ALL', // pra incluir Manutenção (inativa)
      search: 'manutencao', // sem acento
    })
    const subs = r[0].children
    expect(subs.some((n) => n.name === 'Manutenção')).toBe(true)
  })

  it('nada bate → retorna array vazio', () => {
    const r = filterTree(baseTree, { ...DEFAULT_FILTERS, search: 'xyz_nao_existe' })
    expect(r).toEqual([])
  })

  it('filtros default (ACTIVE) excluem categorias inativas', () => {
    const r = filterTree(baseTree, DEFAULT_FILTERS)
    const despesas = r.find((n) => n.id === 'd')
    // Manutenção é inativa, então não aparece
    expect(despesas?.children.find((n) => n.name === 'Manutenção')).toBeUndefined()
    // Aluguel é ativa
    expect(despesas?.children.find((n) => n.name === 'Aluguel')).toBeDefined()
  })

  it('busca vazia + filtros ALL → retorna árvore inteira (sem filter de status)', () => {
    const todas: CategoryFilters = {
      search: '',
      type: 'ALL',
      dreGroup: 'ALL',
      status: 'ALL',
    }
    const r = filterTree(baseTree, todas)
    // Mesma estrutura que baseTree
    expect(r).toHaveLength(2)
    expect(r[0].children).toHaveLength(2)
    expect(r[1].children).toHaveLength(2)
  })
})
