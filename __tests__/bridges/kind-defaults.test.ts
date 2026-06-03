// Sprint PF Fatia 4 — Testes puros do kind-defaults.

import { describe, expect, test } from 'vitest'
import {
  KIND_DEFAULTS,
  getKindDefaults,
  suggestKindFromSocioPapel,
} from '@/lib/bridges/kind-defaults'
import { BRIDGE_KINDS } from '@/lib/bridges/types'

describe('Kind defaults — 5 tipos', () => {
  test('Tem todos os 5 kinds esperados', () => {
    expect(Object.keys(KIND_DEFAULTS).sort()).toEqual(
      [...BRIDGE_KINDS].sort(),
    )
  })

  test('PRO_LABORE → DESPESAS_PESSOAL + afeta DRE', () => {
    const d = getKindDefaults('PRO_LABORE')
    expect(d.suggestedPjDreGroup).toBe('DESPESAS_PESSOAL')
    expect(d.affectsDre).toBe(true)
    expect(d.suggestedPfCategoryName).toBe('Pró-labore/Lucros')
  })

  test('DISTRIBUICAO → DISTRIBUICAO_LUCROS + NÃO afeta DRE', () => {
    const d = getKindDefaults('DISTRIBUICAO')
    expect(d.suggestedPjDreGroup).toBe('DISTRIBUICAO_LUCROS')
    expect(d.affectsDre).toBe(false)
    expect(d.suggestedPfCategoryName).toBe('Pró-labore/Lucros')
  })

  test('REEMBOLSO → suggestedPjDreGroup=null (força escolha manual)', () => {
    const d = getKindDefaults('REEMBOLSO')
    expect(d.suggestedPjDreGroup).toBeNull()
    expect(d.affectsDre).toBe(true)
    expect(d.suggestedPfCategoryName).toBe('Outros Recebimentos')
  })

  test('ADIANTAMENTO → DISTRIBUICAO_LUCROS por simplicidade + NÃO afeta DRE', () => {
    const d = getKindDefaults('ADIANTAMENTO')
    expect(d.suggestedPjDreGroup).toBe('DISTRIBUICAO_LUCROS')
    expect(d.affectsDre).toBe(false)
  })

  test('RETIRADA_SOCIOS → DISTRIBUICAO_LUCROS + NÃO afeta DRE', () => {
    const d = getKindDefaults('RETIRADA_SOCIOS')
    expect(d.suggestedPjDreGroup).toBe('DISTRIBUICAO_LUCROS')
    expect(d.affectsDre).toBe(false)
  })

  test('Todos os 5 kinds têm description + emoji + label', () => {
    for (const k of BRIDGE_KINDS) {
      const d = getKindDefaults(k)
      expect(d.label).toBeTruthy()
      expect(d.emoji).toBeTruthy()
      expect(d.description).toBeTruthy()
      expect(d.description.length).toBeGreaterThan(20)
    }
  })
})

describe('suggestKindFromSocioPapel', () => {
  test('ADMINISTRADOR → PRO_LABORE', () => {
    expect(suggestKindFromSocioPapel('ADMINISTRADOR')).toBe('PRO_LABORE')
  })
  test('FAMILIAR → PRO_LABORE', () => {
    expect(suggestKindFromSocioPapel('FAMILIAR')).toBe('PRO_LABORE')
  })
  test('SOCIO → DISTRIBUICAO', () => {
    expect(suggestKindFromSocioPapel('SOCIO')).toBe('DISTRIBUICAO')
  })
  test('Papel desconhecido → DISTRIBUICAO (fallback)', () => {
    expect(suggestKindFromSocioPapel('OUTROS')).toBe('DISTRIBUICAO')
    expect(suggestKindFromSocioPapel('')).toBe('DISTRIBUICAO')
  })
})
