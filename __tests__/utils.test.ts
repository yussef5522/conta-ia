import { describe, it, expect } from 'vitest'
import { formatCNPJ, formatPhone, formatCEP } from '@/lib/utils'

describe('formatCNPJ', () => {
  it('formata CNPJ completo', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('formata parcialmente enquanto digita', () => {
    expect(formatCNPJ('11')).toBe('11')
    expect(formatCNPJ('11222')).toBe('11.222')
    expect(formatCNPJ('11222333')).toBe('11.222.333')
  })

  it('ignora caracteres não numéricos', () => {
    expect(formatCNPJ('11.222.333/0001-81')).toBe('11.222.333/0001-81')
  })
})

describe('formatPhone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatPhone('11999999999')).toBe('(11) 99999-9999')
  })

  it('formata telefone fixo com 10 dígitos', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
  })
})

describe('formatCEP', () => {
  it('formata CEP completo', () => {
    expect(formatCEP('01310100')).toBe('01310-100')
  })
})
