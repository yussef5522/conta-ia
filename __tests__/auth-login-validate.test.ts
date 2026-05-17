// Validação do form de login — Sprint 1.2.
// PURO: sem React/JSDom.

import { describe, it, expect } from 'vitest'
import {
  validateLoginForm,
  isLoginFormValid,
  PASSWORD_MIN_LENGTH,
} from '@/lib/auth/validate-login'

describe('validateLoginForm — email', () => {
  it('rejeita email vazio', () => {
    const errors = validateLoginForm({ email: '', password: 'abcdef' })
    expect(errors.email).toBe('Informe seu e-mail')
  })

  it('rejeita email só com espaços', () => {
    const errors = validateLoginForm({ email: '   ', password: 'abcdef' })
    expect(errors.email).toBe('Informe seu e-mail')
  })

  it('rejeita email sem @', () => {
    const errors = validateLoginForm({
      email: 'naoTemArroba.com',
      password: 'abcdef',
    })
    expect(errors.email).toBe('E-mail inválido')
  })

  it('rejeita email sem domínio', () => {
    const errors = validateLoginForm({
      email: 'user@',
      password: 'abcdef',
    })
    expect(errors.email).toBe('E-mail inválido')
  })

  it('aceita email válido', () => {
    const errors = validateLoginForm({
      email: 'admin@contaia.com.br',
      password: 'abcdef',
    })
    expect(errors.email).toBeUndefined()
  })

  it('aceita email com espaços nas bordas (trim interno)', () => {
    const errors = validateLoginForm({
      email: '  admin@contaia.com.br  ',
      password: 'abcdef',
    })
    expect(errors.email).toBeUndefined()
  })
})

describe('validateLoginForm — senha', () => {
  it('rejeita senha vazia', () => {
    const errors = validateLoginForm({
      email: 'a@b.com',
      password: '',
    })
    expect(errors.password).toBe('Informe sua senha')
  })

  it('rejeita senha < 6 caracteres', () => {
    const errors = validateLoginForm({
      email: 'a@b.com',
      password: 'abc',
    })
    expect(errors.password).toBe(
      `Senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`,
    )
  })

  it('aceita senha exatamente com 6 caracteres', () => {
    const errors = validateLoginForm({
      email: 'a@b.com',
      password: 'abcdef',
    })
    expect(errors.password).toBeUndefined()
  })

  it('PASSWORD_MIN_LENGTH = 6', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6)
  })
})

describe('isLoginFormValid', () => {
  it('true quando email + senha válidos', () => {
    expect(
      isLoginFormValid({ email: 'a@b.com', password: 'abcdef' }),
    ).toBe(true)
  })

  it('false quando email inválido', () => {
    expect(
      isLoginFormValid({ email: 'bad', password: 'abcdef' }),
    ).toBe(false)
  })

  it('false quando senha curta', () => {
    expect(
      isLoginFormValid({ email: 'a@b.com', password: '123' }),
    ).toBe(false)
  })
})
