// Sprint 5.0.2.q — SourceBadge label lookup.

import { describe, it, expect } from 'vitest'
import { sourceLabel } from '@/components/pendentes/SourceBadge'

describe('sourceLabel', () => {
  it('CACHE_GLOBAL → Conhecido', () => {
    expect(sourceLabel('CACHE_GLOBAL')).toBe('Conhecido')
  })

  it('BRASIL_API → Receita Federal', () => {
    expect(sourceLabel('BRASIL_API')).toBe('Receita Federal')
  })

  it('KEYWORD_MATCH → Palavra-chave', () => {
    expect(sourceLabel('KEYWORD_MATCH')).toBe('Palavra-chave')
  })

  it('CLAUDE_AI → IA', () => {
    expect(sourceLabel('CLAUDE_AI')).toBe('IA')
  })

  it('VENDOR_MEMORY → Aprendido', () => {
    expect(sourceLabel('VENDOR_MEMORY')).toBe('Aprendido')
  })

  it('SETOR_PATTERN → Padrão setor', () => {
    expect(sourceLabel('SETOR_PATTERN')).toBe('Padrão setor')
  })

  it('PIX_DETECTION → Pix sócio/grupo', () => {
    expect(sourceLabel('PIX_DETECTION')).toBe('Pix sócio/grupo')
  })

  it('SAME_COMPANY_TRANSFER → Transf. interna', () => {
    expect(sourceLabel('SAME_COMPANY_TRANSFER')).toBe('Transf. interna')
  })

  it('RULE_EXACT_NORMALIZED → Regra aprendida', () => {
    expect(sourceLabel('RULE_EXACT_NORMALIZED')).toBe('Regra aprendida')
  })

  it('RULE_CONTAINS → Memória anchor', () => {
    expect(sourceLabel('RULE_CONTAINS')).toBe('Memória anchor')
  })

  it('valor desconhecido → fallback "Outro"', () => {
    expect(sourceLabel('NOPE_XYZ')).toBe('Outro')
  })
})
