import { describe, it, expect } from 'vitest'
import {
  roleCreateSchema,
  findInvalidPermissionKeys,
} from '../lib/roles/validation'

describe('roleCreateSchema', () => {
  it('valida role completa', () => {
    const result = roleCreateSchema.safeParse({
      name: 'Vendedor',
      description: 'Acesso a vendas',
      permissionKeys: ['category.view', 'transaction.view'],
    })
    expect(result.success).toBe(true)
  })

  it('rejeita nome muito curto', () => {
    const result = roleCreateSchema.safeParse({
      name: 'A',
      permissionKeys: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita nome muito longo (> 50 chars)', () => {
    const result = roleCreateSchema.safeParse({
      name: 'A'.repeat(51),
      permissionKeys: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita nome com caracteres inválidos', () => {
    const result = roleCreateSchema.safeParse({
      name: 'Role<script>',
      permissionKeys: [],
    })
    expect(result.success).toBe(false)
  })

  it('aceita nome com acentos', () => {
    const result = roleCreateSchema.safeParse({
      name: 'Vendedor Sênior',
      permissionKeys: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejeita permission key inválida', () => {
    const result = roleCreateSchema.safeParse({
      name: 'Test',
      permissionKeys: ['invalid.permission'],
    })
    expect(result.success).toBe(false)
  })

  it('aceita lista vazia de permissions', () => {
    const result = roleCreateSchema.safeParse({
      name: 'Empty Role',
      permissionKeys: [],
    })
    expect(result.success).toBe(true)
  })

  it('description é opcional', () => {
    const result = roleCreateSchema.safeParse({
      name: 'Sem descricao',
      permissionKeys: ['category.view'],
    })
    expect(result.success).toBe(true)
  })
})

describe('findInvalidPermissionKeys', () => {
  it('retorna apenas keys inválidas', () => {
    const result = findInvalidPermissionKeys([
      'category.view',
      'invalid.x',
      'transaction.create',
      'fake.action',
    ])
    expect(result).toEqual(['invalid.x', 'fake.action'])
  })

  it('lista vazia se todas válidas', () => {
    expect(findInvalidPermissionKeys(['category.view'])).toEqual([])
  })

  it('lista vazia se input vazio', () => {
    expect(findInvalidPermissionKeys([])).toEqual([])
  })
})
