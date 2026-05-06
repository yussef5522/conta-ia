// Schema de validação pra criação/edição de role custom (Sub-sub-etapa 5.3.C2).
// Custom roles NÃO usam wildcards — apenas permissions concretas selecionáveis.

import { z } from 'zod'
import { PERMISSIONS } from '@/lib/auth/permissions'

const VALID_PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key))

export const roleCreateSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(50, 'Nome muito longo (max 50 caracteres)')
    .regex(
      /^[a-zA-Z0-9 _\-áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+$/,
      'Nome contém caracteres inválidos',
    ),
  description: z.string().max(200, 'Descrição muito longa').optional().nullable(),
  permissionKeys: z
    .array(z.string())
    .refine(
      (keys) => keys.every((k) => VALID_PERMISSION_KEYS.has(k)),
      { message: 'Uma ou mais permissões não existem no sistema' },
    ),
})

export const roleUpdateSchema = roleCreateSchema.partial({
  permissionKeys: true,
})

export type RoleCreateInput = z.infer<typeof roleCreateSchema>
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>

// Detecta keys inválidas (pra mensagem específica em UI/log).
export function findInvalidPermissionKeys(keys: string[]): string[] {
  return keys.filter((k) => !VALID_PERMISSION_KEYS.has(k))
}

// Calcula diff de permissions (added vs removed) — usado em audit log de UPDATE.
// Resultado vem ordenado pra estabilidade do JSON registrado.
export function diffPermissions(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)

  const added = after.filter((k) => !beforeSet.has(k))
  const removed = before.filter((k) => !afterSet.has(k))

  return { added: added.sort(), removed: removed.sort() }
}
