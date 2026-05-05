import { describe, it, expect } from 'vitest'
import {
  restoreSchema,
  validarRestorePayload,
  type RestoreInput,
} from '../lib/categories/restore-validation'
import type { DiffResult, TemplateCategory } from '../lib/categories/template-diff'
import type { CategoryFlat } from '../lib/categories/buildTree'

// Helpers
function mkCat(
  overrides: Partial<CategoryFlat> & { id: string; name: string },
): CategoryFlat & { _count: { transactions: number; children: number } } {
  return {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type ?? 'EXPENSE',
    parentId: overrides.parentId ?? null,
    dreGroup: overrides.dreGroup ?? 'DESPESAS_ADMINISTRATIVAS',
    code: overrides.code ?? null,
    description: overrides.description ?? null,
    color: overrides.color ?? '#10b981',
    icon: overrides.icon ?? null,
    order: overrides.order ?? 1,
    visibleInRegimes: overrides.visibleInRegimes ?? null,
    isActive: overrides.isActive ?? true,
    isSystemDefault: overrides.isSystemDefault ?? false,
    templateKey: overrides.templateKey ?? null,
    _count: { transactions: 0, children: 0, ...(overrides._count as object) },
  } as CategoryFlat & { _count: { transactions: number; children: number } }
}

function mkTpl(over: Partial<TemplateCategory> & { templateKey: string; name: string }): TemplateCategory {
  return {
    templateKey: over.templateKey,
    name: over.name,
    type: over.type ?? 'EXPENSE',
    dreGroup: over.dreGroup ?? 'DESPESAS_ADMINISTRATIVAS',
    code: over.code ?? '1',
    parentTemplateKey: over.parentTemplateKey ?? null,
    defaultColor: over.defaultColor ?? '#10b981',
    defaultIcon: over.defaultIcon ?? null,
    defaultCode: over.defaultCode ?? null,
  }
}

const CUID_VALIDO_1 = 'clz000000000000000000001'
const CUID_VALIDO_2 = 'clz000000000000000000002'
const CUID_VALIDO_3 = 'clz000000000000000000003'

describe('restoreSchema (Zod)', () => {
  it('aceita payload vazio (3 arrays vazios)', () => {
    const r = restoreSchema.safeParse({
      revertEdited: [],
      removeCustom: [],
      addMissing: [],
    })
    expect(r.success).toBe(true)
  })

  it('aceita CUIDs válidos em revertEdited/removeCustom', () => {
    const r = restoreSchema.safeParse({
      revertEdited: [CUID_VALIDO_1],
      removeCustom: [CUID_VALIDO_2],
      addMissing: ['SETOR:DRE:slug'],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita CUID inválido em revertEdited', () => {
    const r = restoreSchema.safeParse({
      revertEdited: ['not-a-cuid'],
      removeCustom: [],
      addMissing: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita addMissing com string vazia', () => {
    const r = restoreSchema.safeParse({
      revertEdited: [],
      removeCustom: [],
      addMissing: [''],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita arrays com mais de 1000 itens', () => {
    const muitos = Array(1001).fill(CUID_VALIDO_1)
    const r = restoreSchema.safeParse({
      revertEdited: muitos,
      removeCustom: [],
      addMissing: [],
    })
    expect(r.success).toBe(false)
  })
})

describe('validarRestorePayload', () => {
  it('payload vazio + diff vazio → sem erros', () => {
    const diff: DiffResult = { identical: [], edited: [], custom: [], missing: [] }
    const erros = validarRestorePayload(
      { revertEdited: [], removeCustom: [], addMissing: [] },
      diff,
      new Map(),
    )
    expect(erros).toEqual([])
  })

  it('revertEdited com ID que NÃO está em diff.edited → erro', () => {
    const cat = mkCat({ id: CUID_VALIDO_1, name: 'A' })
    const diff: DiffResult = {
      identical: [cat],
      edited: [], // Vazio — id_1 não pode ser revertido
      custom: [],
      missing: [],
    }
    const catsById = new Map([[CUID_VALIDO_1, cat]])
    const erros = validarRestorePayload(
      { revertEdited: [CUID_VALIDO_1], removeCustom: [], addMissing: [] },
      diff,
      catsById,
    )
    expect(erros).toHaveLength(1)
    expect(erros[0].field).toBe('revertEdited')
    expect(erros[0].id).toBe(CUID_VALIDO_1)
  })

  it('removeCustom com transações → erro', () => {
    const cat = mkCat({
      id: CUID_VALIDO_1,
      name: 'Custom',
      _count: { transactions: 5, children: 0 },
    })
    const diff: DiffResult = {
      identical: [],
      edited: [],
      custom: [cat],
      missing: [],
    }
    const catsById = new Map([[CUID_VALIDO_1, cat]])
    const erros = validarRestorePayload(
      { revertEdited: [], removeCustom: [CUID_VALIDO_1], addMissing: [] },
      diff,
      catsById,
    )
    expect(erros.length).toBeGreaterThan(0)
    expect(erros[0].reason).toMatch(/transa/i)
  })

  it('removeCustom com filhos → erro', () => {
    const cat = mkCat({
      id: CUID_VALIDO_1,
      name: 'Custom Pai',
      _count: { transactions: 0, children: 2 },
    })
    const diff: DiffResult = {
      identical: [],
      edited: [],
      custom: [cat],
      missing: [],
    }
    const catsById = new Map([[CUID_VALIDO_1, cat]])
    const erros = validarRestorePayload(
      { revertEdited: [], removeCustom: [CUID_VALIDO_1], addMissing: [] },
      diff,
      catsById,
    )
    expect(erros.length).toBeGreaterThan(0)
    expect(erros[0].reason).toMatch(/subcateg|filho/i)
  })

  it('removeCustom com transações E filhos → 2 erros', () => {
    const cat = mkCat({
      id: CUID_VALIDO_1,
      name: 'Bloqueada',
      _count: { transactions: 3, children: 4 },
    })
    const diff: DiffResult = {
      identical: [],
      edited: [],
      custom: [cat],
      missing: [],
    }
    const catsById = new Map([[CUID_VALIDO_1, cat]])
    const erros = validarRestorePayload(
      { revertEdited: [], removeCustom: [CUID_VALIDO_1], addMissing: [] },
      diff,
      catsById,
    )
    expect(erros).toHaveLength(2)
  })

  it('removeCustom com ID que não está em diff.custom → erro', () => {
    const cat = mkCat({ id: CUID_VALIDO_1, name: 'A' })
    const diff: DiffResult = {
      identical: [cat],
      edited: [],
      custom: [], // Vazio
      missing: [],
    }
    const catsById = new Map([[CUID_VALIDO_1, cat]])
    const erros = validarRestorePayload(
      { revertEdited: [], removeCustom: [CUID_VALIDO_1], addMissing: [] },
      diff,
      catsById,
    )
    expect(erros).toHaveLength(1)
    expect(erros[0].field).toBe('removeCustom')
    expect(erros[0].reason).toMatch(/custom/i)
  })

  it('addMissing com key que NÃO está em diff.missing → erro', () => {
    const diff: DiffResult = {
      identical: [],
      edited: [],
      custom: [],
      missing: [mkTpl({ templateKey: 'k1', name: 'X' })],
    }
    const erros = validarRestorePayload(
      {
        revertEdited: [],
        removeCustom: [],
        addMissing: ['k-inexistente'],
      },
      diff,
      new Map(),
    )
    expect(erros).toHaveLength(1)
    expect(erros[0].field).toBe('addMissing')
    expect(erros[0].id).toBe('k-inexistente')
  })

  it('payload válido completo → sem erros', () => {
    const editedCat = mkCat({ id: CUID_VALIDO_1, name: 'Editada', templateKey: 'k1' })
    const customCat = mkCat({
      id: CUID_VALIDO_2,
      name: 'Custom',
      _count: { transactions: 0, children: 0 },
    })
    const missingTpl = mkTpl({ templateKey: 'k3', name: 'Faltando' })
    const editedTpl = mkTpl({ templateKey: 'k1', name: 'Original' })

    const diff: DiffResult = {
      identical: [],
      edited: [{ category: editedCat, templateOriginal: editedTpl, differences: ['nome'] }],
      custom: [customCat],
      missing: [missingTpl],
    }
    const catsById = new Map([
      [CUID_VALIDO_1, editedCat],
      [CUID_VALIDO_2, customCat],
    ])

    const payload: RestoreInput = {
      revertEdited: [CUID_VALIDO_1],
      removeCustom: [CUID_VALIDO_2],
      addMissing: ['k3'],
    }
    const erros = validarRestorePayload(payload, diff, catsById)
    expect(erros).toEqual([])
  })

  it('retorna múltiplos erros (não falha rápido)', () => {
    const diff: DiffResult = {
      identical: [],
      edited: [],
      custom: [],
      missing: [],
    }
    const erros = validarRestorePayload(
      {
        revertEdited: [CUID_VALIDO_1],
        removeCustom: [CUID_VALIDO_2],
        addMissing: ['k1', 'k2'],
      },
      diff,
      new Map(),
    )
    // 1 revertEdited + 1 removeCustom + 2 addMissing = 4 erros
    expect(erros.length).toBeGreaterThanOrEqual(4)
  })

  it('removeCustom com cat não encontrada no Map → erro específico', () => {
    const cat = mkCat({ id: CUID_VALIDO_1, name: 'A' })
    const diff: DiffResult = {
      identical: [],
      edited: [],
      custom: [cat],
      missing: [],
    }
    // Map vazio — categoria foi excluída entre o load e a validação
    const erros = validarRestorePayload(
      { revertEdited: [], removeCustom: [CUID_VALIDO_1], addMissing: [] },
      diff,
      new Map(),
    )
    expect(erros).toHaveLength(1)
    expect(erros[0].reason).toMatch(/não encontrada/i)
  })
})
