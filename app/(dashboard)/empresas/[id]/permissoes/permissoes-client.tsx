'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye, Users, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/sidebar/breadcrumb'
import { buildBreadcrumb } from '@/lib/sidebar/breadcrumb-helper'
import { RoleEditModal } from './role-edit-modal'
import { RoleViewModal } from './role-view-modal'
import { RoleDeleteModal } from './role-delete-modal'

export interface Role {
  id: string
  name: string
  description: string | null
  isSystemDefault: boolean
  companyId: string | null
  permissionKeys: string[]
  permissionCount: number
  userCount: number
}

interface Props {
  empresaId: string
  empresaNome: string
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export function PermissoesClient({
  empresaId,
  empresaNome,
  canCreate,
  canUpdate,
  canDelete,
}: Props) {
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [viewingRole, setViewingRole] = useState<Role | null>(null)
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchRoles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/roles`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao carregar roles')
      }
      const data = await res.json()
      setRoles(data.roles)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const systemRoles = roles.filter((r) => r.isSystemDefault)
  const customRoles = roles.filter((r) => !r.isSystemDefault)

  const pathname = usePathname()
  const breadcrumbItems = buildBreadcrumb({
    pathname,
    empresaName: empresaNome,
    empresaId,
  })

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🛡️ Roles e Permissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresaNome} · Gerencie quem pode fazer o quê
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Role
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="h-32 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                Roles Padrão (Sistema)
              </h2>
              <Badge variant="secondary" className="text-xs">
                {systemRoles.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemRoles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  canUpdate={false}
                  canDelete={false}
                  onView={() => setViewingRole(role)}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                Roles Customizadas
              </h2>
              <Badge variant="secondary" className="text-xs">
                {customRoles.length}
              </Badge>
            </div>

            {customRoles.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-4xl mb-3">🎨</div>
                <h3 className="font-semibold">Nenhuma role customizada ainda</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  As 5 roles padrão (Owner, Admin, Accountant, Financial, Viewer) atendem
                  maioria dos casos. Crie roles customizadas apenas se precisar de
                  combinações específicas.
                </p>
                {canCreate && (
                  <Button className="mt-4" onClick={() => setCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeira role custom
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    onView={() => setViewingRole(role)}
                    onEdit={() => setEditingRole(role)}
                    onDelete={() => setDeletingRole(role)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {creating && (
        <RoleEditModal
          empresaId={empresaId}
          role={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            fetchRoles()
          }}
        />
      )}
      {editingRole && (
        <RoleEditModal
          empresaId={empresaId}
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null)
            fetchRoles()
          }}
        />
      )}
      {viewingRole && (
        <RoleViewModal role={viewingRole} onClose={() => setViewingRole(null)} />
      )}
      {deletingRole && (
        <RoleDeleteModal
          empresaId={empresaId}
          role={deletingRole}
          onClose={() => setDeletingRole(null)}
          onDeleted={() => {
            setDeletingRole(null)
            fetchRoles()
          }}
        />
      )}
    </div>
  )
}

interface RoleCardProps {
  role: Role
  canUpdate: boolean
  canDelete: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

function RoleCard({ role, canUpdate, canDelete, onView, onEdit, onDelete }: RoleCardProps) {
  const icon = role.isSystemDefault ? '🛡️' : '🎨'
  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="text-2xl">{icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{role.name}</h3>
              {role.isSystemDefault && (
                <Badge variant="outline" className="text-xs">
                  Sistema
                </Badge>
              )}
            </div>
            {role.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {role.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>
            {role.userCount} {role.userCount === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Key className="h-3 w-3" />
          <span>
            {role.permissionCount}{' '}
            {role.permissionCount === 1 ? 'permissão' : 'permissões'}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          <Eye className="mr-2 h-3 w-3" />
          Ver permissões
        </Button>
        {canUpdate && !role.isSystemDefault && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {canDelete && !role.isSystemDefault && (
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
    </Card>
  )
}
