import { describe, it, expect } from 'vitest'
import { diffPermissions } from '../lib/roles/validation'

describe('diffPermissions', () => {
  it('listas iguais → nada mudou', () => {
    expect(diffPermissions(['a', 'b'], ['a', 'b'])).toEqual({
      added: [],
      removed: [],
    })
  })

  it('detecta added', () => {
    expect(diffPermissions(['a'], ['a', 'b', 'c'])).toEqual({
      added: ['b', 'c'],
      removed: [],
    })
  })

  it('detecta removed', () => {
    expect(diffPermissions(['a', 'b', 'c'], ['a'])).toEqual({
      added: [],
      removed: ['b', 'c'],
    })
  })

  it('detecta added e removed simultaneamente', () => {
    expect(diffPermissions(['a', 'b'], ['b', 'c'])).toEqual({
      added: ['c'],
      removed: ['a'],
    })
  })

  it('listas vazias', () => {
    expect(diffPermissions([], [])).toEqual({ added: [], removed: [] })
  })

  it('antes vazio, depois cheio', () => {
    expect(diffPermissions([], ['a', 'b'])).toEqual({
      added: ['a', 'b'],
      removed: [],
    })
  })

  it('antes cheio, depois vazio', () => {
    expect(diffPermissions(['a', 'b'], [])).toEqual({
      added: [],
      removed: ['a', 'b'],
    })
  })

  it('resultado vem ordenado alfabeticamente', () => {
    const result = diffPermissions(['a'], ['c', 'b', 'a'])
    expect(result.added).toEqual(['b', 'c'])
  })
})
