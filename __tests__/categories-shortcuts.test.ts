import { describe, it, expect, vi } from 'vitest'
import {
  findMatchingBinding,
  shouldDispatchShortcut,
  type ShortcutBinding,
} from '../lib/hooks/useKeyboardShortcuts'

describe('findMatchingBinding', () => {
  const bindings: ShortcutBinding[] = [
    { key: 'j', handler: vi.fn() },
    { key: 'ArrowDown', handler: vi.fn() },
    { key: '?', handler: vi.fn() },
  ]

  it('encontra binding por key exato', () => {
    expect(findMatchingBinding(bindings, 'j')?.key).toBe('j')
    expect(findMatchingBinding(bindings, 'ArrowDown')?.key).toBe('ArrowDown')
    expect(findMatchingBinding(bindings, '?')?.key).toBe('?')
  })

  it('é case-insensitive', () => {
    expect(findMatchingBinding(bindings, 'J')?.key).toBe('j')
    expect(findMatchingBinding(bindings, 'arrowdown')?.key).toBe('ArrowDown')
  })

  it('retorna null se key não bate', () => {
    expect(findMatchingBinding(bindings, 'z')).toBeNull()
  })

  it('ignora bindings com enabled=false', () => {
    const semJ: ShortcutBinding[] = [
      { key: 'j', handler: vi.fn(), enabled: false },
      { key: 'k', handler: vi.fn() },
    ]
    expect(findMatchingBinding(semJ, 'j')).toBeNull()
    expect(findMatchingBinding(semJ, 'k')?.key).toBe('k')
  })

  it('retorna primeiro match em caso de duplicatas', () => {
    const dup: ShortcutBinding[] = [
      { key: 'j', handler: vi.fn() },
      { key: 'j', handler: vi.fn() },
    ]
    const r = findMatchingBinding(dup, 'j')
    expect(r).toBe(dup[0])
  })
})

describe('shouldDispatchShortcut (decisão pura)', () => {
  const bindings: ShortcutBinding[] = [{ key: 'n', handler: vi.fn() }]

  it('dispara quando todas as condições OK', () => {
    expect(
      shouldDispatchShortcut('n', bindings, {
        typingTarget: false,
        dialogOpen: false,
        enabled: true,
      }),
    ).toBe(true)
  })

  it('não dispara quando enabled=false', () => {
    expect(
      shouldDispatchShortcut('n', bindings, {
        typingTarget: false,
        dialogOpen: false,
        enabled: false,
      }),
    ).toBe(false)
  })

  it('não dispara quando foco está em input', () => {
    expect(
      shouldDispatchShortcut('n', bindings, {
        typingTarget: true,
        dialogOpen: false,
        enabled: true,
      }),
    ).toBe(false)
  })

  it('não dispara quando há dialog aberto (default)', () => {
    expect(
      shouldDispatchShortcut('n', bindings, {
        typingTarget: false,
        dialogOpen: true,
        enabled: true,
      }),
    ).toBe(false)
  })

  it('dispara mesmo com dialog aberto se ignoreWhenDialogOpen=false', () => {
    expect(
      shouldDispatchShortcut('n', bindings, {
        typingTarget: false,
        dialogOpen: true,
        enabled: true,
        ignoreWhenDialogOpen: false,
      }),
    ).toBe(true)
  })

  it('não dispara se key não bate', () => {
    expect(
      shouldDispatchShortcut('z', bindings, {
        typingTarget: false,
        dialogOpen: false,
        enabled: true,
      }),
    ).toBe(false)
  })
})

describe('cenários combinados', () => {
  const bindings: ShortcutBinding[] = [
    { key: 'j', handler: vi.fn() },
    { key: 'k', handler: vi.fn() },
    { key: 'Enter', handler: vi.fn() },
  ]

  it('múltiplos atalhos suportados', () => {
    expect(findMatchingBinding(bindings, 'j')).toBeTruthy()
    expect(findMatchingBinding(bindings, 'k')).toBeTruthy()
    expect(findMatchingBinding(bindings, 'Enter')).toBeTruthy()
  })

  it('atalho disabled individualmente não interfere com outros', () => {
    const mix: ShortcutBinding[] = [
      { key: 'j', handler: vi.fn(), enabled: false },
      { key: 'k', handler: vi.fn(), enabled: true },
    ]
    expect(findMatchingBinding(mix, 'j')).toBeNull()
    expect(findMatchingBinding(mix, 'k')).toBeTruthy()
  })
})
