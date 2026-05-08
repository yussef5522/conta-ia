'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Plus, Mail, Clock, X, UserMinus, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/sidebar/breadcrumb'
import { buildBreadcrumb } from '@/lib/sidebar/breadcrumb-helper'
import { ConvidarUsuarioModal } from './convidar-usuario-modal'
import { LinkConviteModal } from './link-convite-modal'
import { MudarRoleModal } from './mudar-role-modal'
import { RemoverUsuarioModal } from './remover-usuario-modal'

export interface Role {
  id: string
  name: string
  isSystemDefault: boolean
  description?: string | null
}

export interface UserMember {
  id: string
  userCompanyRoleId: string
  name: string
  email: string
  role: Role
  addedAt: string
}

export interface PendingInvite {
  id: string
  email: string
  role: { id: string; name: string; isSystemDefault: boolean }
  invitedBy: { name: string; email: string } | null
  expiresAt: string
  createdAt: string
}

interface Props {
  empresaId: string
  empresaNome: string
  currentUserId: string
  canRemove: boolean
  canAssignRole: boolean
}

export function UsuariosClient({
  empresaId,
  empresaNome,
  currentUserId,
  canRemove,
  canAssignRole,
}: Props) {
  const [users, setUsers] = useState<UserMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState<{ email: string; url: string } | null>(
    null,
  )
  const [editingUser, setEditingUser] = useState<UserMember | null>(null)
  const [removingUser, setRemovingUser] = useState<UserMember | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/usuarios`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao carregar usuários')
      }
      const data = await res.json()
      setUsers(data.users)
      setInvites(data.invites)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleCancelInvite(inviteId: string) {
    if (!confirm('Cancelar este convite?')) return

    try {
      const res = await fetch(`/api/empresas/${empresaId}/convites/${inviteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.erro ?? 'Erro ao cancelar convite')
        return
      }
      fetchData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro')
    }
  }

  function daysUntilExpire(expiresAt: string): string {
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    if (days <= 0) return 'Expirado'
    if (days === 1) return 'Expira hoje'
    return `Expira em ${days} dias`
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const pathname = usePathname()
  const breadcrumbItems = buildBreadcrumb({
    pathname,
    empresaName: empresaNome,
    empresaId,
  })

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">👥 Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresaNome} · Gerencie quem tem acesso à empresa
          </p>
        </div>
        <Button onClick={() => setCreatingInvite(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                Usuários Ativos
              </h2>
              <Badge variant="secondary" className="text-xs">
                {users.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {users.map((user) => (
                <Card key={user.userCompanyRoleId} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{user.name}</span>
                          {user.id === currentUserId && (
                            <Badge variant="outline" className="text-xs">
                              Você
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>{user.email}</span>
                          <span>·</span>
                          <span>Adicionado em {formatDate(user.addedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={user.role.isSystemDefault ? 'default' : 'outline'}>
                        {user.role.name}
                      </Badge>

                      {user.id !== currentUserId && (
                        <>
                          {canAssignRole && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingUser(user)}
                              title="Mudar role"
                            >
                              <UserCog className="h-3 w-3" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRemovingUser(user)}
                              title="Remover"
                            >
                              <UserMinus className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {invites.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                  Convites Pendentes
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {invites.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {invites.map((inv) => (
                  <Card key={inv.id} className="p-4 bg-muted/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                          <Mail className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{inv.email}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <Clock className="h-3 w-3" />
                            <span>{daysUntilExpire(inv.expiresAt)}</span>
                            {inv.invitedBy && (
                              <>
                                <span>·</span>
                                <span>Convidado por {inv.invitedBy.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">{inv.role.name}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelInvite(inv.id)}
                          title="Cancelar convite"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {users.length <= 1 && invites.length === 0 && (
            <Card className="p-12 text-center">
              <div className="text-4xl mb-3">👥</div>
              <h3 className="font-semibold">Apenas você na empresa</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                Convide colaboradores pra ajudar com categorias, transações, relatórios e
                mais.
              </p>
              <Button className="mt-4" onClick={() => setCreatingInvite(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Convidar primeiro usuário
              </Button>
            </Card>
          )}
        </>
      )}

      {creatingInvite && (
        <ConvidarUsuarioModal
          empresaId={empresaId}
          onClose={() => setCreatingInvite(false)}
          onCreated={(invite) => {
            setCreatingInvite(false)
            setShowLinkModal({ email: invite.email, url: invite.inviteUrl })
            fetchData()
          }}
        />
      )}

      {showLinkModal && (
        <LinkConviteModal
          email={showLinkModal.email}
          url={showLinkModal.url}
          onClose={() => setShowLinkModal(null)}
        />
      )}

      {editingUser && (
        <MudarRoleModal
          empresaId={empresaId}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            fetchData()
          }}
        />
      )}

      {removingUser && (
        <RemoverUsuarioModal
          empresaId={empresaId}
          user={removingUser}
          onClose={() => setRemovingUser(null)}
          onRemoved={() => {
            setRemovingUser(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
