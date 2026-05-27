// Sprint 5.0.3.0c — Tests dos schemas Zod do SavedView + inline edit.

import { describe, it, expect } from 'vitest'
import {
  savedViewCreateSchema,
  savedViewUpdateSchema,
  savedViewReorderSchema,
  inlineEditSchema,
  isCreateCategorySentinel,
  extractCategoryName,
} from '@/lib/validations/saved-view'

const CUID = 'cmpvalidcuid000000000abc'

describe('savedViewCreateSchema', () => {
  it('aceita payload mínimo válido', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'Minha view',
        filters: '{"status":"PENDING"}',
      }),
    ).not.toThrow()
  })

  it('default scope=payable, density=normal, pinnedOrder=0', () => {
    const parsed = savedViewCreateSchema.parse({
      name: 'X',
      filters: '{}',
    })
    expect(parsed.scope).toBe('payable')
    expect(parsed.density).toBe('normal')
    expect(parsed.pinnedOrder).toBe(0)
  })

  it('rejeita name vazio', () => {
    expect(() =>
      savedViewCreateSchema.parse({ name: '', filters: '{}' }),
    ).toThrow()
  })

  it('rejeita name > 50 chars', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'a'.repeat(51),
        filters: '{}',
      }),
    ).toThrow()
  })

  it('rejeita filters não-JSON', () => {
    expect(() =>
      savedViewCreateSchema.parse({ name: 'X', filters: 'not-json' }),
    ).toThrow()
  })

  it('aceita filters JSON complexo', () => {
    const filters = JSON.stringify({
      status: 'PENDING',
      dateRange: { from: '2026-01-01', to: '2026-12-31' },
      categoryIds: ['cat1', 'cat2'],
    })
    expect(() =>
      savedViewCreateSchema.parse({ name: 'X', filters }),
    ).not.toThrow()
  })

  it('columnOrder default "[]"', () => {
    const parsed = savedViewCreateSchema.parse({ name: 'X', filters: '{}' })
    expect(parsed.columnOrder).toBe('[]')
    expect(parsed.columnHidden).toBe('[]')
  })

  it('rejeita columnOrder com não-array', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'X',
        filters: '{}',
        columnOrder: '"not-array"',
      }),
    ).toThrow()
  })

  it('rejeita columnOrder com elementos não-string', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'X',
        filters: '{}',
        columnOrder: '[1, 2, 3]',
      }),
    ).toThrow()
  })

  it('aceita icon emoji curto', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'X',
        filters: '{}',
        icon: '🏠',
      }),
    ).not.toThrow()
  })

  it('rejeita scope inválido', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'X',
        filters: '{}',
        scope: 'invalid',
      }),
    ).toThrow()
  })

  it('rejeita density inválida', () => {
    expect(() =>
      savedViewCreateSchema.parse({
        name: 'X',
        filters: '{}',
        density: 'enormous',
      }),
    ).toThrow()
  })
})

describe('savedViewUpdateSchema', () => {
  it('aceita partial body (nada a mudar)', () => {
    expect(() => savedViewUpdateSchema.parse({})).not.toThrow()
  })

  it('aceita só name', () => {
    expect(() =>
      savedViewUpdateSchema.parse({ name: 'Novo nome' }),
    ).not.toThrow()
  })

  it('aceita só icon = null (limpar)', () => {
    expect(() => savedViewUpdateSchema.parse({ icon: null })).not.toThrow()
  })
})

describe('savedViewReorderSchema', () => {
  it('aceita lista de IDs', () => {
    expect(() =>
      savedViewReorderSchema.parse({
        ids: [CUID, 'cmpvalidcuid000000000def'],
      }),
    ).not.toThrow()
  })

  it('default scope=payable', () => {
    const parsed = savedViewReorderSchema.parse({ ids: [CUID] })
    expect(parsed.scope).toBe('payable')
  })

  it('rejeita lista vazia', () => {
    expect(() => savedViewReorderSchema.parse({ ids: [] })).toThrow()
  })

  it('rejeita > 100 IDs', () => {
    const ids = Array.from({ length: 101 }).map(
      (_, i) => `cmpvalidcuid${String(i).padStart(13, '0')}`,
    )
    expect(() => savedViewReorderSchema.parse({ ids })).toThrow()
  })

  it('rejeita ID não-CUID', () => {
    expect(() =>
      savedViewReorderSchema.parse({ ids: ['not-cuid'] }),
    ).toThrow()
  })
})

describe('inlineEditSchema — description', () => {
  it('aceita string não vazia', () => {
    expect(() =>
      inlineEditSchema.parse({ field: 'description', value: 'Aluguel março' }),
    ).not.toThrow()
  })

  it('rejeita vazia', () => {
    expect(() =>
      inlineEditSchema.parse({ field: 'description', value: '' }),
    ).toThrow()
  })

  it('rejeita > 500 chars', () => {
    expect(() =>
      inlineEditSchema.parse({
        field: 'description',
        value: 'a'.repeat(501),
      }),
    ).toThrow()
  })
})

describe('inlineEditSchema — amount', () => {
  it('coerce string → number', () => {
    const parsed = inlineEditSchema.parse({ field: 'amount', value: '99.50' })
    if (parsed.field === 'amount') {
      expect(parsed.value).toBe(99.5)
    }
  })

  it('rejeita zero/negativo', () => {
    expect(() =>
      inlineEditSchema.parse({ field: 'amount', value: 0 }),
    ).toThrow()
    expect(() =>
      inlineEditSchema.parse({ field: 'amount', value: -10 }),
    ).toThrow()
  })
})

describe('inlineEditSchema — dueDate', () => {
  it('coerce string ISO → Date', () => {
    const parsed = inlineEditSchema.parse({
      field: 'dueDate',
      value: '2026-12-31',
    })
    if (parsed.field === 'dueDate') {
      expect(parsed.value).toBeInstanceOf(Date)
    }
  })
})

describe('inlineEditSchema — categoryId', () => {
  it('aceita CUID válido', () => {
    expect(() =>
      inlineEditSchema.parse({ field: 'categoryId', value: CUID }),
    ).not.toThrow()
  })

  it('aceita null (limpa categoria)', () => {
    expect(() =>
      inlineEditSchema.parse({ field: 'categoryId', value: null }),
    ).not.toThrow()
  })

  it('aceita sentinel de criação', () => {
    expect(() =>
      inlineEditSchema.parse({
        field: 'categoryId',
        value: '__create__:Aluguel novo',
      }),
    ).not.toThrow()
  })

  it('rejeita sentinel com nome vazio', () => {
    expect(() =>
      inlineEditSchema.parse({
        field: 'categoryId',
        value: '__create__:',
      }),
    ).toThrow()
  })

  it('rejeita string não-CUID e não-sentinel', () => {
    expect(() =>
      inlineEditSchema.parse({
        field: 'categoryId',
        value: 'random-string',
      }),
    ).toThrow()
  })
})

describe('inlineEditSchema — field inválido', () => {
  it('rejeita field desconhecido', () => {
    expect(() =>
      inlineEditSchema.parse({ field: 'supplierId', value: CUID }),
    ).toThrow()
  })
})

describe('isCreateCategorySentinel', () => {
  it('detecta sentinel "__create__:X"', () => {
    expect(isCreateCategorySentinel('__create__:Aluguel')).toBe(true)
  })

  it('rejeita CUID normal', () => {
    expect(isCreateCategorySentinel(CUID)).toBe(false)
  })

  it('rejeita null', () => {
    expect(isCreateCategorySentinel(null)).toBe(false)
  })
})

describe('extractCategoryName', () => {
  it('extrai nome do sentinel', () => {
    expect(extractCategoryName('__create__:Aluguel novo')).toBe(
      'Aluguel novo',
    )
  })

  it('trim do nome', () => {
    expect(extractCategoryName('__create__:   Nome com espaço   ')).toBe(
      'Nome com espaço',
    )
  })
})
