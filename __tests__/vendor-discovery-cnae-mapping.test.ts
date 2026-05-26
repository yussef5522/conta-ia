// Sprint 5.0.2.n — Mapping CNAE → categoria contábil.

import { describe, it, expect } from 'vitest'
import {
  inferirCategoriaContabilFromCNAE,
  CNAE_CATEGORY_MAP,
} from '@/lib/vendor-discovery/cnae-to-category'

describe('inferirCategoriaContabilFromCNAE — casos principais', () => {
  it('CNAE Software (6201-5/00) → Software/Tecnologia', () => {
    const r = inferirCategoriaContabilFromCNAE('6201500', 'DEBIT')
    expect(r?.categoria).toBe('Software/Tecnologia')
    expect(r?.confidence).toBe(0.95)
  })

  it('CNAE Atacadista de bebidas (4635-4/01) → Fornecedor Bebidas', () => {
    const r = inferirCategoriaContabilFromCNAE('4635401', 'DEBIT')
    expect(r?.categoria).toBe('Fornecedor Bebidas')
  })

  it('CNAE Frigorífico (4634-6/01) → Fornecedor Carnes', () => {
    const r = inferirCategoriaContabilFromCNAE('4634601', 'DEBIT')
    expect(r?.categoria).toBe('Fornecedor Carnes')
  })

  it('CNAE Atacadão (4691-5/00) → Compras Mercadoria', () => {
    const r = inferirCategoriaContabilFromCNAE('4691500', 'DEBIT')
    expect(r?.categoria).toBe('Compras Mercadoria')
  })

  it('CNAE Energia elétrica (3511-5/00) → Energia Elétrica', () => {
    const r = inferirCategoriaContabilFromCNAE('3511500', 'DEBIT')
    expect(r?.categoria).toBe('Energia Elétrica')
  })

  it('CNAE Telecomunicações (6110-8/01) → Telefonia e Internet', () => {
    const r = inferirCategoriaContabilFromCNAE('6110801', 'DEBIT')
    expect(r?.categoria).toBe('Telefonia e Internet')
  })

  it('CNAE Posto combustível (4731-8/00) → Combustível', () => {
    const r = inferirCategoriaContabilFromCNAE('4731800', 'DEBIT')
    expect(r?.categoria).toBe('Combustível')
  })

  it('CNAE Restaurante (5611-2/01) → Refeições/Alimentação', () => {
    const r = inferirCategoriaContabilFromCNAE('5611201', 'DEBIT')
    expect(r?.categoria).toBe('Refeições/Alimentação')
  })

  it('CNAE Correios (5310-5/01) → Frete', () => {
    const r = inferirCategoriaContabilFromCNAE('5310501', 'DEBIT')
    expect(r?.categoria).toBe('Frete')
  })

  it('CNAE Contábil (6920-6/01) → Honorários Contábeis', () => {
    const r = inferirCategoriaContabilFromCNAE('6920601', 'DEBIT')
    expect(r?.categoria).toBe('Honorários Contábeis')
  })

  it('CNAE Jurídico (6911-7/01) → Honorários Jurídicos', () => {
    const r = inferirCategoriaContabilFromCNAE('6911701', 'DEBIT')
    expect(r?.categoria).toBe('Honorários Jurídicos')
  })

  it('CNAE Saúde clínica (8610-1/01) → Saúde/Clínica', () => {
    const r = inferirCategoriaContabilFromCNAE('8610101', 'DEBIT')
    expect(r?.categoria).toBe('Saúde/Clínica')
  })

  it('CNAE Marketing/Publicidade (7311-4/00) → Marketing Digital', () => {
    const r = inferirCategoriaContabilFromCNAE('7311400', 'DEBIT')
    expect(r?.categoria).toBe('Marketing Digital')
  })
})

describe('inferirCategoriaContabilFromCNAE — match por prefixo', () => {
  it('prefixo 4 dígitos tem prioridade sobre 2', () => {
    // 4731 = Combustível, 47 não está no map mas se estivesse, 4731 ganharia
    const r = inferirCategoriaContabilFromCNAE('4731800', 'DEBIT')
    expect(r?.matchedPrefix).toBe('4731')
  })

  it('prefixo 2 dígitos como fallback (Saneamento 36)', () => {
    const r = inferirCategoriaContabilFromCNAE('3699999', 'DEBIT')
    expect(r?.categoria).toBe('Água e Esgoto')
    expect(r?.matchedPrefix).toBe('36')
  })

  it('aceita CNAE com pontuação', () => {
    const r = inferirCategoriaContabilFromCNAE('62.01-5/00', 'DEBIT')
    expect(r?.categoria).toBe('Software/Tecnologia')
  })

  it('aceita CNAE como number', () => {
    const r = inferirCategoriaContabilFromCNAE(6201500, 'DEBIT')
    expect(r?.categoria).toBe('Software/Tecnologia')
  })
})

describe('inferirCategoriaContabilFromCNAE — edge cases', () => {
  it('null → null', () => {
    expect(inferirCategoriaContabilFromCNAE(null, 'DEBIT')).toBeNull()
  })

  it('undefined → null', () => {
    expect(inferirCategoriaContabilFromCNAE(undefined, 'DEBIT')).toBeNull()
  })

  it('string vazia → null', () => {
    expect(inferirCategoriaContabilFromCNAE('', 'DEBIT')).toBeNull()
  })

  it('CNAE desconhecido (00) → null', () => {
    expect(inferirCategoriaContabilFromCNAE('0099999', 'DEBIT')).toBeNull()
  })

  it('1 dígito só → null', () => {
    expect(inferirCategoriaContabilFromCNAE('6', 'DEBIT')).toBeNull()
  })
})

describe('CNAE_CATEGORY_MAP — sanidade', () => {
  it('tem ≥30 mappings', () => {
    expect(CNAE_CATEGORY_MAP.length).toBeGreaterThanOrEqual(30)
  })

  it('cada prefix tem 2-4 dígitos', () => {
    for (const m of CNAE_CATEGORY_MAP) {
      expect(m.cnaePrefix.length).toBeGreaterThanOrEqual(2)
      expect(m.cnaePrefix.length).toBeLessThanOrEqual(4)
    }
  })

  it('todas confidence entre 0.7 e 1.0', () => {
    for (const m of CNAE_CATEGORY_MAP) {
      expect(m.confidence).toBeGreaterThanOrEqual(0.7)
      expect(m.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('prefix são só dígitos', () => {
    for (const m of CNAE_CATEGORY_MAP) {
      expect(/^\d+$/.test(m.cnaePrefix)).toBe(true)
    }
  })
})
