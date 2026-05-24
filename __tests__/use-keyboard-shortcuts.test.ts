// Sprint 3.0.4 C2 — testes das funções puras matchShortcut + isTypingTarget.
//
// O hook em si (useKeyboardShortcuts) é integração com document.addEventListener;
// validamos manualmente em browser. Aqui testamos as primitivas que governam
// QUANDO o handler dispara.

import { describe, it, expect } from 'vitest'
import { matchShortcut, isTypingTarget } from '@/lib/hooks/use-keyboard-shortcuts'
import type { ShortcutHandler } from '@/lib/hooks/use-keyboard-shortcuts'

const noop = () => {}

describe('matchShortcut', () => {
  it('tecla simples bate por key', () => {
    const s: ShortcutHandler = { key: 'j', run: noop }
    expect(matchShortcut({ key: 'j' }, s)).toBe(true)
  })

  it('tecla diferente NÃO bate', () => {
    const s: ShortcutHandler = { key: 'j', run: noop }
    expect(matchShortcut({ key: 'k' }, s)).toBe(false)
  })

  it('case-insensitive: J bate com j', () => {
    const s: ShortcutHandler = { key: 'j', run: noop }
    expect(matchShortcut({ key: 'J' }, s)).toBe(true)
  })

  it('meta=true exige Cmd ou Ctrl', () => {
    const s: ShortcutHandler = { key: 'a', meta: true, run: noop }
    expect(matchShortcut({ key: 'a' }, s)).toBe(false)
    expect(matchShortcut({ key: 'a', metaKey: true }, s)).toBe(true)
    expect(matchShortcut({ key: 'a', ctrlKey: true }, s)).toBe(true)
  })

  it('meta=false rejeita Cmd (não confunde Cmd+A com A puro)', () => {
    const s: ShortcutHandler = { key: 'a', run: noop }
    expect(matchShortcut({ key: 'a', metaKey: true }, s)).toBe(false)
    expect(matchShortcut({ key: 'a' }, s)).toBe(true)
  })

  it('shift=true exige shift pressionado', () => {
    const s: ShortcutHandler = { key: '?', shift: true, run: noop }
    expect(matchShortcut({ key: '?', shiftKey: true }, s)).toBe(true)
    expect(matchShortcut({ key: '?' }, s)).toBe(false)
  })

  it('shift=false rejeita shift', () => {
    const s: ShortcutHandler = { key: 'j', run: noop }
    expect(matchShortcut({ key: 'j', shiftKey: true }, s)).toBe(false)
  })

  it('Enter/Escape são nomes literais (não keycode)', () => {
    expect(matchShortcut({ key: 'Enter' }, { key: 'Enter', run: noop })).toBe(true)
    expect(matchShortcut({ key: 'Escape' }, { key: 'Escape', run: noop })).toBe(true)
  })

  it('combo Cmd+Shift+A', () => {
    const s: ShortcutHandler = { key: 'a', meta: true, shift: true, run: noop }
    expect(matchShortcut({ key: 'a', metaKey: true, shiftKey: true }, s)).toBe(true)
    expect(matchShortcut({ key: 'a', metaKey: true }, s)).toBe(false)
    expect(matchShortcut({ key: 'a', shiftKey: true }, s)).toBe(false)
  })
})

describe('isTypingTarget', () => {
  // Function is duck-typed (procura tagName e isContentEditable), então
  // testa com plain objects pra rodar em node env sem jsdom.
  it('null → false', () => {
    expect(isTypingTarget(null)).toBe(false)
  })

  it('INPUT → true', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true)
  })

  it('TEXTAREA → true', () => {
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true)
  })

  it('SELECT → true', () => {
    expect(isTypingTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true)
  })

  it('contentEditable=true → true', () => {
    expect(
      isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true)
  })

  it('DIV sem contentEditable → false', () => {
    expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false)
  })

  it('BUTTON → false (clicar não é digitar)', () => {
    expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false)
  })

  it('plain Object sem props → false', () => {
    expect(isTypingTarget({} as EventTarget)).toBe(false)
  })
})
