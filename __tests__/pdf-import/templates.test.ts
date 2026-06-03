// Sprint PF Fatia 3.5 — Templates.

import { describe, expect, test } from 'vitest'
import {
  detectBankFromFileName,
  getTemplate,
  TEMPLATES,
  type BankHint,
} from '@/lib/pdf-import/pdf-templates'

describe('detectBankFromFileName', () => {
  test('Nubank no nome → NUBANK', () => {
    expect(detectBankFromFileName('Fatura_Nubank_2026_05.pdf')).toBe('NUBANK')
    expect(detectBankFromFileName('nubank-mai.pdf')).toBe('NUBANK')
  })
  test('Itaú', () => {
    expect(detectBankFromFileName('itau_fatura.pdf')).toBe('ITAU')
    expect(detectBankFromFileName('itaú_personalite.pdf')).toBe('ITAU')
  })
  test('Bradesco', () => {
    expect(detectBankFromFileName('bradesco_05_2026.pdf')).toBe('BRADESCO')
  })
  test('Inter', () => {
    expect(detectBankFromFileName('inter_fatura.pdf')).toBe('INTER')
  })
  test('C6', () => {
    expect(detectBankFromFileName('c6_bank_fatura.pdf')).toBe('C6')
  })
  test('Desconhecido → GENERIC', () => {
    expect(detectBankFromFileName('fatura_05_2026.pdf')).toBe('GENERIC')
    expect(detectBankFromFileName('document.pdf')).toBe('GENERIC')
  })
})

describe('TEMPLATES catalog', () => {
  test('todos os 6 templates existem', () => {
    const banks: BankHint[] = ['NUBANK', 'ITAU', 'BRADESCO', 'INTER', 'C6', 'GENERIC']
    for (const b of banks) {
      expect(TEMPLATES[b]).toBeTruthy()
      expect(TEMPLATES[b].length).toBeGreaterThan(100)
    }
  })

  test('templates específicos referenciam GENERIC_PROMPT (herdam regras)', () => {
    for (const b of ['NUBANK', 'ITAU', 'BRADESCO', 'INTER', 'C6'] as BankHint[]) {
      const t = TEMPLATES[b]
      // Genérico tem "NUNCA invente"; específico deve herdar
      expect(t).toMatch(/NUNCA invente/i)
    }
  })

  test('NUBANK template menciona compra internacional 3 linhas', () => {
    expect(TEMPLATES.NUBANK).toMatch(/INTERNACIONA/i)
    expect(TEMPLATES.NUBANK).toMatch(/parcela/i)
  })

  test('getTemplate retorna o template correto', () => {
    expect(getTemplate('NUBANK')).toBe(TEMPLATES.NUBANK)
    expect(getTemplate('GENERIC')).toBe(TEMPLATES.GENERIC)
  })
})
