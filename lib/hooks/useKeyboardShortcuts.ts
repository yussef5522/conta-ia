'use client'

import { useEffect } from 'react'

export interface ShortcutBinding {
  // String key conforme KeyboardEvent.key (ou KeyboardEvent.code).
  // Ex: 'j', 'ArrowDown', '/', '?', 'Enter', 'Escape', 'Delete', 'n'
  key: string
  // Callback chamado quando o atalho dispara.
  handler: (event: KeyboardEvent) => void
  // Quando false, ignora a tecla.
  enabled?: boolean
  // Se preventDefault deve ser chamado (default true).
  preventDefault?: boolean
}

// Detecta se o foco está em um campo de entrada onde atalhos NÃO devem disparar.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

// Detecta se há um modal/dialog aberto (heurística: data-state=open em [role=dialog]).
function hasOpenDialog(): boolean {
  if (typeof document === 'undefined') return false
  const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]')
  return dialogs.length > 0
}

interface Options {
  // Quando false, desabilita TODOS os atalhos. Útil pra ligar/desligar
  // dependendo do modo (view/create/edit).
  enabled?: boolean
  // Quando true, ignora atalhos se houver modal/dialog aberto. Default true.
  ignoreWhenDialogOpen?: boolean
}

// Hook genérico de atalhos de teclado.
// - Não dispara se foco está em input/textarea/select/contenteditable.
// - Não dispara se há modal/dialog aberto (a não ser que ignoreWhenDialogOpen=false).
// - Cleanup automático no unmount.
export function useKeyboardShortcuts(bindings: ShortcutBinding[], options: Options = {}) {
  const { enabled = true, ignoreWhenDialogOpen = true } = options

  useEffect(() => {
    if (!enabled) return
    if (typeof document === 'undefined') return

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (ignoreWhenDialogOpen && hasOpenDialog()) return

      for (const b of bindings) {
        if (b.enabled === false) continue
        if (b.key.toLowerCase() === e.key.toLowerCase()) {
          if (b.preventDefault !== false) e.preventDefault()
          b.handler(e)
          return
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [bindings, enabled, ignoreWhenDialogOpen])
}

// Helper testável: dado um event-like, retorna o binding que casaria.
// Usado em testes pra evitar montar DOM.
export function findMatchingBinding(
  bindings: ShortcutBinding[],
  key: string,
): ShortcutBinding | null {
  for (const b of bindings) {
    if (b.enabled === false) continue
    if (b.key.toLowerCase() === key.toLowerCase()) return b
  }
  return null
}

// Versão pura testável da decisão "dispara ou não" — usada em unit tests
// (já que não temos testing-library pra rodar componente).
export function shouldDispatchShortcut(
  key: string,
  bindings: ShortcutBinding[],
  context: {
    typingTarget: boolean
    dialogOpen: boolean
    enabled: boolean
    ignoreWhenDialogOpen?: boolean
  },
): boolean {
  if (!context.enabled) return false
  if (context.typingTarget) return false
  if ((context.ignoreWhenDialogOpen ?? true) && context.dialogOpen) return false
  return findMatchingBinding(bindings, key) !== null
}
