// Fix PRICE r_eff (17/06/2026)
//
// Bug: schedule PRICE com parcela fixa do contrato usava taxa NOMINAL
// (1,95% a.m.) que NÃO fecha o saldo: sobra R$ ~272 (SUM(amort) ~52.707
// vs S=52.980,89) — passivo não quita. Juros total = 8.672,28 vs
// contrato 8.399,41.
//
// Fix: derivar taxa EFETIVA r_eff via bissecção resolvendo
//   S = P × (1 − (1+r)^−n) / r
// → r_eff fecha o schedule EXATO. Identidade contábil:
//   SUM(amort) = S, juros total = n×P − S, saldo final = 0.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { solveEffectiveRate } from '../lib/loans/effective-rate'
import { generateMidLifeSchedule } from '../lib/loans/mid-life-schedule'

const ROOT = join(__dirname, '..')

describe('solveEffectiveRate — bissecção pra fechar PRICE', () => {
  it('Banrisul 002100064956967: S=52.980,89 P=4.092,02 n=15 → r_eff < 1,95%', () => {
    const r = solveEffectiveRate({
      outstandingBalance: 52980.89,
      fixedPayment: 4092.02,
      futureCount: 15,
    })
    // Taxa nominal era 1,95% (0.0195); r_eff esperado ~ 1,899% (menor)
    expect(r).toBeGreaterThan(0.018)
    expect(r).toBeLessThan(0.0195)
    expect(r).toBeCloseTo(0.01899, 4)
  })

  it('Identidade matemática: P × (1-(1+r)^-n) / r === S após convergência', () => {
    const S = 52980.89
    const P = 4092.02
    const n = 15
    const r = solveEffectiveRate({ outstandingBalance: S, fixedPayment: P, futureCount: n })
    const reconstructed = (P * (1 - Math.pow(1 + r, -n))) / r
    expect(reconstructed).toBeCloseTo(S, 2) // dentro de R$ 0,01
  })

  it('Erro quando soma das parcelas < saldo (matematicamente impossível)', () => {
    expect(() =>
      solveEffectiveRate({
        outstandingBalance: 1000,
        fixedPayment: 50,
        futureCount: 10, // 50 × 10 = 500 < 1000
      }),
    ).toThrow(/menor que saldo/)
  })

  it('Retorna ≈ 0 quando soma das parcelas = saldo (juros zero)', () => {
    const r = solveEffectiveRate({
      outstandingBalance: 1000,
      fixedPayment: 100,
      futureCount: 10, // 100 × 10 = 1000 = saldo
    })
    expect(r).toBeCloseTo(0, 4)
  })

  it('Converge em <100 iterações com tolerância R$ 0,005', () => {
    const r = solveEffectiveRate({
      outstandingBalance: 100000,
      fixedPayment: 5000,
      futureCount: 24,
    })
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(1)
  })
})

describe('Fix PRICE r_eff — schedule fecha identidade contábil', () => {
  it('Banrisul oracle: SUM(amort)=52.980,89 / juros total=8.399,41 / saldo final 0', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195, // nominal — IGNORADO no schedule porque tem fixedPayment
      futureCount: 15,
      startNumber: 14,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      isPostFixed: false,
      fixedPayment: 4092.02,
    })

    expect(rows).toHaveLength(15)

    // Identidade contábil — TODA tem que valer
    const sumAmort = rows.reduce((s, r) => s + r.amortization, 0)
    expect(sumAmort).toBeCloseTo(52980.89, 1) // dentro R$ 0,05

    const sumJuros = rows.reduce((s, r) => s + r.interest, 0)
    expect(sumJuros).toBeCloseTo(8399.41, 1) // dentro R$ 0,05 do oracle EXATO

    expect(rows[14].closingBalance).toBeCloseTo(0, 1)

    // Última parcela TAMBÉM é 4.092,02 (não vira "zerador" gigante)
    // Pode ter resíduo de centavo
    expect(rows[14].payment).toBeCloseTo(4092.02, 0)
  })

  it('Parcela 1 com r_eff: juros ~ 1.006 (saldo × ~1,899%), amort ~ 3.086', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195,
      futureCount: 15,
      startNumber: 14,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      fixedPayment: 4092.02,
    })
    // r_eff ≈ 0.01899 → juros 1 = 52980.89 × 0.01899 ≈ 1006.10
    expect(rows[0].interest).toBeGreaterThan(1000)
    expect(rows[0].interest).toBeLessThan(1015)
    expect(rows[0].amortization).toBeGreaterThan(3075)
    expect(rows[0].amortization).toBeLessThan(3092)
    expect(rows[0].payment).toBeCloseTo(4092.02, 2)
  })

  it('Amortização cresce do início ao fim (PRICE característica)', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195,
      futureCount: 15,
      startNumber: 14,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      fixedPayment: 4092.02,
    })
    expect(rows[14].amortization).toBeGreaterThan(rows[0].amortization)
    // Juros caem
    expect(rows[14].interest).toBeLessThan(rows[0].interest)
  })

  it('PRICE SEM fixedPayment (NOVO) continua usando nominal — sem regressão', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195,
      futureCount: 15,
      startNumber: 1,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      // SEM fixedPayment
    })
    // PMT calculado pela nominal
    expect(rows[0].interest).toBeCloseTo(52980.89 * 0.0195, 1)
  })
})

describe('Fix PRICE r_eff — regressão SAC + POS intactos', () => {
  it('SAC pós-fixado loan 1 Banrisul (40.295,17 / 1.898,69 / 0,35%) preservado', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 40295.17,
      rateMonthly: 0.0035,
      futureCount: 21,
      startNumber: 35,
      firstDueDate: new Date('2026-07-01'),
      system: 'SAC',
      amortizationConstant: 1898.69,
      isPostFixed: true,
      estimatedCorrectionMonthly: 0.01,
    })
    expect(rows[0].amortization).toBeCloseTo(1898.69, 2)
    expect(rows[0].interest).toBeCloseTo(141.03, 1)
    expect(rows[0].isEstimate).toBe(true)
    expect(rows[20].closingBalance).toBeCloseTo(0, 2)
  })

  it('SAC com fixedPayment passado IGNORA o solver (SAC não usa)', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 30000,
      rateMonthly: 0.01,
      futureCount: 10,
      startNumber: 1,
      firstDueDate: new Date('2026-07-01'),
      system: 'SAC',
      amortizationConstant: 3000,
      fixedPayment: 9999, // ignorado pelo ramo SAC
    })
    expect(rows[0].amortization).toBeCloseTo(3000, 2)
    expect(rows[0].interest).toBeCloseTo(300, 1) // 30000 × 1% = 300 (nominal SAC)
  })
})

describe('Fix PRICE r_eff — UI previa usa r_eff', () => {
  const code = readFileSync(
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
    'utf-8',
  )

  it('importa solveEffectiveRate de @/lib/loans/effective-rate', () => {
    expect(code).toMatch(/import\s+\{\s*solveEffectiveRate\s*\}\s+from\s+['"]@\/lib\/loans\/effective-rate['"]/)
  })

  it('previa PRICE chama solveEffectiveRate quando parcelaFixa > 0', () => {
    expect(code).toMatch(/parcelaFixa\s*>\s*0[\s\S]{0,300}solveEffectiveRate/)
  })

  it('jurosPreFuturoEstimado usa identidade n×P − S (não loop nominal)', () => {
    expect(code).toMatch(/parcelaFixa\s*\*\s*futuras\s*-\s*saldo/)
  })
})
