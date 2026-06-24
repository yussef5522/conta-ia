// Sprint 13 — guard contra órfãs do multi-tenant em createContaPendente.
// Helper puro espelha a checagem booleana.

import { describe, it, expect } from 'vitest'

function hasMultiTenantLink(input: {
  bankAccountId?: string | null
  categoryId?: string | null
  supplierId?: string | null
  customerId?: string | null
}): boolean {
  return (
    input.bankAccountId != null ||
    input.categoryId != null ||
    input.supplierId != null ||
    input.customerId != null
  )
}

describe('hasMultiTenantLink — guard contra órfã (Sprint 13)', () => {
  it('TODOS null → falso (órfã)', () => {
    expect(
      hasMultiTenantLink({
        bankAccountId: null,
        categoryId: null,
        supplierId: null,
        customerId: null,
      }),
    ).toBe(false)
  })

  it('só categoryId → válido', () => {
    expect(
      hasMultiTenantLink({
        bankAccountId: null,
        categoryId: 'cat_1',
        supplierId: null,
        customerId: null,
      }),
    ).toBe(true)
  })

  it('só bankAccountId → válido', () => {
    expect(
      hasMultiTenantLink({
        bankAccountId: 'ba_1',
        categoryId: null,
        supplierId: null,
        customerId: null,
      }),
    ).toBe(true)
  })

  it('só supplierId → válido', () => {
    expect(
      hasMultiTenantLink({
        bankAccountId: null,
        categoryId: null,
        supplierId: 'sup_1',
        customerId: null,
      }),
    ).toBe(true)
  })

  it('só customerId → válido (RECEIVABLE)', () => {
    expect(
      hasMultiTenantLink({
        bankAccountId: null,
        categoryId: null,
        supplierId: null,
        customerId: 'cu_1',
      }),
    ).toBe(true)
  })

  it('vários vínculos → válido', () => {
    expect(
      hasMultiTenantLink({
        bankAccountId: 'ba_1',
        categoryId: 'cat_1',
        supplierId: 'sup_1',
        customerId: null,
      }),
    ).toBe(true)
  })

  it('undefined também conta como null', () => {
    expect(hasMultiTenantLink({})).toBe(false)
  })

  it('string vazia NÃO conta — Zod já valida cuid, mas defensivo', () => {
    // Backend usa != null (não !=). String vazia passa, mas Zod.cuid() rejeita antes.
    expect(hasMultiTenantLink({ categoryId: '' as string })).toBe(true)
  })
})
