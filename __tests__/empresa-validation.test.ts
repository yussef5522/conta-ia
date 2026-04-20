import { describe, it, expect } from 'vitest'
import { empresaSchema } from '@/lib/validations/empresa'

const dadosValidos = {
  cnpj: '11222333000181',
  name: 'Empresa Teste Ltda',
  tradeName: 'Empresa Teste',
  type: 'SERVICE' as const,
  taxRegime: 'SIMPLES_NACIONAL' as const,
  email: 'contato@empresa.com',
  phone: '11999999999',
  address: 'Rua Teste, 123',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01310100',
}

describe('empresaSchema', () => {
  it('aceita dados válidos', () => {
    const result = empresaSchema.safeParse(dadosValidos)
    expect(result.success).toBe(true)
  })

  it('rejeita CNPJ inválido', () => {
    const result = empresaSchema.safeParse({ ...dadosValidos, cnpj: '11111111111111' })
    expect(result.success).toBe(false)
  })

  it('rejeita CNPJ com todos dígitos iguais', () => {
    const result = empresaSchema.safeParse({ ...dadosValidos, cnpj: '00000000000000' })
    expect(result.success).toBe(false)
  })

  it('rejeita razão social vazia', () => {
    const result = empresaSchema.safeParse({ ...dadosValidos, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejeita tipo de empresa inválido', () => {
    const result = empresaSchema.safeParse({ ...dadosValidos, type: 'TIPO_INVALIDO' })
    expect(result.success).toBe(false)
  })

  it('aceita campos opcionais vazios', () => {
    const result = empresaSchema.safeParse({
      ...dadosValidos,
      tradeName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita e-mail inválido quando preenchido', () => {
    const result = empresaSchema.safeParse({ ...dadosValidos, email: 'nao-e-email' })
    expect(result.success).toBe(false)
  })
})
