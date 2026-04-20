import { describe, it, expect } from 'vitest'
import { loginSchema, cadastroSchema } from '@/lib/validations/auth'

describe('loginSchema', () => {
  it('aceita dados válidos', () => {
    const result = loginSchema.safeParse({ email: 'teste@email.com', password: 'senha123' })
    expect(result.success).toBe(true)
  })

  it('rejeita e-mail inválido', () => {
    const result = loginSchema.safeParse({ email: 'nao-e-email', password: 'senha123' })
    expect(result.success).toBe(false)
  })

  it('rejeita senha vazia', () => {
    const result = loginSchema.safeParse({ email: 'teste@email.com', password: '' })
    expect(result.success).toBe(false)
  })

  it('normaliza e-mail para minúsculo', () => {
    const result = loginSchema.safeParse({ email: 'TESTE@EMAIL.COM', password: 'senha' })
    if (result.success) {
      expect(result.data.email).toBe('teste@email.com')
    }
  })
})

describe('cadastroSchema', () => {
  const dadosValidos = {
    name: 'João Silva',
    email: 'joao@email.com',
    password: 'Senha123',
    confirmPassword: 'Senha123',
  }

  it('aceita dados válidos', () => {
    const result = cadastroSchema.safeParse(dadosValidos)
    expect(result.success).toBe(true)
  })

  it('rejeita nome muito curto', () => {
    const result = cadastroSchema.safeParse({ ...dadosValidos, name: 'J' })
    expect(result.success).toBe(false)
  })

  it('rejeita senha fraca (sem maiúscula)', () => {
    const result = cadastroSchema.safeParse({ ...dadosValidos, password: 'senha123', confirmPassword: 'senha123' })
    expect(result.success).toBe(false)
  })

  it('rejeita senha fraca (sem número)', () => {
    const result = cadastroSchema.safeParse({ ...dadosValidos, password: 'SenhaSemNumero', confirmPassword: 'SenhaSemNumero' })
    expect(result.success).toBe(false)
  })

  it('rejeita quando senhas não coincidem', () => {
    const result = cadastroSchema.safeParse({ ...dadosValidos, confirmPassword: 'Diferente1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const erros = result.error.flatten().fieldErrors
      expect(erros.confirmPassword).toBeDefined()
    }
  })
})
