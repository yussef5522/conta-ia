// CNAE → categoria hint — Fase 3 Etapa 2.

import { describe, it, expect } from 'vitest'
import { mapCNAEtoCategoryHint } from '@/lib/ai-categorizer/cnae-mapping'

describe('mapCNAEtoCategoryHint — top setores BR', () => {
  it('CNAE 61 (telecom) → Telefonia / DESPESAS_ADMINISTRATIVAS', () => {
    const h = mapCNAEtoCategoryHint('6110-8/01')
    expect(h?.categoryNameHint).toBe('Telefonia')
    expect(h?.dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
  })

  it('CNAE 35 (energia) → Energia Elétrica', () => {
    expect(mapCNAEtoCategoryHint(3514)?.categoryNameHint).toBe(
      'Energia Elétrica',
    )
  })

  it('CNAE 64 (instituição financeira) → Tarifas Bancárias / DESPESAS_FINANCEIRAS', () => {
    const h = mapCNAEtoCategoryHint('6422-1/00')
    expect(h?.categoryNameHint).toBe('Tarifas Bancárias')
    expect(h?.dreGroup).toBe('DESPESAS_FINANCEIRAS')
  })

  it('CNAE 65 (seguros) → Seguros', () => {
    expect(mapCNAEtoCategoryHint('6511-1/01')?.categoryNameHint).toBe('Seguros')
  })

  it('CNAE 68 (imobiliário) → Aluguel', () => {
    expect(mapCNAEtoCategoryHint('6810-2/02')?.categoryNameHint).toBe('Aluguel')
  })

  it('CNAE 4731 (combustível varejo) — prefixo 4 dígitos ganha de 47', () => {
    const h = mapCNAEtoCategoryHint('4731-8/00')
    expect(h?.categoryNameHint).toBe('Combustível')
    expect(h?.setor).toBe('Combustíveis')
  })

  it('CNAE 47 genérico (varejo) → Fornecedores quando não casa 4731', () => {
    const h = mapCNAEtoCategoryHint('4711-3/02')
    expect(h?.categoryNameHint).toBe('Fornecedores')
  })

  it('CNAE não mapeado → null (deixa Camada 3 / manual classificar)', () => {
    expect(mapCNAEtoCategoryHint('9999-9/99')).toBeNull()
    expect(mapCNAEtoCategoryHint('0000-0/00')).toBeNull()
  })

  it('null/undefined/string vazia → null', () => {
    expect(mapCNAEtoCategoryHint(null)).toBeNull()
    expect(mapCNAEtoCategoryHint(undefined)).toBeNull()
    expect(mapCNAEtoCategoryHint('')).toBeNull()
  })

  it('aceita número direto (BrasilAPI retorna number ou string)', () => {
    expect(mapCNAEtoCategoryHint(6110801)?.categoryNameHint).toBe('Telefonia')
    expect(mapCNAEtoCategoryHint('6110801')?.categoryNameHint).toBe('Telefonia')
  })
})
