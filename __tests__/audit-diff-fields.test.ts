import { describe, it, expect } from 'vitest'
import { diffFields } from '../lib/audit'

describe('diffFields', () => {
  it('campos iguais → null', () => {
    const before = { name: 'A', value: 1 }
    const after = { name: 'A', value: 1 }
    expect(diffFields(before, after, ['name', 'value'])).toBeNull()
  })

  it('campo string mudou', () => {
    const before = { name: 'A' }
    const after = { name: 'B' }
    expect(diffFields(before, after, ['name'])).toEqual({
      name: { before: 'A', after: 'B' },
    })
  })

  it('campo number mudou', () => {
    const before = { value: 1 }
    const after = { value: 2 }
    expect(diffFields(before, after, ['value'])).toEqual({
      value: { before: 1, after: 2 },
    })
  })

  it('campo boolean mudou', () => {
    const before = { active: true }
    const after = { active: false }
    expect(diffFields(before, after, ['active'])).toEqual({
      active: { before: true, after: false },
    })
  })

  it('null → valor', () => {
    const before: Record<string, unknown> = { x: null }
    const after: Record<string, unknown> = { x: 'novo' }
    expect(diffFields(before, after, ['x'])).toEqual({
      x: { before: null, after: 'novo' },
    })
  })

  it('valor → null', () => {
    const before: Record<string, unknown> = { x: 'antigo' }
    const after: Record<string, unknown> = { x: null }
    expect(diffFields(before, after, ['x'])).toEqual({
      x: { before: 'antigo', after: null },
    })
  })

  it('undefined tratado como null', () => {
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = { x: 'valor' }
    expect(diffFields(before, after, ['x'])).toEqual({
      x: { before: null, after: 'valor' },
    })
  })

  it('múltiplos campos: só inclui mudados', () => {
    const before = { a: 1, b: 2, c: 3 }
    const after = { a: 1, b: 99, c: 3 }
    expect(diffFields(before, after, ['a', 'b', 'c'])).toEqual({
      b: { before: 2, after: 99 },
    })
  })

  it('arrays/objects: comparação JSON estável quando iguais', () => {
    const before = { tags: ['x', 'y'] }
    const after = { tags: ['x', 'y'] }
    expect(diffFields(before, after, ['tags'])).toBeNull()
  })

  it('arrays diferentes detecta', () => {
    const before = { tags: ['x'] }
    const after = { tags: ['x', 'y'] }
    const result = diffFields(before, after, ['tags'])
    expect(result).not.toBeNull()
    expect(result?.tags).toBeDefined()
  })

  it('campo fora da lista é ignorado', () => {
    const before = { name: 'A', secret: 'x' }
    const after = { name: 'A', secret: 'y' }
    expect(diffFields(before, after, ['name'])).toBeNull()
  })
})
