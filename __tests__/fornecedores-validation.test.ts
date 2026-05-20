// Sprint 2.2 — schemas Zod de fornecedores.

import { describe, it, expect } from 'vitest'
import {
  createFornecedorSchema,
  updateFornecedorSchema,
  listFornecedoresQuerySchema,
} from '@/lib/validations/fornecedor'

describe('createFornecedorSchema', () => {
  it('aceita razaoSocial só', () => {
    const r = createFornecedorSchema.safeParse({
      razaoSocial: 'Padaria do Zé',
    })
    expect(r.success).toBe(true)
  })

  it('aceita CNPJ válido', () => {
    const r = createFornecedorSchema.safeParse({
      razaoSocial: 'Petrobras',
      cnpj: '33.000.167/0001-01',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.cnpj).toBe('33000167000101')
  })

  it('REJEITA CNPJ inválido', () => {
    const r = createFornecedorSchema.safeParse({
      razaoSocial: 'Fake',
      cnpj: '11.111.111/1111-11',
    })
    expect(r.success).toBe(false)
  })

  it('aceita CNPJ vazio (opcional)', () => {
    const r = createFornecedorSchema.safeParse({
      razaoSocial: 'Sem CNPJ',
      cnpj: '',
    })
    expect(r.success).toBe(true)
  })

  it('REJEITA razaoSocial muito curta', () => {
    const r = createFornecedorSchema.safeParse({ razaoSocial: 'a' })
    expect(r.success).toBe(false)
  })
})

describe('updateFornecedorSchema', () => {
  it('aceita aplicarEmRegras', () => {
    const r = updateFornecedorSchema.safeParse({
      categoryId: 'cmqz1234567890123456789x',
      aplicarEmRegras: true,
    })
    expect(r.success).toBe(true)
  })

  it('strict rejeita campo desconhecido', () => {
    const r = updateFornecedorSchema.safeParse({
      razaoSocial: 'X',
      hacker: true,
    })
    expect(r.success).toBe(false)
  })
})

describe('listFornecedoresQuerySchema', () => {
  it('defaults', () => {
    const r = listFornecedoresQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.fonte).toBe('ALL')
      expect(r.data.page).toBe(1)
      expect(r.data.pageSize).toBe(10)
    }
  })

  it('aceita ?fonte=BRASILAPI', () => {
    const r = listFornecedoresQuerySchema.safeParse({ fonte: 'BRASILAPI' })
    expect(r.success).toBe(true)
  })
})
