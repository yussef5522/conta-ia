// Sprint 5.0.2.p — Sanidade do mapeamento source → classificationSource
// usado em auto-categorize-all/apply.

import { describe, it, expect } from 'vitest'

// Função copy do route handler (pra evitar importar Next route diretamente
// e arrastar deps de runtime). Mantém em sync se mudar lá.
function sourceToClassificationSource(source: string | null | undefined): string {
  switch (source) {
    case 'SAME_COMPANY_TRANSFER':
      return 'AI'
    case 'PIX_DETECTION':
      return 'AI'
    case 'RULE_EXACT_NORMALIZED':
    case 'RULE_CONTAINS':
      return 'RULE'
    case 'SETOR_PATTERN':
      return 'SETOR_PATTERN'
    default:
      return 'MANUAL'
  }
}

describe('sourceToClassificationSource', () => {
  it('SAME_COMPANY_TRANSFER → AI', () => {
    expect(sourceToClassificationSource('SAME_COMPANY_TRANSFER')).toBe('AI')
  })

  it('PIX_DETECTION → AI', () => {
    expect(sourceToClassificationSource('PIX_DETECTION')).toBe('AI')
  })

  it('RULE_EXACT_NORMALIZED → RULE', () => {
    expect(sourceToClassificationSource('RULE_EXACT_NORMALIZED')).toBe('RULE')
  })

  it('RULE_CONTAINS → RULE', () => {
    expect(sourceToClassificationSource('RULE_CONTAINS')).toBe('RULE')
  })

  it('SETOR_PATTERN → SETOR_PATTERN', () => {
    expect(sourceToClassificationSource('SETOR_PATTERN')).toBe('SETOR_PATTERN')
  })

  it('null → MANUAL', () => {
    expect(sourceToClassificationSource(null)).toBe('MANUAL')
  })

  it('undefined → MANUAL', () => {
    expect(sourceToClassificationSource(undefined)).toBe('MANUAL')
  })

  it('valor desconhecido → MANUAL', () => {
    expect(sourceToClassificationSource('XYZ')).toBe('MANUAL')
  })
})
