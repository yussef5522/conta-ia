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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Role {
  id: string
  name: string
  isSystemDefault: boolean
  description?: string | null
}

interface Props {
  empresaId: string
  onClose: () => void
  onCreated: (invite: { email: string; inviteUrl: string }) => void
}

export function ConvidarUsuarioModal({ empresaId, onClose, onCreated }: Props) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
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
    if (!email.trim()) {
      setError('Email obrigatório')
      return
    }
    if (!roleId) {
      setError('Selecione uma role')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), roleId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao criar convite')
      }

      const data = await res.json()
      onCreated({ email: data.invite.email, inviteUrl: data.invite.inviteUrl })
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
          <DialogTitle>Convidar Usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              O usuário precisará fazer login/cadastrar com este mesmo email pra aceitar o
              convite.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              Role <span className="text-destructive">*</span>
            </Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={isLoading}>
              <SelectTrigger id="role">
                <SelectValue
                  placeholder={isLoading ? 'Carregando...' : 'Selecione uma role'}
                />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} {r.isSystemDefault && '(sistema)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O convite gera um link válido por 7 dias.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? 'Gerando...' : 'Gerar convite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
