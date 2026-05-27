'use client'

// Sprint 5.0.3.0c (c5) — Modal "Renomear view".
// Simples: input do nome + ícone opcional + Salvar.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomSavedView } from '@/lib/contas-pagar/use-saved-views'

const EMOJIS = ['🏠', '⚡', '📊', '💼', '🍔', '📅']

interface Props {
  view: CustomSavedView | null
  onClose: () => void
  onSave: (patch: { name: string; icon: string | null }) => Promise<void>
}

export function RenameViewDialog({ view, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (view) {
      setName(view.name)
      setIcon(view.icon)
    }
  }, [view?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return null

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), icon })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!view} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear view</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rename-view-name">Nome</Label>
            <Input
              id="rename-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
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
                  className={`text-lg w-9 h-9 rounded border-2 ${
                    icon === e ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIcon(null)}
                className={`text-xs w-9 h-9 rounded border-2 ${
                  icon === null ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                }`}
              >
                ∅
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} type="button">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            type="button"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
