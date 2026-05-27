'use client'

// Sprint 5.0.3.0c (c5) — Modal "Nova view customizada".
//
// Form com nome + 1 de 6 emojis padrão. Filtros atuais do user são
// snapshotados quando user marca "Salvar filtros atuais".

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMOJIS = ['🏠', '⚡', '📊', '💼', '🍔', '📅']

interface Props {
  open: boolean
  currentFilters: Record<string, unknown>
  onClose: () => void
  onCreate: (input: { name: string; icon: string | null; filters: string }) => Promise<void>
}

export function NewViewModal({
  open,
  currentFilters,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | null>(EMOJIS[0])
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate({
        name: name.trim(),
        icon,
        filters: JSON.stringify(currentFilters),
      })
      setName('')
      setIcon(EMOJIS[0])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) {
          setName('')
          setIcon(EMOJIS[0])
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova visualização</DialogTitle>
          <DialogDescription>
            Salva os filtros atuais com um nome pra reuso rápido depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-view-name">Nome</Label>
            <Input
              id="new-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aluguel mensal"
              maxLength={50}
              autoFocus
              data-testid="new-view-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`text-lg w-9 h-9 rounded border-2 transition-colors ${
                    icon === e
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                  aria-label={`Ícone ${e}`}
                  data-testid={`new-view-emoji-${e}`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIcon(null)}
                className={`text-xs w-9 h-9 rounded border-2 transition-colors ${
                  icon === null
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent hover:bg-muted/50'
                }`}
                aria-label="Sem ícone"
              >
                ∅
              </button>
            </div>
          </div>

          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Os filtros atuais (busca, período, status) serão salvos com a view.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            type="button"
            data-testid="new-view-create"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar view'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
