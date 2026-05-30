// Sprint Export CSV+PDF (29/05/2026) — Testes format helpers.

import { describe, it, expect } from 'vitest'
import {
  formatBRLForCsv,
  formatDateForCsv,
  slugForFilename,
  exportFilename,
} from '@/lib/export/csv/format'

describe('formatBRLForCsv', () => {
  it('formata número com vírgula decimal e ponto milhar', () => {
    expect(formatBRLForCsv(1234.56)).toBe('1.234,56')
  })

  it('formata zero', () => {
    expect(formatBRLForCsv(0)).toBe('0,00')
  })

  it('negativo preserva sinal', () => {
    expect(formatBRLForCsv(-99.5)).toMatch(/-99,50/)
  })

  it('valor grande com milhar e milhão', () => {
    expect(formatBRLForCsv(1_234_567.89)).toBe('1.234.567,89')
  })

  it('arredonda pra 2 casas', () => {
    expect(formatBRLForCsv(0.005)).toMatch(/0,0[01]/) // banker's rounding flutuante OK
    expect(formatBRLForCsv(99.999)).toBe('100,00')
  })
})

describe('formatDateForCsv', () => {
  it('Date → DD/MM/YYYY em pt-BR (SP timezone)', () => {
    const d = new Date('2026-01-15T12:00:00Z')
    expect(formatDateForCsv(d)).toBe('15/01/2026')
  })

  it('ISO string aceito', () => {
    expect(formatDateForCsv('2026-12-31T12:00:00Z')).toBe('31/12/2026')
  })
})

describe('slugForFilename', () => {
  it('remove acentos', () => {
    expect(slugForFilename('Profit São Borja')).toBe('profit-sao-borja')
  })

  it('hifeniza espaços e caracteres especiais', () => {
    expect(slugForFilename('Empresa & Filhos Ltda.')).toBe('empresa-filhos-ltda')
  })

  it('respeita maxLen', () => {
    const long = 'A'.repeat(100)
    expect(slugForFilename(long, 10)).toBe('a'.repeat(10))
  })

  it('string vazia → fallback "export"', () => {
    expect(slugForFilename('')).toBe('export')
    expect(slugForFilename('!!!')).toBe('export')
  })

  it('preserva números', () => {
    expect(slugForFilename('Loja 2026')).toBe('loja-2026')
  })
})

describe('exportFilename', () => {
  it('monta padrão base-slug-YYYY-MM-DD.ext', () => {
    const d = new Date('2026-05-29T12:00:00Z')
    expect(exportFilename('comparativo', 'Profit São Borja', 'csv', d)).toBe(
      'comparativo-profit-sao-borja-2026-05-29.csv',
    )
  })

  it('PDF extension', () => {
    const d = new Date('2026-01-01T12:00:00Z')
    expect(exportFilename('dre', 'Acme', 'pdf', d)).toBe('dre-acme-2026-01-01.pdf')
  })

  it('nome de empresa null → usa fallback "export" como slug', () => {
    const d = new Date('2026-05-29T12:00:00Z')
    const f = exportFilename('dre', null, 'csv', d)
    expect(f).toBe('dre-export-2026-05-29.csv')
  })

  it('nome vazio → fallback "export"', () => {
    const d = new Date('2026-05-29T12:00:00Z')
    expect(exportFilename('dre', '', 'csv', d)).toBe('dre-export-2026-05-29.csv')
  })
})
