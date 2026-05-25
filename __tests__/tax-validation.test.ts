// Sprint 5.0.1 — testes Zod tax-profile + tax-calculate.

import { describe, it, expect } from 'vitest'
import {
  taxProfileUpsertSchema,
  taxCalculateSchema,
} from '@/lib/validations/tax'

describe('taxProfileUpsertSchema', () => {
  it('Simples Nacional sem anexo → erro', () => {
    expect(() =>
      taxProfileUpsertSchema.parse({
        regime: 'SIMPLES_NACIONAL',
        folha12m: 0,
        proLabore: 0,
      }),
    ).toThrow()
  })

  it('Simples Nacional + Anexo III → OK', () => {
    const r = taxProfileUpsertSchema.parse({
      regime: 'SIMPLES_NACIONAL',
      simplesAnexo: 'ANEXO_III',
      folha12m: 200_000,
      proLabore: 5_000,
    })
    expect(r.simplesAnexo).toBe('ANEXO_III')
  })

  it('Lucro Presumido sem anexo → OK (anexo só pra Simples)', () => {
    const r = taxProfileUpsertSchema.parse({
      regime: 'LUCRO_PRESUMIDO',
      folha12m: 0,
      proLabore: 0,
    })
    expect(r.regime).toBe('LUCRO_PRESUMIDO')
  })

  it('Regime inválido → erro', () => {
    expect(() =>
      taxProfileUpsertSchema.parse({
        regime: 'LUCRO_INEXISTENTE',
        folha12m: 0,
        proLabore: 0,
      }),
    ).toThrow()
  })

  it('Anexo inválido → erro', () => {
    expect(() =>
      taxProfileUpsertSchema.parse({
        regime: 'SIMPLES_NACIONAL',
        simplesAnexo: 'ANEXO_X',
        folha12m: 0,
        proLabore: 0,
      }),
    ).toThrow()
  })

  it('folha12m negativa → erro', () => {
    expect(() =>
      taxProfileUpsertSchema.parse({
        regime: 'SIMPLES_NACIONAL',
        simplesAnexo: 'ANEXO_I',
        folha12m: -100,
        proLabore: 0,
      }),
    ).toThrow()
  })
})

describe('taxCalculateSchema', () => {
  it('payload válido', () => {
    const r = taxCalculateSchema.parse({
      paYear: 2026,
      paMonth: 5,
      receitaBrutaMes: 50_000,
    })
    expect(r.paYear).toBe(2026)
    expect(r.paMonth).toBe(5)
    expect(r.receitaBrutaMes).toBe(50_000)
  })

  it('ano antes 2020 → erro', () => {
    expect(() =>
      taxCalculateSchema.parse({ paYear: 2019, paMonth: 1, receitaBrutaMes: 0 }),
    ).toThrow()
  })

  it('mês inválido → erro', () => {
    expect(() =>
      taxCalculateSchema.parse({ paYear: 2026, paMonth: 13, receitaBrutaMes: 0 }),
    ).toThrow()
    expect(() =>
      taxCalculateSchema.parse({ paYear: 2026, paMonth: 0, receitaBrutaMes: 0 }),
    ).toThrow()
  })

  it('receita negativa → erro', () => {
    expect(() =>
      taxCalculateSchema.parse({ paYear: 2026, paMonth: 5, receitaBrutaMes: -1 }),
    ).toThrow()
  })

  it('strings coerce pra number', () => {
    const r = taxCalculateSchema.parse({
      paYear: '2026',
      paMonth: '5',
      receitaBrutaMes: '50000',
    })
    expect(r.paYear).toBe(2026)
    expect(r.receitaBrutaMes).toBe(50_000)
  })
})
