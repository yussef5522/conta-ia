// Validações puras pra payload de POST /restore-template (Sub-etapa 5.1.E).
// Extraídas em função pura pra testar sem DB.

import { z } from 'zod'
import type { DiffResult } from './template-diff'
import type { CategoryFlat } from './buildTree'

export const restoreSchema = z.object({
  revertEdited: z.array(z.string().cuid()).max(1000),
  removeCustom: z.array(z.string().cuid()).max(1000),
  addMissing: z.array(z.string().min(1)).max(1000),
})

export type RestoreInput = z.infer<typeof restoreSchema>

export interface ValidationError {
  field: 'revertEdited' | 'removeCustom' | 'addMissing'
  id: string
  reason: string
}

// Valida que cada ID/key do payload é coerente com o diff atual
// (server confia em SI mesmo, não no body).
//
// Retorna lista de erros (vazia = válido). Não falha rápido —
// retorna TODOS os problemas encontrados pra UI exibir num só toast.
export function validarRestorePayload(
  payload: RestoreInput,
  diff: DiffResult,
  catsById: Map<string, CategoryFlat & { _count: { transactions: number; children: number } }>,
): ValidationError[] {
  const erros: ValidationError[] = []

  const editedIds = new Set(diff.edited.map((e) => e.category.id))
  const customIds = new Set(diff.custom.map((c) => c.id))
  const missingKeys = new Set(diff.missing.map((m) => m.templateKey))

  // a) revertEdited: deve estar em diff.edited
  for (const id of payload.revertEdited) {
    if (!editedIds.has(id)) {
      erros.push({
        field: 'revertEdited',
        id,
        reason: 'Categoria não está marcada como editada no diff atual',
      })
    }
  }

  // b) removeCustom: deve estar em diff.custom + sem transações + sem filhos
  for (const id of payload.removeCustom) {
    if (!customIds.has(id)) {
      erros.push({
        field: 'removeCustom',
        id,
        reason: 'Categoria não está marcada como custom no diff atual',
      })
      continue
    }
    const cat = catsById.get(id)
    if (!cat) {
      erros.push({
        field: 'removeCustom',
        id,
        reason: 'Categoria não encontrada no banco',
      })
      continue
    }
    if (cat._count.transactions > 0) {
      erros.push({
        field: 'removeCustom',
        id,
        reason: `${cat._count.transactions} transações vinculadas — use Desativar`,
      })
    }
    if (cat._count.children > 0) {
      erros.push({
        field: 'removeCustom',
        id,
        reason: `${cat._count.children} subcategorias — mova ou exclua os filhos primeiro`,
      })
    }
  }

  // c) addMissing: templateKey deve estar em diff.missing
  for (const key of payload.addMissing) {
    if (!missingKeys.has(key)) {
      erros.push({
        field: 'addMissing',
        id: key,
        reason: 'templateKey não está marcado como missing no diff atual',
      })
    }
  }

  return erros
}
