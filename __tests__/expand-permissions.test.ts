import { describe, it, expect } from 'vitest'
import { PERMISSIONS, expandPermissions } from '../lib/auth/permissions'

describe('expandPermissions', () => {
  it('lista vazia → []', () => {
    expect(expandPermissions([])).toEqual([])
  })

  it('permission concreta passa direto', () => {
    expect(expandPermissions(['category.create'])).toEqual(['category.create'])
  })

  it('"*" expande pra TODAS permissions', () => {
    const result = expandPermissions(['*'])
    expect(result.length).toBe(PERMISSIONS.length)
  })

  it('"category.*" expande pra todas que começam com "category."', () => {
    const result = expandPermissions(['category.*'])
    expect(result.every((p) => p.startsWith('category.'))).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('"*.view" expande pra todas que terminam com ".view"', () => {
    const result = expandPermissions(['*.view'])
    expect(result.every((p) => p.endsWith('.view'))).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('mistura wildcards + concretos sem duplicar', () => {
    const result = expandPermissions(['category.*', 'category.create'])
    const count = result.filter((p) => p === 'category.create').length
    expect(count).toBe(1)
  })

  it('resultado vem ordenado alfabeticamente', () => {
    const result = expandPermissions(['*'])
    const sorted = [...result].sort()
    expect(result).toEqual(sorted)
  })

  it('"*" inclui category.create', () => {
    expect(expandPermissions(['*'])).toContain('category.create')
  })
})
