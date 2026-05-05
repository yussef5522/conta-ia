// Algoritmo de diff entre categorias atuais da empresa e o template oficial
// do setor. Função pura — testável sem DB. Sub-etapa 5.1.E.
//
// Classifica cada categoria em uma de 4 buckets:
//   - identical: bate 100% com o template (nome, dreGroup, type, parentTemplateKey)
//   - edited:    é do template (templateKey preenchido) mas algo foi editado
//   - custom:    criada pelo usuário (sem templateKey ou template não existe mais)
//   - missing:   está no template mas não na empresa (pra adicionar)

import type { CategoryFlat } from './buildTree'
import type { CategoryTemplateNode } from './templates/_common'
import { getTemplate } from './defaults'
import { generateTemplateKey } from './template-key'

export interface TemplateCategory {
  templateKey: string
  name: string
  type: string
  dreGroup: string
  // Code do template (1.1.01, etc) — usado pra hierarquia interna do template
  code: string
  parentTemplateKey: string | null
  defaultColor: string | null
  defaultIcon: string | null
  defaultCode: string | null
}

export interface DiffEditedItem {
  category: CategoryFlat
  templateOriginal: TemplateCategory
  // Lista de campos diferentes: 'nome' | 'dreGroup' | 'type' | 'parent'
  differences: string[]
}

export interface DiffResult {
  identical: CategoryFlat[]
  edited: DiffEditedItem[]
  custom: CategoryFlat[]
  missing: TemplateCategory[]
}

// Converte um template hierárquico (CategoryTemplateNode[] do _common) em lista
// flat com templateKey resolvido (incluindo parentTemplateKey).
export function templateToFlat(setor: string): TemplateCategory[] {
  const nodes = getTemplate(setor)
  if (!nodes || nodes.length === 0) return []

  // Map code → CategoryTemplateNode pra resolver parent
  const byCode = new Map<string, CategoryTemplateNode>()
  for (const n of nodes) byCode.set(n.code, n)

  const result: TemplateCategory[] = []
  for (const n of nodes) {
    if (!n.dreGroup) continue // pula nós inválidos sem dreGroup
    const templateKey = generateTemplateKey(setor, n.dreGroup, n.name)
    let parentTemplateKey: string | null = null
    if (n.parentCode) {
      const parent = byCode.get(n.parentCode)
      if (parent && parent.dreGroup) {
        parentTemplateKey = generateTemplateKey(setor, parent.dreGroup, parent.name)
      }
    }
    result.push({
      templateKey,
      name: n.name,
      type: n.type,
      dreGroup: n.dreGroup,
      code: n.code,
      parentTemplateKey,
      defaultColor: n.color ?? null,
      defaultIcon: n.icon ?? null,
      defaultCode: n.code ?? null,
    })
  }
  return result
}

// Detecta diferenças entre a categoria atual e seu template original.
// Retorna lista de nomes de campos divergentes (vazia se idêntica).
export function detectDifferences(
  current: CategoryFlat,
  template: TemplateCategory,
  parentTemplateKeyAtual: string | null,
): string[] {
  const diffs: string[] = []
  if (current.name !== template.name) diffs.push('nome')
  if ((current.dreGroup ?? '') !== template.dreGroup) diffs.push('dreGroup')
  if (current.type !== template.type) diffs.push('type')
  if (parentTemplateKeyAtual !== template.parentTemplateKey) diffs.push('parent')
  return diffs
}

// Resolve parentTemplateKey da categoria atual: olha o parent (se existir)
// e retorna seu templateKey. null se raiz.
function resolveParentTemplateKey(
  current: CategoryFlat,
  byId: Map<string, CategoryFlat>,
): string | null {
  if (!current.parentId) return null
  const parent = byId.get(current.parentId)
  return parent?.templateKey ?? null
}

export function computeTemplateDiff(
  currentCategories: CategoryFlat[],
  template: TemplateCategory[],
): DiffResult {
  const result: DiffResult = {
    identical: [],
    edited: [],
    custom: [],
    missing: [],
  }

  // Indexa template por templateKey
  const templateByKey = new Map<string, TemplateCategory>()
  for (const t of template) templateByKey.set(t.templateKey, t)

  // Indexa current por id (pra resolver parentTemplateKey) e por templateKey
  const currentById = new Map<string, CategoryFlat>()
  const currentByTemplateKey = new Map<string, CategoryFlat>()
  for (const c of currentCategories) {
    currentById.set(c.id, c)
    if (c.templateKey) {
      currentByTemplateKey.set(c.templateKey, c)
    }
  }

  // Classifica cada categoria atual
  for (const c of currentCategories) {
    if (!c.templateKey) {
      // Sem templateKey → custom (criada pelo user, ou backfill não cobriu)
      result.custom.push(c)
      continue
    }

    const tpl = templateByKey.get(c.templateKey)
    if (!tpl) {
      // Tinha templateKey mas template não existe mais (template foi removido upstream)
      result.custom.push(c)
      continue
    }

    const parentKey = resolveParentTemplateKey(c, currentById)
    const diffs = detectDifferences(c, tpl, parentKey)
    if (diffs.length === 0) {
      result.identical.push(c)
    } else {
      result.edited.push({ category: c, templateOriginal: tpl, differences: diffs })
    }
  }

  // Detecta missing: template sem correspondência em current
  for (const t of template) {
    if (!currentByTemplateKey.has(t.templateKey)) {
      result.missing.push(t)
    }
  }

  return result
}

export interface DiffSummary {
  identicalCount: number
  editedCount: number
  customCount: number
  missingCount: number
  totalChanges: number
}

export function summarize(diff: DiffResult): DiffSummary {
  return {
    identicalCount: diff.identical.length,
    editedCount: diff.edited.length,
    customCount: diff.custom.length,
    missingCount: diff.missing.length,
    totalChanges: diff.edited.length + diff.custom.length + diff.missing.length,
  }
}
