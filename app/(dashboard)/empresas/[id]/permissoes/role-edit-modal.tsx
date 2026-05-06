'use client'

import { useState, useMemo } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { PERMISSIONS, type PermissionDef } from '@/lib/auth/permissions'
import type { Role } from './permissoes-client'

interface Props {
  empresaId: string
  role: Role | null // null = criar
  onClose: () => void
  onSaved: () => void
}

export function RoleEditModal({ empresaId, role, onClose, onSaved }: Props) {
  const isEditing = role !== null
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role?.permissionKeys ?? []),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Agrupa PERMISSIONS por grupo
  const grouped = useMemo(() => {
    const map: Record<string, PermissionDef[]> = {}
    for (const p of PERMISSIONS) {
      if (!map[p.group]) map[p.group] = []
      map[p.group].push(p)
    }
    return map
  }, [])

  function togglePermission(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  function toggleGroup(group: string, allSelected: boolean) {
    const next = new Set(selected)
    for (const p of grouped[group]) {
      if (allSelected) next.delete(p.key)
      else next.add(p.key)
    }
    setSelected(next)
  }

  async function handleSubmit() {
    if (!name.trim() || name.trim().length < 2) {
      setError('Nome precisa ter pelo menos 2 caracteres')
      return
    }

    if (selected.size === 0) {
      const ok = confirm(
        'Esta role não terá nenhuma permissão. Usuários atribuídos não poderão fazer nada. Continuar?',
      )
      if (!ok) return
    }

    setIsSaving(true)
    setError(null)

    try {
      const url = isEditing
        ? `/api/empresas/${empresaId}/roles/${role.id}`
        : `/api/empresas/${empresaId}/roles`

      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          permissionKeys: Array.from(selected),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao salvar role')
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Editar role "${role?.name}"` : 'Criar role customizada'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vendedor Loja A"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Descrição (opcional)</Label>
              <Input
                id="role-desc"
                value={description ?? ''}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Acesso a transações da Loja A"
                maxLength={200}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {selected.size} de {PERMISSIONS.length} permissões selecionadas
            </Badge>
          </div>

          <div className="space-y-4 border rounded-lg p-4">
            {Object.entries(grouped).map(([group, perms]) => {
              const allSelected = perms.every((p) => selected.has(p.key))
              const someSelected = perms.some((p) => selected.has(p.key))
              const indeterminate = someSelected && !allSelected
              const selectedCount = perms.filter((p) => selected.has(p.key)).length

              return (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b">
                    <Checkbox
                      checked={allSelected ? true : indeterminate ? 'indeterminate' : false}
                      onCheckedChange={() => toggleGroup(group, allSelected)}
                    />
                    <span className="font-semibold text-sm">{group}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedCount} de {perms.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6">
                    {perms.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1 rounded"
                      >
                        <Checkbox
                          checked={selected.has(p.key)}
                          onCheckedChange={() => togglePermission(p.key)}
                          className="mt-0.5"
                        />
                        <div>
                          <div>{p.name}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
