'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserMember } from './usuarios-client'

interface Role {
  id: string
  name: string
  isSystemDefault: boolean
}

interface Props {
  empresaId: string
  user: UserMember
  onClose: () => void
  onSaved: () => void
}

export function MudarRoleModal({ empresaId, user, onClose, onSaved }: Props) {
  const [roleId, setRoleId] = useState(user.role.id)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/roles`)
      .then((r) => r.json())
      .then((data) => {
        setRoles(data.roles ?? [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [empresaId])

  async function handleSubmit() {
    if (roleId === user.role.id) {
      onClose()
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/usuarios/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao mudar role')
      }

      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mudar role de {user.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="text-sm space-y-1">
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Role atual:</strong> {user.role.name}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">Nova role</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={isLoading}>
              <SelectTrigger id="new-role">
                <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} {r.isSystemDefault && '(sistema)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
