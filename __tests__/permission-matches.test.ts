import { describe, it, expect } from 'vitest'
import { permissionMatches } from '../lib/auth/permissions'

describe('permissionMatches — wildcard logic', () => {
  it('exact match: "category.create" → required "category.create" = true', () => {
    expect(permissionMatches(['category.create'], 'category.create')).toBe(true)
  })

  it('exact mismatch: "category.create" → required "category.delete" = false', () => {
    expect(permissionMatches(['category.create'], 'category.delete')).toBe(false)
  })

  it('global wildcard "*" → matches qualquer coisa', () => {
    expect(permissionMatches(['*'], 'category.create')).toBe(true)
    expect(permissionMatches(['*'], 'transaction.delete')).toBe(true)
  })

  it('resource wildcard "category.*" → matches category.create', () => {
    expect(permissionMatches(['category.*'], 'category.create')).toBe(true)
  })

  it('resource wildcard "category.*" → NÃO matches transaction.create', () => {
    expect(permissionMatches(['category.*'], 'transaction.create')).toBe(false)
  })

  it('action wildcard "*.view" → matches category.view', () => {
    expect(permissionMatches(['*.view'], 'category.view')).toBe(true)
  })

  it('action wildcard "*.view" → NÃO matches category.create', () => {
    expect(permissionMatches(['*.view'], 'category.create')).toBe(false)
  })

  it('lista vazia → false', () => {
    expect(permissionMatches([], 'category.view')).toBe(false)
  })

  it('múltiplas permissions: encontra na lista', () => {
    expect(
      permissionMatches(['transaction.view', 'category.create'], 'category.create'),
    ).toBe(true)
  })

  it('formato inválido (sem ponto) → false', () => {
    expect(permissionMatches(['category'], 'category.view')).toBe(false)
  })
})
