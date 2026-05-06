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
import type { Role } from './permissoes-client'

interface BlockedUser {
  id: string
  name: string
  email: string
}

interface Props {
  empresaId: string
  role: Role
  onClose: () => void
  onDeleted: () => void
}

export function RoleDeleteModal({ empresaId, role, onClose, onDeleted }: Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[] | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    setBlockedUsers(null)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/roles/${role.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))

        // Backend retorna lista de users bloqueando exclusão (400)
        if (Array.isArray(body.users)) {
          setBlockedUsers(body.users)
          setError(body.erro)
          return
        }

        throw new Error(body.erro ?? 'Erro ao excluir role')
      }

      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {blockedUsers ? 'Não é possível excluir' : `Excluir role "${role.name}"?`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {blockedUsers ? (
            <>
              <p className="text-sm">
                Esta role tem <strong>{blockedUsers.length}</strong> usuário(s) ativo(s).
                Antes de excluir, mude a role desses usuários:
              </p>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 max-h-60 overflow-y-auto">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="text-sm">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">
                Esta ação é <strong>permanente</strong>. A role será apagada e não poderá ser
                recuperada.
              </p>
              {role.description && (
                <p className="text-sm text-muted-foreground italic">
                  &quot;{role.description}&quot;
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {role.permissionCount} permissões serão removidas.
              </p>
            </>
          )}

          {error && !blockedUsers && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          {blockedUsers ? (
            <Button onClick={onClose}>Entendi</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
