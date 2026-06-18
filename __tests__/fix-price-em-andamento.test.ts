// Fix PRICE Em Andamento (17/06/2026)
// Bug: ramo PRICE de generateMidLifeSchedule recalculava PMT e divergia da
// parcela real do contrato por day-count + arredondamento bancário (+R$15).
// Pior: a previa na UI usava `saldo / futuras` como "amortização constante"
// (SAC) mesmo quando system='PRICE' — o que NÃO existe em PRICE (amort
// CRESCE conforme juros caem).
//
// Fix: lib aceita `fixedPayment` opcional (valor REAL do contrato vindo do
// PDF ou input manual); UI muda card pra "PARCELA (FIXA)" quando system=PRICE
// e calcula juros total pelo schedule PRICE real.
//
// Oracle: Banrisul 002100064956967 PRICE pré-fixado
//   saldo = 52.980,89  ·  taxa = 1,95% a.m.  ·  15 parcelas futuras
//   parcela FIXA do contrato = 4.092,02
//   parcela 1: juros 1.033,13 · amort 3.058,89 · closing 49.922,00
//   SUM(amort 15) = 52.980,89 (zera saldo na última)
//   SUM(juros 15) = 8.399,41
//   SUM(parcelas) = 61.380,30

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateMidLifeSchedule } from '../lib/loans/mid-life-schedule'

const ROOT = join(__dirname, '..')

describe('Fix PRICE — generateMidLifeSchedule aceita fixedPayment', () => {
  it('PRICE oracle Banrisul 002100064956967: parcela fixa 4.092,02 × 15', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195,
      futureCount: 15,
      startNumber: 14,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      isPostFixed: false,
      fixedPayment: 4092.02,
    })

    expect(rows).toHaveLength(15)

    // Sprint Fix-PRICE-r_eff: engine deriva r_eff (~1,899%) que fecha o
    // schedule EXATO. Juros 1 = saldo × r_eff ≈ 1.005,85 (não mais
    // 1.033,13 da nominal). Parcela 1: juros 1.005,85 / amort 3.086,17.
    expect(rows[0].number).toBe(14)
    expect(rows[0].openingBalance).toBeCloseTo(52980.89, 2)
    expect(rows[0].interest).toBeGreaterThan(1000)
    expect(rows[0].interest).toBeLessThan(1015)
    expect(rows[0].amortization).toBeGreaterThan(3075)
    expect(rows[0].amortization).toBeLessThan(3092)
    expect(rows[0].payment).toBeCloseTo(4092.02, 2)

    // Última parcela ZERA o saldo EXATO (identidade contábil)
    expect(rows[14].closingBalance).toBeCloseTo(0, 1)

    // SUM(amort) = saldo inicial — IDENTIDADE OBRIGATÓRIA
    const sumAmort = rows.reduce((s, r) => s + r.amortization, 0)
    expect(sumAmort).toBeCloseTo(52980.89, 1)

    // SUM(juros) = n×P − S = 15 × 4.092,02 − 52.980,89 = 8.399,41 EXATO
    const sumJuros = rows.reduce((s, r) => s + r.interest, 0)
    expect(sumJuros).toBeCloseTo(8399.41, 1)

    // Amortização CRESCE (PRICE característica)
    for (let i = 1; i < 14; i++) {
      // Pulamos a última (que é o "zerador" e pode quebrar a monotonia)
      expect(rows[i].amortization).toBeGreaterThan(rows[i - 1].amortization)
    }

    // Juros CAEM
    for (let i = 1; i < 15; i++) {
      expect(rows[i].interest).toBeLessThan(rows[i - 1].interest)
    }
  })

  it('PRICE com fixedPayment ausente recalcula PMT (legado)', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195,
      futureCount: 15,
      startNumber: 1,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      isPostFixed: false,
      // SEM fixedPayment: PMT recalcula
    })
    // PMT calculado ≈ 4.107,67 (diverge dos 4.092,02 do contrato)
    expect(rows[0].payment).toBeGreaterThan(4100)
    expect(rows[0].payment).toBeLessThan(4115)
  })

  it('PRICE: parcela fixa sempre igual (exceto última zerando)', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52980.89,
      rateMonthly: 0.0195,
      futureCount: 15,
      startNumber: 14,
      firstDueDate: new Date('2026-07-01'),
      system: 'PRICE',
      fixedPayment: 4092.02,
    })
    for (let i = 0; i < 14; i++) {
      expect(rows[i].payment).toBeCloseTo(4092.02, 2)
    }
  })

  it('SAC NÃO usa fixedPayment (mesmo se passado, é ignorado)', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 30000,
      rateMonthly: 0.01,
      futureCount: 10,
      startNumber: 1,
      firstDueDate: new Date('2026-07-01'),
      system: 'SAC',
      amortizationConstant: 3000,
      // fixedPayment NÃO se aplica a SAC
      fixedPayment: 9999,
    })
    // SAC: amortização constante = 3000; parcela CAI
    expect(rows[0].amortization).toBeCloseTo(3000, 2)
    expect(rows[0].payment).not.toBeCloseTo(9999, 0)
    expect(rows[9].amortization).toBeCloseTo(3000, 2)
  })
})

describe('Fix PRICE — regressão SAC 1º empréstimo Banrisul (pos-fixado)', () => {
  it('SAC pós-fixado saldo 40.295,17 amort 1.898,69 — intactos', () => {
    // 1º empréstimo do Yussef (Banrisul SAC pós-fixado).
    // Deve continuar funcionando exatamente como antes da Sprint Fix-PRICE.
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

    expect(rows).toHaveLength(21)
    expect(rows[0].amortization).toBeCloseTo(1898.69, 2)
    // Juros parcela 1: 40.295,17 × 0,35% = 141,03
    expect(rows[0].interest).toBeCloseTo(141.03, 1)
    // isEstimate=true (pós-fixado)
    expect(rows[0].isEstimate).toBe(true)
    // Última zera saldo
    expect(rows[20].closingBalance).toBeCloseTo(0, 2)
  })
})

describe('Fix PRICE — UI previa retorna system=PRICE com parcelaFixa', () => {
  const code = readFileSync(
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
    'utf-8',
  )

  it('preview useMemo tem ramo PRICE retornando { system: "PRICE", parcelaFixa }', () => {
    expect(code).toMatch(/system:\s*['"]PRICE['"]\s*as\s*const/)
    expect(code).toMatch(/parcelaFixa/)
  })

  it('preview useMemo tem ramo SAC retornando { system: "SAC", amortConst }', () => {
    expect(code).toMatch(/system:\s*['"]SAC['"]\s*as\s*const/)
    expect(code).toMatch(/amortConst/)
  })

  it('JSX da pré-visualização escolhe Box "Parcela (fixa)" quando system=PRICE', () => {
    expect(code).toMatch(/preview\.system\s*===\s*['"]PRICE['"]/)
    expect(code).toMatch(/Parcela \(fixa\)/)
  })

  it('PRICE: fixedPayment state + input manual no form', () => {
    expect(code).toMatch(/const \[fixedPayment, setFixedPayment\]/)
    expect(code).toMatch(/Parcela fixa \(PRICE\)/)
  })

  it('save payload envia fixedPayment quando system=PRICE', () => {
    expect(code).toMatch(/fixedPayment:[\s\S]{0,200}amortizationSystem === ['"]PRICE['"]/)
  })

  it('overrides: POS usa LÍQUIDO (com desconto); PRE usa CHEIO', () => {
    // PDF flow: isPos ? payment - discount : payment
    expect(code).toMatch(/isPos[\s\S]{0,200}p\.payment\s*-\s*p\.discount[\s\S]{0,100}:\s*p\.payment/)
  })

  it('PRICE pré-fixado: PDF setta fixedPayment com 1ª parcela da lista', () => {
    expect(code).toMatch(/amortizationSystem === ['"]PRICE['"][\s\S]{0,300}setFixedPayment/)
  })
})

describe('Fix PRICE — route.ts (POST) aceita fixedPayment em EM_ANDAMENTO', () => {
  const code = readFileSync(
    join(ROOT, 'app/api/empresas/[id]/emprestimos/route.ts'),
    'utf-8',
  )

  it('zod schema MID_LIFE inclui fixedPayment opcional positivo', () => {
    expect(code).toMatch(/fixedPayment:\s*z\.coerce\.number\(\)\.positive\(\)\.optional\(\)/)
  })

  it('handler passa fixedPayment pra generateMidLifeSchedule', () => {
    expect(code).toMatch(/fixedPayment:\s*d\.fixedPayment/)
  })
})
