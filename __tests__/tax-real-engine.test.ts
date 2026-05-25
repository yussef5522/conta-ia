// Sprint 5.0.2 — testes Lucro Real engine.

import { describe, it, expect } from 'vitest'
import { calculateReal } from '@/lib/tax/real-engine'

describe('calculateReal — cenário Cacula Mix (RJ, restaurante)', () => {
  it('R$ 100k mês, margem 15%, com ICMS', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      estado: 'RS',
      hasICMS: true,
      hasISS: false,
    })

    // Lucro real = 100k × 15% = 15.000
    expect(r.lucroReal).toBe(15_000)
    // IRPJ = 15k × 15% = 2.250
    expect(r.irpj).toBe(2_250)
    // lucroReal 15k < 20k → adicional 0
    expect(r.irpjAdicional).toBe(0)
    // CSLL = 15k × 9% = 1.350
    expect(r.csll).toBe(1_350)
    // PIS = 1.65% × 100k = 1.650 (sem créditos)
    expect(r.pisBruto).toBe(1_650)
    expect(r.pis).toBe(1_650)
    // COFINS = 7.6% × 100k = 7.600
    expect(r.cofinsBruto).toBe(7_600)
    expect(r.cofins).toBe(7_600)
    // ICMS RS 17%
    expect(r.icms).toBe(17_000)
    expect(r.iss).toBe(0)
    // Total = 2250 + 0 + 1350 + 1650 + 7600 + 17000 = 29.850
    expect(r.total).toBe(29_850)
    expect(r.aliquotaEfetiva).toBeCloseTo(29.85, 2)
  })

  it('margem 30% triplica IRPJ + dispara adicional', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 30,
      estado: 'RS',
      hasICMS: false,
      hasISS: false,
    })
    // Lucro real = 30k
    expect(r.lucroReal).toBe(30_000)
    // IRPJ = 30k × 15% = 4.500
    expect(r.irpj).toBe(4_500)
    // adicional = (30k - 20k) × 10% = 1.000
    expect(r.irpjAdicional).toBe(1_000)
  })

  it('créditos PIS/COFINS reduzem o devido', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: false,
      creditosPIS: 500,
      creditosCOFINS: 3_000,
    })
    expect(r.pisCreditos).toBe(500)
    expect(r.cofinsCreditos).toBe(3_000)
    expect(r.pis).toBe(1_150) // 1650 - 500
    expect(r.cofins).toBe(4_600) // 7600 - 3000
  })

  it('créditos não podem deixar PIS/COFINS negativos', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: false,
      creditosPIS: 99_999,
      creditosCOFINS: 99_999,
    })
    expect(r.pis).toBe(0)
    expect(r.cofins).toBe(0)
  })

  it('Receita 0 → tudo 0 sem erro', () => {
    const r = calculateReal({
      receitaBrutaMes: 0,
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: true,
      hasISS: false,
    })
    expect(r.total).toBe(0)
    expect(r.aliquotaEfetiva).toBe(0)
  })

  it('Margem 0% → só PIS/COFINS + ICMS/ISS (IRPJ/CSLL 0)', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 0,
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.lucroReal).toBe(0)
    expect(r.irpj).toBe(0)
    expect(r.csll).toBe(0)
    // PIS 1650 + COFINS 7600 + ISS 5000 = 14.250
    expect(r.total).toBe(14_250)
  })

  it('Margem 100% inválida → throw (boundary)', () => {
    expect(() =>
      calculateReal({
        receitaBrutaMes: 100,
        margemRealPercent: 101,
        estado: 'SP',
        hasICMS: false,
        hasISS: false,
      }),
    ).toThrow()
  })

  it('Margem default 15% dispara warning de calibração', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: false,
    })
    expect(r.warnings.some((w) => w.includes('15%'))).toBe(true)
  })
})
