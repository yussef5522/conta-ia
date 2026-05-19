'use client'

// Modal Convidar Pessoa — Sprint 1.4.
// Premium: dropdown de role mostra DESCRIÇÃO embaixo do nome.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { RoleBadge } from '@/components/team/role-badge'
import {
  getRoleStyle,
  compareRolesByDisplayOrder,
} from '@/lib/team/role-style'

interface Role {
  id: string
  name: string
  isSystemDefault: boolean
  description?: string | null
}

interface Props {
  empresaId: string
  onClose: () => void
  onCreated: (invite: {
    email: string
    inviteUrl: string
    emailSent?: boolean
  }) => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  const sortedRoles = useMemo(() => {
    // Não permite criar convite como OWNER (cada empresa tem 1 OWNER único)
    return [...roles]
      .filter((r) => r.name.toUpperCase() !== 'OWNER')
      .sort(compareRolesByDisplayOrder)
  }, [roles])

  const selectedRole = sortedRoles.find((r) => r.id === roleId)
  const selectedStyle = selectedRole ? getRoleStyle(selectedRole.name) : null

  function validateAndSubmit() {
    if (!email.trim()) {
      setError('Informe o email da pessoa')
      return
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Email inválido')
      return
    }
    if (!roleId) {
      setError('Selecione um papel')
      return
    }
    void handleSubmit()
  }

  async function handleSubmit() {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          roleId,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao criar convite')
      }

      const data = await res.json()
      onCreated({
        email: data.invite.email,
        inviteUrl: data.invite.inviteUrl,
        emailSent: data.invite.emailSent,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" style={{ color: '#185FA5' }} />
            Convidar pessoa
          </DialogTitle>
          <DialogDescription>
            Envie um link com validade de 7 dias. O convidado faz login (ou
            cria conta) com o mesmo email pra aceitar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error && (
            <div
              className="rounded-md border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-muted-foreground"
            >
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                className="h-10 pl-8"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com.br"
                autoComplete="off"
                autoFocus
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label
              htmlFor="role"
              className="text-xs font-medium text-muted-foreground"
            >
              Papel na empresa
            </Label>
            <Select
              value={roleId}
              onValueChange={setRoleId}
              disabled={isLoading || isSaving}
            >
              <SelectTrigger id="role" className="h-10">
                <SelectValue
                  placeholder={isLoading ? 'Carregando...' : 'Selecione um papel'}
                />
              </SelectTrigger>
              <SelectContent>
                {sortedRoles.map((r) => {
                  const style = getRoleStyle(r.name)
                  return (
                    <SelectItem key={r.id} value={r.id} className="py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.name}</span>
                          {!r.isSystemDefault && (
                            <span className="text-[10px] text-muted-foreground">
                              (custom)
                            </span>
                          )}
                        </div>
                        <span
                          className="text-xs text-muted-foreground leading-snug"
                          style={{ maxWidth: 380 }}
                        >
                          {r.description ?? style.description}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* Preview da role escolhida */}
            {selectedRole && selectedStyle && (
              <div className="flex items-start gap-2 mt-2 rounded-md border bg-muted/30 p-2.5">
                <RoleBadge roleName={selectedRole.name} />
                <p className="text-xs text-muted-foreground leading-snug">
                  {selectedRole.description ?? selectedStyle.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            onClick={validateAndSubmit}
            disabled={isSaving || isLoading}
            style={{ backgroundColor: '#185FA5' }}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Gerando convite...
              </>
            ) : (
              'Gerar link de convite'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
