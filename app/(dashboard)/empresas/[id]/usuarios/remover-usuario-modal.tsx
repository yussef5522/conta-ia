'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { UserMember } from './usuarios-client'

interface Props {
  empresaId: string
  user: UserMember
  onClose: () => void
  onRemoved: () => void
}

export function RemoverUsuarioModal({ empresaId, user, onClose, onRemoved }: Props) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    setIsRemoving(true)
    setError(null)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/usuarios/${user.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao remover usuário')
      }

      onRemoved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Remover {user.name}?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <p className="text-sm">
            <strong>{user.name}</strong> ({user.email}) perderá acesso à empresa
            imediatamente.
          </p>

          <p className="text-xs text-muted-foreground">
            Os dados criados por este usuário (categorias, transações, etc) permanecem. A
            conta do usuário continua existindo — apenas o acesso a esta empresa será
            removido.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRemoving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
            {isRemoving ? 'Removendo...' : 'Remover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
