'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PERMISSIONS, permissionMatches, type PermissionDef } from '@/lib/auth/permissions'
import type { Role } from './permissoes-client'

interface Props {
  role: Role
  onClose: () => void
}

export function RoleViewModal({ role, onClose }: Props) {
  const grouped = useMemo(() => {
    const map: Record<string, PermissionDef[]> = {}
    for (const p of PERMISSIONS) {
      if (!map[p.group]) map[p.group] = []
      map[p.group].push(p)
    }
    return map
  }, [])

  // Suporta wildcards das system defaults (OWNER tem '*', VIEWER tem '*.view')
  function hasPermission(key: string): boolean {
    return permissionMatches(role.permissionKeys, key)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>
              {role.isSystemDefault ? '🛡️' : '🎨'} {role.name}
            </span>
            {role.isSystemDefault && (
              <Badge variant="outline" className="text-xs">
                Sistema
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {role.description && (
            <p className="text-sm text-muted-foreground">{role.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{role.userCount} usuários</Badge>
            <Badge variant="secondary">{role.permissionCount} permissões</Badge>
          </div>

          {role.isSystemDefault && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-3 text-xs">
              💡 Esta é uma role do sistema. Não pode ser editada nem excluída. Se precisar
              de combinação diferente, crie uma role customizada.
            </div>
          )}

          <div className="space-y-4 border rounded-lg p-4">
            {Object.entries(grouped).map(([group, perms]) => {
              const granted = perms.filter((p) => hasPermission(p.key))
              const grantedCount = granted.length

              return (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b">
                    <span className="font-semibold text-sm">{group}</span>
                    <Badge
                      variant={grantedCount === perms.length ? 'default' : 'outline'}
                      className="text-xs"
                    >
                      {grantedCount} de {perms.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pl-2">
                    {perms.map((p) => {
                      const has = hasPermission(p.key)
                      return (
                        <div
                          key={p.key}
                          className={`flex items-start gap-2 text-sm p-1 ${
                            has ? '' : 'opacity-40'
                          }`}
                        >
                          <span>{has ? '✅' : '⚪'}</span>
                          <span>{p.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
