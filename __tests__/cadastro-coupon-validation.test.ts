// Sprint 1.7 — cadastroSchema aceita couponCode opcional.

import { describe, it, expect } from 'vitest'
import { cadastroSchema } from '@/lib/validations/auth'

const baseValid = {
  name: 'Yussef Musa',
  email: 'yussef@example.com',
  password: 'Senha123',
  confirmPassword: 'Senha123',
}

describe('cadastroSchema com couponCode', () => {
  it('aceita cadastro sem cupom', () => {
    const r = cadastroSchema.safeParse(baseValid)
    expect(r.success).toBe(true)
  })

  it('aceita cadastro com cupom válido', () => {
    const r = cadastroSchema.safeParse({
      ...baseValid,
      couponCode: 'FUNDADOR100',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.couponCode).toBe('FUNDADOR100')
  })

  it('normaliza couponCode pra UPPERCASE + trim', () => {
    const r = cadastroSchema.safeParse({
      ...baseValid,
      couponCode: '  fundador100 ',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.couponCode).toBe('FUNDADOR100')
  })

  it('rejeita couponCode > 20 chars', () => {
    const r = cadastroSchema.safeParse({
      ...baseValid,
      couponCode: 'A'.repeat(25),
    })
    expect(r.success).toBe(false)
  })

  it('aceita couponCode vazio (string vazia tratada como ausência)', () => {
    const r = cadastroSchema.safeParse({
      ...baseValid,
      couponCode: '',
    })
    // Zod aceita string vazia em optional. Endpoint checa "data.couponCode" truthy.
    expect(r.success).toBe(true)
  })

  it('senhas precisam coincidir mesmo com cupom', () => {
    const r = cadastroSchema.safeParse({
      ...baseValid,
      password: 'Senha123',
      confirmPassword: 'Diferente1',
      couponCode: 'FUNDADOR100',
    })
    expect(r.success).toBe(false)
  })
})
