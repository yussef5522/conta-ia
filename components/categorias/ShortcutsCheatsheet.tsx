'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ATALHOS: { tecla: string; acao: string }[] = [
  { tecla: 'J / ↓', acao: 'Próxima categoria' },
  { tecla: 'K / ↑', acao: 'Categoria anterior' },
  { tecla: 'Enter', acao: 'Editar categoria selecionada' },
  { tecla: 'N', acao: 'Nova categoria' },
  { tecla: 'E', acao: 'Editar categoria selecionada' },
  { tecla: 'Del', acao: 'Desativar categoria selecionada' },
  { tecla: 'Esc', acao: 'Desselecionar / fechar form' },
  { tecla: '/', acao: 'Focar campo de busca' },
  { tecla: '?', acao: 'Abrir esta lista de atalhos' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsCheatsheet({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>
            Atalhos disponíveis na tela do Plano de Contas. Não funcionam quando você está
            digitando em um campo ou editando uma categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Tecla
                </th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {ATALHOS.map((a, i) => (
                <tr key={a.tecla} className={i > 0 ? 'border-t' : ''}>
                  <td className="px-3 py-2">
                    <kbd className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                      {a.tecla}
                    </kbd>
                  </td>
                  <td className="px-3 py-2">{a.acao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
