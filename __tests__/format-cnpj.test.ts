import { describe, it, expect } from 'vitest'
import { formatCNPJ, exibirCNPJ } from '@/lib/format/cnpj'

describe('formatCNPJ (máscara progressiva)', () => {
  it('formata CNPJ completo', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('formata parcialmente enquanto digita', () => {
    expect(formatCNPJ('11')).toBe('11')
    expect(formatCNPJ('11222')).toBe('11.222')
    expect(formatCNPJ('11222333')).toBe('11.222.333')
    expect(formatCNPJ('112223330001')).toBe('11.222.333/0001')
  })

  it('ignora caracteres não numéricos', () => {
    expect(formatCNPJ('11.222.333/0001-81')).toBe('11.222.333/0001-81')
  })

  it('limita a 14 dígitos', () => {
    expect(formatCNPJ('112223330001819999')).toBe('11.222.333/0001-81')
  })
})

describe('exibirCNPJ (exibição de CNPJ armazenado)', () => {
  it('formata 14 dígitos corretamente', () => {
    expect(exibirCNPJ('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('retorna o original se não tiver 14 dígitos', () => {
    expect(exibirCNPJ('123')).toBe('123')
    expect(exibirCNPJ('')).toBe('')
  })

  it('aceita CNPJ já formatado', () => {
    expect(exibirCNPJ('11.222.333/0001-81')).toBe('11.222.333/0001-81')
  })
})
