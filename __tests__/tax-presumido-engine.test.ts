// Sprint 5.0.2 — testes Lucro Presumido engine.

import { describe, it, expect } from 'vitest'
import {
  calculatePresumido,
  MARGENS_PRESUNCAO_2026,
  PRESUMIDO_LIMITE_RBA_2026,
} from '@/lib/tax/presumido-engine'

describe('Tabelas Lucro Presumido 2026', () => {
  it('tem 8 atividades cadastradas', () => {
    expect(MARGENS_PRESUNCAO_2026).toHaveLength(8)
  })

  it('COMERCIO: margem IRPJ 8% + CSLL 12% (Lei 9.249/95)', () => {
    const m = MARGENS_PRESUNCAO_2026.find((x) => x.atividade === 'COMERCIO')!
    expect(m.margemIRPJ).toBe(8.0)
    expect(m.margemCSLL).toBe(12.0)
  })

  it('SERVICOS: margem IRPJ 32% + CSLL 32%', () => {
    const m = MARGENS_PRESUNCAO_2026.find((x) => x.atividade === 'SERVICOS')!
    expect(m.margemIRPJ).toBe(32.0)
    expect(m.margemCSLL).toBe(32.0)
  })

  it('TRANSPORTE_PASSAGEIROS: margem IRPJ 16% (intermediário)', () => {
    const m = MARGENS_PRESUNCAO_2026.find((x) => x.atividade === 'TRANSPORTE_PASSAGEIROS')!
    expect(m.margemIRPJ).toBe(16.0)
  })

  it('REVENDA_COMBUSTIVEIS: margem IRPJ 1.6% (especial)', () => {
    const m = MARGENS_PRESUNCAO_2026.find((x) => x.atividade === 'REVENDA_COMBUSTIVEIS')!
    expect(m.margemIRPJ).toBe(1.6)
  })

  it('Limite Lucro Presumido = R$ 78M', () => {
    expect(PRESUMIDO_LIMITE_RBA_2026).toBe(78_000_000)
  })
})

describe('calculatePresumido — Comércio', () => {
  it('R$ 100k mês comércio (RS, com ICMS)', () => {
    const r = calculatePresumido({
      atividade: 'COMERCIO',
      receitaBrutaMes: 100_000,
      estado: 'RS',
      hasICMS: true,
      hasISS: false,
    })

    // Base IRPJ = 100k × 8% = 8k → IRPJ = 8k × 15% = 1.200
    expect(r.baseIRPJ).toBe(8_000)
    expect(r.irpj).toBe(1_200)
    // baseIRPJ 8k < 20k limite → adicional = 0
    expect(r.irpjAdicional).toBe(0)
    // Base CSLL = 100k × 12% = 12k → CSLL = 12k × 9% = 1.080
    expect(r.baseCSLL).toBe(12_000)
    expect(r.csll).toBe(1_080)
    // PIS = 0.65% × 100k = 650
    expect(r.pis).toBe(650)
    // COFINS = 3% × 100k = 3.000
    expect(r.cofins).toBe(3_000)
    // ICMS RS 17% × 100k = 17.000
    expect(r.icms).toBe(17_000)
    expect(r.iss).toBe(0)
    // Total = 1200 + 0 + 1080 + 650 + 3000 + 17000 = 22.930
    expect(r.total).toBe(22_930)
    expect(r.aliquotaEfetiva).toBeCloseTo(22.93, 2)
  })
})

describe('calculatePresumido — Serviços (sem ICMS, com ISS)', () => {
  it('R$ 100k mês serviços (RS)', () => {
    const r = calculatePresumido({
      atividade: 'SERVICOS',
      receitaBrutaMes: 100_000,
      estado: 'RS',
      hasICMS: false,
      hasISS: true,
    })

    // Base IRPJ = 100k × 32% = 32k → IRPJ = 32k × 15% = 4.800
    expect(r.baseIRPJ).toBe(32_000)
    expect(r.irpj).toBe(4_800)
    // baseIRPJ 32k > 20k → adicional = (32k - 20k) × 10% = 1.200
    expect(r.irpjAdicional).toBe(1_200)
    // CSLL = 32k × 9% = 2.880
    expect(r.csll).toBe(2_880)
    // PIS 650 + COFINS 3000
    expect(r.pis).toBe(650)
    expect(r.cofins).toBe(3_000)
    expect(r.icms).toBe(0)
    // ISS 5% × 100k = 5.000
    expect(r.iss).toBe(5_000)
    // Total = 4800 + 1200 + 2880 + 650 + 3000 + 0 + 5000 = 17.530
    expect(r.total).toBe(17_530)
    expect(r.aliquotaEfetiva).toBeCloseTo(17.53, 2)
  })
})

describe('calculatePresumido — boundaries', () => {
  it('Receita 0 → tudo 0', () => {
    const r = calculatePresumido({
      atividade: 'COMERCIO',
      receitaBrutaMes: 0,
      estado: 'SP',
      hasICMS: true,
      hasISS: false,
    })
    expect(r.total).toBe(0)
    expect(r.aliquotaEfetiva).toBe(0)
  })

  it('Receita negativa → throw', () => {
    expect(() =>
      calculatePresumido({
        atividade: 'COMERCIO',
        receitaBrutaMes: -1,
        estado: 'SP',
        hasICMS: true,
        hasISS: false,
      }),
    ).toThrow()
  })

  it('RBA acima limite 78M → warning', () => {
    const r = calculatePresumido({
      atividade: 'COMERCIO',
      receitaBrutaMes: 10_000,
      rbaAcumulada: 80_000_000,
      estado: 'SP',
      hasICMS: false,
      hasISS: false,
    })
    expect(r.warnings.some((w) => w.includes('R$ 78'))).toBe(true)
  })

  it('Estado desconhecido cai pro fallback 18%', () => {
    const r = calculatePresumido({
      atividade: 'COMERCIO',
      receitaBrutaMes: 100_000,
      estado: 'ZZ',
      hasICMS: true,
      hasISS: false,
    })
    // ICMS = 18% (fallback) × 100k = 18.000
    expect(r.icms).toBe(18_000)
  })
})
