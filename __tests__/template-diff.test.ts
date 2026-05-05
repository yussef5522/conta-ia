import { describe, it, expect } from 'vitest'
import {
  computeTemplateDiff,
  detectDifferences,
  templateToFlat,
  summarize,
  type TemplateCategory,
} from '../lib/categories/template-diff'
import { generateTemplateKey } from '../lib/categories/template-key'
import type { CategoryFlat } from '../lib/categories/buildTree'

// Helpers pra construir fixtures concisos
function mkCat(overrides: Partial<CategoryFlat> & { id: string; name: string }): CategoryFlat {
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
    isSystemDefault: overrides.isSystemDefault ?? true,
    templateKey: overrides.templateKey ?? null,
    _count: overrides._count ?? { transactions: 0, children: 0 },
  }
}

function mkTpl(overrides: Partial<TemplateCategory> & { templateKey: string; name: string }): TemplateCategory {
  return {
    templateKey: overrides.templateKey,
    name: overrides.name,
    type: overrides.type ?? 'EXPENSE',
    dreGroup: overrides.dreGroup ?? 'DESPESAS_ADMINISTRATIVAS',
    code: overrides.code ?? '1',
    parentTemplateKey: overrides.parentTemplateKey ?? null,
    defaultColor: overrides.defaultColor ?? '#10b981',
    defaultIcon: overrides.defaultIcon ?? null,
    defaultCode: overrides.defaultCode ?? null,
  }
}

describe('templateToFlat', () => {
  it('retorna template (fallback academia) pra setor inválido — getTemplate tem default', () => {
    // getTemplate cai no academiaTemplate como fallback; templateToFlat não falha.
    expect(templateToFlat('setor-inexistente').length).toBeGreaterThan(0)
  })

  it('retorna template do setor real (academia/service)', () => {
    const flat = templateToFlat('service')
    expect(flat.length).toBeGreaterThan(0)
    expect(flat[0]).toHaveProperty('templateKey')
    expect(flat[0]).toHaveProperty('parentTemplateKey')
  })

  it('templateKey é único dentro do template', () => {
    const flat = templateToFlat('restaurant')
    const keys = flat.map((t) => t.templateKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('parentTemplateKey aponta pra template existente', () => {
    const flat = templateToFlat('restaurant')
    const keys = new Set(flat.map((t) => t.templateKey))
    for (const t of flat) {
      if (t.parentTemplateKey) {
        expect(keys.has(t.parentTemplateKey)).toBe(true)
      }
    }
  })
})

describe('detectDifferences', () => {
  const tpl = mkTpl({
    templateKey: 'SERVICE:RECEITA_BRUTA:mensalidades',
    name: 'Mensalidades',
    dreGroup: 'RECEITA_BRUTA',
    type: 'INCOME',
    parentTemplateKey: null,
  })

  it('idêntica → array vazio', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Mensalidades',
      dreGroup: 'RECEITA_BRUTA',
      type: 'INCOME',
      templateKey: tpl.templateKey,
    })
    expect(detectDifferences(cat, tpl, null)).toEqual([])
  })

  it('detecta diff de nome', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Mensalidades editadas',
      dreGroup: 'RECEITA_BRUTA',
      type: 'INCOME',
      templateKey: tpl.templateKey,
    })
    expect(detectDifferences(cat, tpl, null)).toEqual(['nome'])
  })

  it('detecta diff de dreGroup', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Mensalidades',
      dreGroup: 'OUTRAS_RECEITAS',
      type: 'INCOME',
      templateKey: tpl.templateKey,
    })
    expect(detectDifferences(cat, tpl, null)).toEqual(['dreGroup'])
  })

  it('detecta diff de type', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Mensalidades',
      dreGroup: 'RECEITA_BRUTA',
      type: 'EXPENSE',
      templateKey: tpl.templateKey,
    })
    expect(detectDifferences(cat, tpl, null)).toEqual(['type'])
  })

  it('detecta múltiplas diffs simultâneas', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Outro nome',
      dreGroup: 'OUTRAS_RECEITAS',
      type: 'EXPENSE',
      templateKey: tpl.templateKey,
    })
    expect(detectDifferences(cat, tpl, 'algum-parent-key')).toEqual([
      'nome',
      'dreGroup',
      'type',
      'parent',
    ])
  })
})

describe('computeTemplateDiff', () => {
  it('classifica idêntica corretamente', () => {
    const tpl = mkTpl({
      templateKey: 'SERVICE:RECEITA_BRUTA:mensalidades',
      name: 'Mensalidades',
      dreGroup: 'RECEITA_BRUTA',
      type: 'INCOME',
    })
    const cat = mkCat({
      id: 'c1',
      name: 'Mensalidades',
      dreGroup: 'RECEITA_BRUTA',
      type: 'INCOME',
      templateKey: tpl.templateKey,
    })
    const diff = computeTemplateDiff([cat], [tpl])
    expect(diff.identical).toHaveLength(1)
    expect(diff.edited).toHaveLength(0)
    expect(diff.custom).toHaveLength(0)
    expect(diff.missing).toHaveLength(0)
  })

  it('classifica edited (nome diferente)', () => {
    const tpl = mkTpl({
      templateKey: 'SERVICE:DESPESAS_ADMINISTRATIVAS:aluguel',
      name: 'Aluguel',
    })
    const cat = mkCat({
      id: 'c1',
      name: 'Aluguel Matriz',
      templateKey: tpl.templateKey,
    })
    const diff = computeTemplateDiff([cat], [tpl])
    expect(diff.edited).toHaveLength(1)
    expect(diff.edited[0].differences).toContain('nome')
    expect(diff.edited[0].templateOriginal.name).toBe('Aluguel')
  })

  it('classifica custom (sem templateKey)', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Categoria criada pelo user',
      templateKey: null,
      isSystemDefault: false,
    })
    const diff = computeTemplateDiff([cat], [])
    expect(diff.custom).toHaveLength(1)
    expect(diff.identical).toHaveLength(0)
    expect(diff.edited).toHaveLength(0)
  })

  it('classifica custom (templateKey existe mas template não tem mais)', () => {
    const cat = mkCat({
      id: 'c1',
      name: 'Categoria fantasma',
      templateKey: 'SERVICE:RECEITA_BRUTA:categoria_removida_upstream',
    })
    const diff = computeTemplateDiff([cat], []) // template vazio
    expect(diff.custom).toHaveLength(1)
  })

  it('classifica missing (template tem mas empresa não)', () => {
    const tpl = mkTpl({
      templateKey: 'SERVICE:RECEITA_BRUTA:mensalidades',
      name: 'Mensalidades',
    })
    const diff = computeTemplateDiff([], [tpl])
    expect(diff.missing).toHaveLength(1)
    expect(diff.missing[0].templateKey).toBe(tpl.templateKey)
  })

  it('combinação completa: identical + edited + custom + missing', () => {
    const tpl1 = mkTpl({ templateKey: 'k1', name: 'Idêntica' })
    const tpl2 = mkTpl({ templateKey: 'k2', name: 'Original' })
    const tpl3 = mkTpl({ templateKey: 'k3', name: 'Faltando' })
    const cat1 = mkCat({ id: 'c1', name: 'Idêntica', templateKey: 'k1' })
    const cat2 = mkCat({ id: 'c2', name: 'Editada', templateKey: 'k2' })
    const cat3 = mkCat({ id: 'c3', name: 'Custom', templateKey: null })
    const diff = computeTemplateDiff([cat1, cat2, cat3], [tpl1, tpl2, tpl3])
    expect(diff.identical).toHaveLength(1)
    expect(diff.edited).toHaveLength(1)
    expect(diff.custom).toHaveLength(1)
    expect(diff.missing).toHaveLength(1)
    expect(diff.missing[0].name).toBe('Faltando')
  })

  it('detecta parent diferente (categoria movida pelo user)', () => {
    const parentTpl = mkTpl({ templateKey: 'parent-k', name: 'Pai' })
    const childTpl = mkTpl({
      templateKey: 'child-k',
      name: 'Filho',
      parentTemplateKey: 'parent-k',
    })
    const parent = mkCat({ id: 'p1', name: 'Pai', templateKey: 'parent-k' })
    // Filho aparece como raiz (sem parent) — diferente do template
    const child = mkCat({
      id: 'c1',
      name: 'Filho',
      templateKey: 'child-k',
      parentId: null,
    })
    const diff = computeTemplateDiff([parent, child], [parentTpl, childTpl])
    expect(diff.identical).toHaveLength(1) // só o pai
    expect(diff.edited).toHaveLength(1) // filho com parent diferente
    expect(diff.edited[0].differences).toContain('parent')
  })

  it('preserva hierarquia: parent não-template afeta diff de filho', () => {
    const childTpl = mkTpl({
      templateKey: 'child-k',
      name: 'Filho',
      parentTemplateKey: 'parent-k',
    })
    const customParent = mkCat({ id: 'pcustom', name: 'Pai Custom', templateKey: null })
    const child = mkCat({
      id: 'c1',
      name: 'Filho',
      templateKey: 'child-k',
      parentId: 'pcustom',
    })
    const diff = computeTemplateDiff([customParent, child], [childTpl])
    // child tem parent custom → parentTemplateKey resolve null, mas template espera 'parent-k'
    expect(diff.edited).toHaveLength(1)
    expect(diff.edited[0].differences).toContain('parent')
  })

  it('empresa vazia → tudo é missing', () => {
    const tpls = [
      mkTpl({ templateKey: 'k1', name: 'A' }),
      mkTpl({ templateKey: 'k2', name: 'B' }),
      mkTpl({ templateKey: 'k3', name: 'C' }),
    ]
    const diff = computeTemplateDiff([], tpls)
    expect(diff.missing).toHaveLength(3)
    expect(diff.identical).toHaveLength(0)
  })

  it('template vazio → tudo é custom', () => {
    const cats = [
      mkCat({ id: '1', name: 'A', templateKey: null }),
      mkCat({ id: '2', name: 'B', templateKey: null }),
    ]
    const diff = computeTemplateDiff(cats, [])
    expect(diff.custom).toHaveLength(2)
    expect(diff.missing).toHaveLength(0)
  })

  it('determinístico: mesma entrada → mesmo diff', () => {
    const tpl = mkTpl({ templateKey: 'k1', name: 'A' })
    const cat = mkCat({ id: 'c1', name: 'A editada', templateKey: 'k1' })
    const a = computeTemplateDiff([cat], [tpl])
    const b = computeTemplateDiff([cat], [tpl])
    expect(a.edited.length).toBe(b.edited.length)
    expect(a.edited[0].differences).toEqual(b.edited[0].differences)
  })
})

describe('templateKey integração com generateTemplateKey', () => {
  it('templateToFlat usa generateTemplateKey corretamente', () => {
    const flat = templateToFlat('service')
    if (flat.length === 0) return
    const primeiro = flat[0]
    const esperada = generateTemplateKey('service', primeiro.dreGroup, primeiro.name)
    expect(primeiro.templateKey).toBe(esperada)
  })
})

describe('summarize', () => {
  it('totalChanges = edited + custom + missing (não conta identical)', () => {
    const summary = summarize({
      identical: [mkCat({ id: '1', name: 'i1' })],
      edited: [
        {
          category: mkCat({ id: '2', name: 'e1' }),
          templateOriginal: mkTpl({ templateKey: 'k', name: 'k' }),
          differences: ['nome'],
        },
      ],
      custom: [mkCat({ id: '3', name: 'c1' })],
      missing: [mkTpl({ templateKey: 'k2', name: 'm1' })],
    })
    expect(summary.identicalCount).toBe(1)
    expect(summary.editedCount).toBe(1)
    expect(summary.customCount).toBe(1)
    expect(summary.missingCount).toBe(1)
    expect(summary.totalChanges).toBe(3) // 1 edited + 1 custom + 1 missing
  })

  it('diff vazio → 0 em tudo', () => {
    const summary = summarize({ identical: [], edited: [], custom: [], missing: [] })
    expect(summary.totalChanges).toBe(0)
  })
})
