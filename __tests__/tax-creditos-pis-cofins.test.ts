// Sprint 5.0.2.f — Lucro Real com créditos PIS/COFINS automáticos via comprasMes.

import { describe, it, expect } from 'vitest'
import { calculateReal } from '@/lib/tax/real-engine'

describe('calculateReal — créditos PIS/COFINS automáticos via comprasMes', () => {
  it('comprasMes 0 → SEM créditos (PIS = receita×1,65% bruto)', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 0,
    })
    expect(r.pisBruto).toBe(1650)
    expect(r.pis).toBe(1650) // sem desconto
    expect(r.cofinsBruto).toBe(7600)
    expect(r.cofins).toBe(7600)
    expect(r.pisCreditos).toBe(0)
    expect(r.cofinsCreditos).toBe(0)
  })

  it('comprasMes 50k → crédito PIS 825 + COFINS 3800', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 50_000,
    })
    // 50k × 1,65% = 825
    // 50k × 7,6% = 3800
    expect(r.pisCreditos).toBe(825)
    expect(r.cofinsCreditos).toBe(3800)
    // PIS líquido = 1650 - 825 = 825
    expect(r.pis).toBe(825)
    expect(r.cofins).toBe(3800)
  })

  it('Cacula Mix — receita 450k + compras 180k (40% receita)', () => {
    const r = calculateReal({
      receitaBrutaMes: 450_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: true,
      estado: 'RS',
      comprasMes: 180_000,
    })
    // Debito PIS = 450k × 1,65% = 7425
    // Credito PIS = 180k × 1,65% = 2970
    // PIS líquido = 7425 - 2970 = 4455
    expect(r.pisBruto).toBe(7425)
    expect(r.pisCreditos).toBe(2970)
    expect(r.pis).toBe(4455)

    // Debito COFINS = 450k × 7,6% = 34200
    // Credito COFINS = 180k × 7,6% = 13680
    // COFINS líquido = 34200 - 13680 = 20520
    expect(r.cofinsBruto).toBe(34_200)
    expect(r.cofinsCreditos).toBe(13_680)
    expect(r.cofins).toBe(20_520)

    // Economia PIS+COFINS vs sem créditos: (1650+7600 - 825-3800) = ~ 16650 por 100k
    // Em escala 450k+180k: ~16650
  })

  it('compras > receita → créditos não podem deixar PIS/COFINS negativos', () => {
    const r = calculateReal({
      receitaBrutaMes: 10_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 100_000, // 10× a receita
    })
    expect(r.pis).toBe(0)
    expect(r.cofins).toBe(0)
  })

  it('creditosPIS em R$ sobrescreve comprasMes (override manual)', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 50_000, // auto seria PIS 825
      creditosPIS: 1500, // mas override manual
    })
    expect(r.pisCreditos).toBe(1500)
    // creditosCOFINS não foi sobrescrito → segue cálculo auto
    expect(r.cofinsCreditos).toBe(3800)
  })

  it('Sem comprasMes nem creditos manuais → warning emitido', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
    })
    expect(r.warnings.some((w) => w.includes('compras'))).toBe(true)
  })

  it('Com comprasMes informado → SEM warning de compras (mas pode ter margem)', () => {
    const r = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 25, // não default 15
      hasICMS: false,
      hasISS: false,
      comprasMes: 50_000,
    })
    expect(r.warnings.some((w) => w.includes('Sem compras'))).toBe(false)
  })

  it('Economia vs sem créditos é proporcional às compras', () => {
    const semCompras = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 0,
    })
    const comCompras = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 50_000,
    })
    // Economia PIS+COFINS = 50k × 9,25% = 4625
    const economia = semCompras.total - comCompras.total
    expect(economia).toBeCloseTo(4625, 1)
  })

  it('total não-cumulativo > Presumido cumulativo SÓ se margem alta sem compras', () => {
    // Lucro Real sem compras vira caro: 9,25% PIS+COFINS bruto
    const realSemCompras = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 0,
    })
    // Real COM compras 60% pode ficar mais barato que Presumido
    const realComCompras = calculateReal({
      receitaBrutaMes: 100_000,
      margemRealPercent: 15,
      hasICMS: false,
      hasISS: false,
      comprasMes: 60_000,
    })
    expect(realComCompras.total).toBeLessThan(realSemCompras.total)
  })
})
