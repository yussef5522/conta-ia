'use client'

// Hook genérico de atalhos de teclado. Sprint 3.0.4 C2.
//
// Decisões:
// - Listener é document-level (não window) pra interagir com forms aninhados
// - IGNORA quando o user está digitando em <input>/<textarea>/<select>/contentEditable
//   (exceto teclas explicitamente safeInInputs: Esc)
// - Aceita Cmd/Ctrl como meta (Mac usa Cmd, Win/Linux usa Ctrl)
// - Cada handler retorna boolean: se TRUE, preventDefault + stopPropagation

import { useEffect } from 'react'

export interface ShortcutHandler {
  /** Tecla principal, case-insensitive. Ex: 'j', 'k', 'Enter', 'Escape', '/' */
  key: string
  /** Cmd (Mac) ou Ctrl (Win/Linux). Default false. */
  meta?: boolean
  /** Shift. Default false. */
  shift?: boolean
  /** Permite a tecla mesmo quando o foco está num input. Default false. */
  safeInInputs?: boolean
  /** Handler invocado quando bate. Retorna void; é sempre preventDefault. */
  run: (e: KeyboardEvent) => void
}

// Duck-typed pra ser testável em ambiente node (sem jsdom).
// Em browser, qualquer HTMLElement tem .tagName e .isContentEditable.
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el) return false
  const e = el as { tagName?: string; isContentEditable?: boolean }
  const tag = e.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (e.isContentEditable === true) return true
  return false
}

// Verifica se um KeyboardEvent bate com a definição de ShortcutHandler.
// Função PURA, exportada pra testes unitários.
export function matchShortcut(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
  s: ShortcutHandler,
): boolean {
  if (e.key.toLowerCase() !== s.key.toLowerCase()) return false
  const metaPressed = !!(e.metaKey || e.ctrlKey)
  if (!!s.meta !== metaPressed) return false
  if (!!s.shift !== !!e.shiftKey) return false
  return true
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutHandler[],
  /** Desliga o hook sem desmontar (ex: modal aberto). */
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(e.target)
      for (const s of shortcuts) {
        if (typing && !s.safeInInputs) continue
        if (!matchShortcut(e, s)) continue
        e.preventDefault()
        e.stopPropagation()
        s.run(e)
        return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, enabled])
}
