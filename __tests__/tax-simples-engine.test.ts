// Sprint 5.0.1 — testes do engine de cálculo DAS (função pura).

import { describe, it, expect } from 'vitest'
import { calculateSimples } from '@/lib/tax/simples-engine'

describe('calculateSimples — Anexo I (Comércio, sem Fator R)', () => {
  it('Faixa 1: receita 10k + RBA 100k → alíquota efetiva ~4%', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_I',
      receitaBrutaMes: 10_000,
      rbaAcumulada: 100_000,
      folha12m: 0,
    })
    expect(r.anexoUsado).toBe('ANEXO_I')
    expect(r.faixa).toBe(1)
    expect(r.aliquotaNominal).toBe(4.0)
    expect(r.parcelaDeduzir).toBe(0)
    expect(r.aliquotaEfetiva).toBe(4.0) // sem deduzir, efetiva = nominal
    expect(r.dasValue).toBe(400) // 10k × 4%
  })

  it('Faixa 3: receita 50k + RBA 600k → alíquota efetiva calculada', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_I',
      receitaBrutaMes: 50_000,
      rbaAcumulada: 600_000,
      folha12m: 0,
    })
    // RBA projeção = 650k → faixa 3 (360-720): 9.5% / deduz 13.860
    // AliqEfetiva = ((650.000 × 0.095) - 13.860) / 650.000 = 0.0736923 ≈ 7.37%
    expect(r.faixa).toBe(3)
    expect(r.aliquotaNominal).toBe(9.5)
    expect(r.aliquotaEfetiva).toBeGreaterThan(7)
    expect(r.aliquotaEfetiva).toBeLessThan(8)
    // DAS = 50k × ~7.37% ≈ 3.685
    expect(r.dasValue).toBeGreaterThan(3_500)
    expect(r.dasValue).toBeLessThan(3_900)
  })
})

describe('calculateSimples — Anexo III + Fator R', () => {
  it('Folha alta (>28% RBA): mantém Anexo III', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_III',
      receitaBrutaMes: 50_000,
      rbaAcumulada: 600_000,
      folha12m: 200_000, // 200k / 600k = 33%
    })
    expect(r.fatorR).toBeCloseTo(0.3333, 3)
    expect(r.fatorRApplied).toBe(false)
    expect(r.anexoUsado).toBe('ANEXO_III')
    expect(r.aliquotaNominal).toBe(13.5)
  })

  it('Folha baixa (<28% RBA): troca pra Anexo V', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_III',
      receitaBrutaMes: 50_000,
      rbaAcumulada: 600_000,
      folha12m: 100_000, // 100k / 600k = 16.7%
    })
    expect(r.fatorR).toBeCloseTo(0.1667, 3)
    expect(r.fatorRApplied).toBe(true)
    expect(r.anexoUsado).toBe('ANEXO_V')
    expect(r.anexoOriginal).toBe('ANEXO_III')
    expect(r.warnings.some((w) => w.includes('Fator R'))).toBe(true)
  })

  it('Folha exatamente 28%: usa Anexo III (limite inclusivo)', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_III',
      receitaBrutaMes: 1_000,
      rbaAcumulada: 100_000,
      folha12m: 28_000,
    })
    expect(r.fatorR).toBe(0.28)
    expect(r.anexoUsado).toBe('ANEXO_III')
    expect(r.fatorRApplied).toBe(false)
  })

  it('Input Anexo V + Folha alta: troca pra Anexo III (benefício)', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_V',
      receitaBrutaMes: 50_000,
      rbaAcumulada: 600_000,
      folha12m: 200_000,
    })
    expect(r.fatorRApplied).toBe(true)
    expect(r.anexoUsado).toBe('ANEXO_III')
  })
})

describe('calculateSimples — Anexo II (Indústria, sem Fator R)', () => {
  it('Fator R NÃO afeta Anexo II', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_II',
      receitaBrutaMes: 10_000,
      rbaAcumulada: 100_000,
      folha12m: 5_000, // folha BAIXA
    })
    expect(r.anexoUsado).toBe('ANEXO_II')
    expect(r.fatorRApplied).toBe(false)
  })
})

describe('calculateSimples — boundaries', () => {
  it('RBA = 0 + receita 0 → DAS 0 (sem erro)', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_I',
      receitaBrutaMes: 0,
      rbaAcumulada: 0,
      folha12m: 0,
    })
    expect(r.dasValue).toBe(0)
    expect(r.fatorR).toBe(0) // proteção div/0
  })

  it('RBA acima teto → warning + DAS 0', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_I',
      receitaBrutaMes: 100_000,
      rbaAcumulada: 4_800_000, // já no teto
      folha12m: 0,
    })
    // RBA projeção = 4.9M → estoura
    expect(r.faixa).toBeNull()
    expect(r.dasValue).toBe(0)
    expect(r.warnings.some((w) => w.includes('teto'))).toBe(true)
  })

  it('Receita negativa → throw', () => {
    expect(() =>
      calculateSimples({
        anexo: 'ANEXO_I',
        receitaBrutaMes: -100,
        rbaAcumulada: 0,
        folha12m: 0,
      }),
    ).toThrow()
  })

  it('Folha negativa → throw', () => {
    expect(() =>
      calculateSimples({
        anexo: 'ANEXO_III',
        receitaBrutaMes: 100,
        rbaAcumulada: 100,
        folha12m: -10,
      }),
    ).toThrow()
  })
})

describe('calculateSimples — Anexo IV (sem Fator R)', () => {
  it('Construção: Fator R não afeta', () => {
    const r = calculateSimples({
      anexo: 'ANEXO_IV',
      receitaBrutaMes: 50_000,
      rbaAcumulada: 600_000,
      folha12m: 50_000,
    })
    expect(r.anexoUsado).toBe('ANEXO_IV')
    expect(r.fatorRApplied).toBe(false)
    expect(r.faixa).toBe(3)
    expect(r.aliquotaNominal).toBe(10.2)
  })
})

describe('calculateSimples — cenário documentado pro Yussef', () => {
  it('Academia Anexo III + folha 36% RBA + faturamento R$ 50k/mês', () => {
    // Cenário típico de academia BR
    const r = calculateSimples({
      anexo: 'ANEXO_III',
      receitaBrutaMes: 50_000,
      rbaAcumulada: 600_000, // 12 meses de R$ 50k
      folha12m: 216_000, // R$ 18k/mês × 12 = 36% RBA
    })

    expect(r.anexoUsado).toBe('ANEXO_III') // Fator R OK
    expect(r.fatorR).toBeCloseTo(0.36, 2)
    expect(r.faixa).toBe(3)
    expect(r.aliquotaNominal).toBe(13.5)
    // DAS deve estar na ordem de R$ 5k pra essa receita
    expect(r.dasValue).toBeGreaterThan(4_500)
    expect(r.dasValue).toBeLessThan(5_500)
  })
})
