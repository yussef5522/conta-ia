'use client'

// Sprint 3.0.4 C2 — modal de ajuda com a lista de atalhos disponíveis.
// Abre via tecla "?" ou clique no botão "?".

import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Shortcut {
  keys: string[]
  description: string
}

interface Group {
  title: string
  shortcuts: Shortcut[]
}

const GROUPS: Group[] = [
  {
    title: 'Navegação',
    shortcuts: [
      { keys: ['J'], description: 'Próxima transação' },
      { keys: ['K'], description: 'Transação anterior' },
      { keys: ['/'], description: 'Focar busca' },
      { keys: ['Esc'], description: 'Limpar foco / fechar' },
    ],
  },
  {
    title: 'Seleção',
    shortcuts: [
      { keys: ['Espaço'], description: 'Selecionar / desmarcar atual' },
      { keys: ['⌘', 'A'], description: 'Selecionar todos da página' },
    ],
  },
  {
    title: 'Ações na transação atual',
    shortcuts: [
      { keys: ['E'], description: 'Editar' },
      { keys: ['C'], description: 'Abrir dropdown de categoria' },
      { keys: ['X'], description: 'Ignorar' },
      { keys: ['Enter'], description: 'Confirmar / conciliar' },
    ],
  },
  {
    title: 'Ajuda',
    shortcuts: [{ keys: ['?'], description: 'Mostrar esta lista' }],
  },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de teclado
          </DialogTitle>
          <DialogDescription>
            Operação 100% sem mouse. Funciona em /transacoes (não dispara enquanto você digita em campos).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.title}
              </h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {g.shortcuts.map((s) => (
                  <div key={s.description} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{s.description}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground">+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
