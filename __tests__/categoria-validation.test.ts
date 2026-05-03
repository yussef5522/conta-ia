import { describe, it, expect } from 'vitest'
import {
  categoriaCreateSchema,
  categoriaUpdateSchema,
  DRE_GROUPS,
  CATEGORY_TYPES,
} from '../lib/validations/categoria'

const CUID_VALIDO_1 = 'cl1234567890abcdefghijklm'
const CUID_VALIDO_2 = 'cl0987654321zyxwvutsrqpon'

describe('categoriaCreateSchema (Zod)', () => {
  it('aceita payload mínimo (só name + type)', () => {
    const r = categoriaCreateSchema.safeParse({ name: 'Aluguel', type: 'EXPENSE' })
    expect(r.success).toBe(true)
  })

  it('aceita payload completo', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'Mensalidades',
      type: 'INCOME',
      dreGroup: 'RECEITA_BRUTA',
      parentId: CUID_VALIDO_1,
      code: '1.1.01',
      description: 'Cobrança recorrente do plano do aluno',
      color: '#10b981',
      icon: 'repeat',
      order: 100,
      visibleInRegimes: ['LUCRO_PRESUMIDO', 'LUCRO_REAL'],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita name vazio', () => {
    const r = categoriaCreateSchema.safeParse({ name: '', type: 'EXPENSE' })
    expect(r.success).toBe(false)
  })

  it('rejeita name com mais de 80 caracteres', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'a'.repeat(81),
      type: 'EXPENSE',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita type fora do enum', () => {
    const r = categoriaCreateSchema.safeParse({ name: 'X', type: 'OUTRO' })
    expect(r.success).toBe(false)
  })

  it('rejeita dreGroup fora do enum oficial', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      dreGroup: 'GRUPO_INVENTADO',
    })
    expect(r.success).toBe(false)
  })

  it('aceita todos os 14 dreGroups oficiais', () => {
    for (const g of DRE_GROUPS) {
      const r = categoriaCreateSchema.safeParse({
        name: 'X',
        type: 'EXPENSE',
        dreGroup: g,
      })
      expect(r.success).toBe(true)
    }
  })

  it('aceita os 3 tipos: INCOME, EXPENSE, TRANSFER', () => {
    for (const t of CATEGORY_TYPES) {
      const r = categoriaCreateSchema.safeParse({ name: 'X', type: t })
      expect(r.success).toBe(true)
    }
  })

  it('rejeita parentId não-cuid', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      parentId: 'nao-eh-cuid',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita color hex inválido', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      color: 'azul',
    })
    expect(r.success).toBe(false)
  })

  it('aceita color hex 3 e 6 chars (com ou sem #)', () => {
    expect(categoriaCreateSchema.safeParse({ name: 'X', type: 'EXPENSE', color: '#10b981' }).success).toBe(true)
    expect(categoriaCreateSchema.safeParse({ name: 'X', type: 'EXPENSE', color: '#fff' }).success).toBe(true)
    expect(categoriaCreateSchema.safeParse({ name: 'X', type: 'EXPENSE', color: '10b981' }).success).toBe(true)
  })

  it('rejeita description com mais de 200 caracteres', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      description: 'a'.repeat(201),
    })
    expect(r.success).toBe(false)
  })

  it('rejeita code com mais de 20 caracteres', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      code: '1'.repeat(21),
    })
    expect(r.success).toBe(false)
  })

  it('rejeita visibleInRegimes com regime inventado', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      visibleInRegimes: ['REGIME_FAKE'],
    })
    expect(r.success).toBe(false)
  })

  it('aceita visibleInRegimes null', () => {
    const r = categoriaCreateSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      visibleInRegimes: null,
    })
    expect(r.success).toBe(true)
  })

  it('faz trim no name', () => {
    const r = categoriaCreateSchema.safeParse({ name: '  Aluguel  ', type: 'EXPENSE' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe('Aluguel')
  })
})

describe('categoriaUpdateSchema (todos campos opcionais + isActive)', () => {
  it('aceita payload vazio (no-op update)', () => {
    const r = categoriaUpdateSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('aceita só isActive (toggle ativa/inativa)', () => {
    const r = categoriaUpdateSchema.safeParse({ isActive: false })
    expect(r.success).toBe(true)
  })

  it('aceita apenas name (rename)', () => {
    const r = categoriaUpdateSchema.safeParse({ name: 'Novo Nome' })
    expect(r.success).toBe(true)
  })

  it('aceita parentId null (mover pra raiz)', () => {
    const r = categoriaUpdateSchema.safeParse({ parentId: null })
    expect(r.success).toBe(true)
  })

  it('aceita parentId apontando pra outra categoria (cuid válido)', () => {
    const r = categoriaUpdateSchema.safeParse({ parentId: CUID_VALIDO_2 })
    expect(r.success).toBe(true)
  })

  it('rejeita name vazio mesmo sendo opcional', () => {
    const r = categoriaUpdateSchema.safeParse({ name: '' })
    expect(r.success).toBe(false)
  })
})

describe('DRE_GROUPS — sanity check do enum', () => {
  it('contém os 14 grupos esperados', () => {
    expect(DRE_GROUPS).toHaveLength(14)
    expect(DRE_GROUPS).toContain('RECEITA_BRUTA')
    expect(DRE_GROUPS).toContain('DEDUCOES')
    expect(DRE_GROUPS).toContain('CUSTO_PRODUTO_VENDIDO')
    expect(DRE_GROUPS).toContain('DESPESAS_PESSOAL')
    expect(DRE_GROUPS).toContain('IMPOSTOS_SOBRE_LUCRO')
    expect(DRE_GROUPS).toContain('DISTRIBUICAO_LUCROS')
    expect(DRE_GROUPS).toContain('TRANSFERENCIA')
  })
})
