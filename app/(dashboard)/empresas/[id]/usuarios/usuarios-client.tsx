'use client'

// Meu Time — Sprint 1.4.
// Refinado: avatar com gradient por role + RoleBadge colorido + filtros
// (status + busca) + animação stagger Framer Motion + empty state premium.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Plus,
  Mail,
  Clock,
  X,
  UserMinus,
  UserCog,
  Search,
  Users,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Breadcrumb } from '@/components/sidebar/breadcrumb'
import { buildBreadcrumb } from '@/lib/sidebar/breadcrumb-helper'
import { RoleBadge } from '@/components/team/role-badge'
import { TeamAvatar } from '@/components/team/team-avatar'
import { useToast } from '@/components/ui/use-toast'
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

type StatusFilter = 'TODOS' | 'ATIVOS' | 'PENDENTES'

export function UsuariosClient({
  empresaId,
  empresaNome,
  currentUserId,
  canRemove,
  canAssignRole,
}: Props) {
  const { toast } = useToast()
  const reducedMotion = useReducedMotion()
  const [users, setUsers] = useState<UserMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState<{
    email: string
    url: string
    emailSent?: boolean
  } | null>(null)
  const [editingUser, setEditingUser] = useState<UserMember | null>(null)
  const [removingUser, setRemovingUser] = useState<UserMember | null>(null)

  // Filtros (Sprint 1.4)
  const [busca, setBusca] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS')

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

  async function handleCancelInvite(inviteId: string, email: string) {
    if (!confirm(`Cancelar convite pra ${email}?`)) return

    try {
      const res = await fetch(`/api/empresas/${empresaId}/convites/${inviteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Erro ao cancelar',
          description: body.erro ?? 'Tente novamente.',
        })
        return
      }
      toast({ variant: 'success', title: 'Convite cancelado', description: email })
      fetchData()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
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

  // Aplica filtros (busca + status)
  const filteredUsers = useMemo(() => {
    if (statusFilter === 'PENDENTES') return []
    const q = busca.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q),
    )
  }, [users, busca, statusFilter])

  const filteredInvites = useMemo(() => {
    if (statusFilter === 'ATIVOS') return []
    const q = busca.trim().toLowerCase()
    if (!q) return invites
    return invites.filter(
      (i) =>
        i.email.toLowerCase().includes(q) ||
        i.role.name.toLowerCase().includes(q),
    )
  }, [invites, busca, statusFilter])

  const pathname = usePathname()
  const breadcrumbItems = buildBreadcrumb({
    pathname,
    empresaName: empresaNome,
    empresaId,
  })

  const isEmpty = users.length <= 1 && invites.length === 0
  const stagger = reducedMotion ? 0 : 0.04

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: 24, color: '#0C447C' }}
          >
            Meu Time
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresaNome} · Gerencie quem tem acesso à empresa
          </p>
        </div>
        <Button
          onClick={() => setCreatingInvite(true)}
          style={{ backgroundColor: '#185FA5' }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Convidar pessoa
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filtros — só aparece se já tem 2+ pessoas/convites (evita poluir empty) */}
      {!isLoading && !isEmpty && (
        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-muted-foreground mt-auto mb-1.5 shrink-0" />

            <div className="space-y-1 flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground">Buscar</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Nome, email ou role..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="h-8 w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="ATIVOS">Ativos</SelectItem>
                  <SelectItem value="PENDENTES">Convites pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState onInvite={() => setCreatingInvite(true)} />
      ) : (
        <>
          {/* USUÁRIOS ATIVOS */}
          {filteredUsers.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Membros ativos
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {filteredUsers.length}
                </Badge>
              </div>

              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {filteredUsers.map((user, i) => (
                    <motion.div
                      key={user.userCompanyRoleId}
                      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, delay: i * stagger }}
                    >
                      <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <TeamAvatar
                              name={user.name}
                              roleName={user.role.name}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">
                                  {user.name}
                                </span>
                                {user.id === currentUserId && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Você
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>{user.email}</span>
                                <span>·</span>
                                <span>Desde {formatDate(user.addedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <RoleBadge roleName={user.role.name} />

                            {user.id !== currentUserId && (
                              <>
                                {canAssignRole && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingUser(user)}
                                    title="Mudar role"
                                    aria-label={`Mudar role de ${user.name}`}
                                  >
                                    <UserCog className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {canRemove && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRemovingUser(user)}
                                    title="Remover do time"
                                    aria-label={`Remover ${user.name} do time`}
                                  >
                                    <UserMinus className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* CONVITES PENDENTES */}
          {filteredInvites.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Convites pendentes
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {filteredInvites.length}
                </Badge>
              </div>

              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {filteredInvites.map((inv, i) => (
                    <motion.div
                      key={inv.id}
                      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, delay: i * stagger }}
                    >
                      <Card className="p-4 bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0"
                              style={{
                                background:
                                  'linear-gradient(135deg, #EF9F27 0%, #b45309 100%)',
                              }}
                              aria-label="Convite pendente"
                            >
                              <Mail className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{inv.email}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <Clock className="h-3 w-3" />
                                <span>{daysUntilExpire(inv.expiresAt)}</span>
                                {inv.invitedBy && (
                                  <>
                                    <span>·</span>
                                    <span>por {inv.invitedBy.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <RoleBadge roleName={inv.role.name} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCancelInvite(inv.id, inv.email)
                              }
                              title="Cancelar convite"
                              aria-label={`Cancelar convite pra ${inv.email}`}
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Vazio APÓS filtro (não é o empty original) */}
          {filteredUsers.length === 0 && filteredInvites.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum membro ou convite corresponde aos filtros.
              </p>
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
            setShowLinkModal({
              email: invite.email,
              url: invite.inviteUrl,
              emailSent: invite.emailSent,
            })
            fetchData()
          }}
        />
      )}

      {showLinkModal && (
        <LinkConviteModal
          email={showLinkModal.email}
          url={showLinkModal.url}
          emailSent={showLinkModal.emailSent}
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

// Empty state premium quando OWNER está sozinho.
function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background:
            'linear-gradient(135deg, rgba(12,68,124,0.10) 0%, rgba(24,95,165,0.15) 100%)',
        }}
      >
        <Users className="h-8 w-8" style={{ color: '#185FA5' }} />
      </div>
      <h3
        className="mt-4 font-medium tracking-tight"
        style={{ fontSize: 18, color: '#0C447C' }}
      >
        Você é o único membro do time
      </h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        Convide colaboradores pra ajudar com categorias, transações, relatórios e mais.
        Cada pessoa recebe um link de convite (válido por 7 dias).
      </p>
      <Button
        className="mt-5"
        onClick={onInvite}
        style={{ backgroundColor: '#185FA5' }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Convidar primeira pessoa
      </Button>
    </Card>
  )
}
