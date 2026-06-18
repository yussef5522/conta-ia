// Sprint Fix-Previa (17/06/2026) — testes do bug da previa enganosa.
//
// Bug: previa do empréstimo EM_ANDAMENTO / POS recalculava SAC pré-fixado
// do principal original, ignorando carência e CDI. Mostrava "1ª parcela
// R$ 2.165,53 / TOTAL JUROS R$ 17.517,50" pra contrato Banrisul cujo
// amort real é R$ 1.898,69 e total de juros é não-determinístico (CDI).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateMidLifeSchedule } from '@/lib/loans/mid-life-schedule'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')

// Banrisul oráculo: parcelas A PAGAR com payment + discount → líquido (total)
const FIXTURE_PARCELAS_A_PAGAR = [
  { number: 56, dueDate: '2026-06-26', payment: 2519.02, discount: 153.43 }, // líquido 2365.59
  { number: 57, dueDate: '2026-07-26', payment: 2451.18, discount: 438.38 }, // 2012.80
  { number: 58, dueDate: '2026-08-26', payment: 2456.08, discount: 443.85 }, // 2012.23
  { number: 76, dueDate: '2028-02-26', payment: 1930.15, discount: 155.18 }, // 1774.97
]

// ============================================================================
// 1) paymentOverrides do PDF (líquido) — SUM(amort) preservado, payment usa
//    o líquido REAL do PDF
// ============================================================================
describe('Sprint Fix-Previa — paymentOverrides usa líquido (parcela #056 = 2365,59, não 2519,02)', () => {
  it('parcela 056 com override 2365,59 → payment=2365.59 + amort=1898.69 + interest fixo + correcao recalculada', () => {
    const overrides = new Map<number, number>([[56, 2365.59]])
    const sch = generateMidLifeSchedule({
      outstandingBalance: 40295.17,
      rateMonthly: 0.0035,
      futureCount: 21,
      startNumber: 56,
      firstDueDate: D('2026-06-26'),
      system: 'SAC',
      amortizationConstant: 1898.69,
      isPostFixed: true,
      paymentOverrides: overrides,
    })
    const p56 = sch[0]
    expect(p56.number).toBe(56)
    expect(p56.payment).toBeCloseTo(2365.59, 2)
    expect(p56.amortization).toBeCloseTo(1898.69, 2)
    // juros pré = saldo × 0,35% = 40295,17 × 0,0035 = 141,03
    expect(p56.interest).toBeCloseTo(141.03, 1)
    // correcao = 2365,59 - 1898,69 - 141,03 = 325,87 (CDI/desconto já embutido)
    expect(p56.correcao).toBeCloseTo(325.87, 1)
    // closingBalance independe do payment — só amortização afeta
    expect(p56.closingBalance).toBeCloseTo(38396.48, 2)
  })

  it('SUM(amortizations) PRESERVA o saldo (override não afeta amortização)', () => {
    const overrides = new Map<number, number>(
      FIXTURE_PARCELAS_A_PAGAR.map((p) => [p.number, p.payment - (p.discount ?? 0)]),
    )
    const sch = generateMidLifeSchedule({
      outstandingBalance: 40295.17,
      rateMonthly: 0.0035,
      futureCount: 21,
      startNumber: 56,
      firstDueDate: D('2026-06-26'),
      system: 'SAC',
      amortizationConstant: 1898.69,
      isPostFixed: true,
      paymentOverrides: overrides,
    })
    const sumAmort = sch.reduce(
      (s, r) => Math.round((s + r.amortization) * 100) / 100,
      0,
    )
    expect(sumAmort).toBe(40295.17)
    expect(sch[20].closingBalance).toBe(0)
  })

  it('parcelas SEM override mantêm cálculo padrão (amort + juros)', () => {
    const overrides = new Map<number, number>([[56, 2365.59]]) // só #56
    const sch = generateMidLifeSchedule({
      outstandingBalance: 40295.17,
      rateMonthly: 0.0035,
      futureCount: 21,
      startNumber: 56,
      firstDueDate: D('2026-06-26'),
      system: 'SAC',
      amortizationConstant: 1898.69,
      isPostFixed: true,
      paymentOverrides: overrides,
    })
    // #57 sem override → payment calculado (amort + juros pré, sem correção
    // estimada → vira "puro pré")
    expect(sch[1].number).toBe(57)
    expect(sch[1].amortization).toBeCloseTo(1898.69, 2)
    // payment ≈ amort + saldo×i
    expect(sch[1].payment).toBeGreaterThan(sch[1].amortization)
    expect(sch[1].correcao).toBe(0) // sem override + sem estimatedCorrectionMonthly
  })

  it('override = 0 ou ausente → ignora; >0 vence', () => {
    const overrides = new Map<number, number>([[56, 0]]) // 0 = ignorar
    const sch = generateMidLifeSchedule({
      outstandingBalance: 10000,
      rateMonthly: 0.02,
      futureCount: 5,
      startNumber: 56,
      firstDueDate: D('2026-07-01'),
      system: 'SAC',
      amortizationConstant: 2000,
      paymentOverrides: overrides,
    })
    // payment = amort 2000 + juros 200 = 2200 (NÃO o override 0)
    expect(sch[0].payment).toBeCloseTo(2200, 2)
  })
})

// ============================================================================
// 2) Previa UI não recalcula SAC pré-fixado do principal em EM_ANDAMENTO
// ============================================================================
describe('Sprint Fix-Previa — UI', () => {
  const PATH = join(
    __dirname,
    '..',
    'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx',
  )
  const code = readFileSync(PATH, 'utf-8')

  it('preview tem 2 kinds: EM_ANDAMENTO e NOVO', () => {
    expect(code).toMatch(/kind:\s*['"]EM_ANDAMENTO['"]/)
    expect(code).toMatch(/kind:\s*['"]NOVO['"]/)
    expect(code).toMatch(/preview\.kind === 'EM_ANDAMENTO'/)
  })

  it('preview EM_ANDAMENTO usa saldoDevedorAtual + futureCount + amortConstant', () => {
    expect(code).toMatch(/preview\.saldoDevedor/)
    expect(code).toMatch(/preview\.amortConst/)
    expect(code).toMatch(/preview\.futuras/)
  })

  it('preview EM_ANDAMENTO NÃO mostra "Total juros" fixo pra POS', () => {
    // Em EM_ANDAMENTO/POS, mostra "Juros pré (1ª, estimado)" e label sobre CDI
    expect(code).toMatch(/Juros pré \(1ª, estimado\)/)
    expect(code).toMatch(/Não dá pra prever o total|não dá pra prever/i)
    expect(code).toMatch(/varia com o/i)
    expect(code).toMatch(/correção/i)
  })

  it('label menciona CDI/SELIC/IPCA como variável + "só é conhecida quando debita"', () => {
    expect(code).toMatch(/só é conhecida/)
    expect(code).toMatch(/quando a parcela debita/)
    expect(code).toMatch(/spread/i)
  })

  it('UI envia paymentOverrides (líquido = payment - discount) ao salvar', () => {
    expect(code).toMatch(/paymentOverrides/)
    expect(code).toMatch(/p\.discount\s*\?\s*p\.payment\s*-\s*p\.discount\s*:\s*p\.payment/)
  })
})

// ============================================================================
// 3) Endpoint aceita paymentOverrides + propaga pro engine
// ============================================================================
describe('Sprint Fix-Previa — POST /emprestimos aceita paymentOverrides', () => {
  const PATH = join(__dirname, '..', 'app/api/empresas/[id]/emprestimos/route.ts')
  const code = readFileSync(PATH, 'utf-8')

  it('Zod schema MID_LIFE tem paymentOverrides opcional', () => {
    expect(code).toMatch(/paymentOverrides:\s*z[\s\S]*?\.array/)
    expect(code).toMatch(/number:.*z\.coerce\.number/)
    expect(code).toMatch(/payment:.*z\.coerce\.number/)
  })

  it('passa overridesMap pra generateMidLifeSchedule', () => {
    expect(code).toMatch(/new Map\(d\.paymentOverrides\.map/)
    expect(code).toMatch(/paymentOverrides:\s*overridesMap/)
  })
})

// ============================================================================
// 4) lib paymentOverrides type + comportamento
// ============================================================================
describe('Sprint Fix-Previa — lib mid-life-schedule', () => {
  const PATH = join(__dirname, '..', 'lib/loans/mid-life-schedule.ts')
  const code = readFileSync(PATH, 'utf-8')

  it('MidLifeScheduleInput tem paymentOverrides opcional', () => {
    expect(code).toMatch(/paymentOverrides\?:\s*Map<number,\s*number>/)
  })

  it('amortização permanece constante mesmo com override', () => {
    expect(code).toMatch(/amort = isLast \? round2\(saldo\) : amortBase/)
  })

  it('correcao = payment - amort - juros quando override aplicado', () => {
    expect(code).toMatch(/correcao = round2\(payment - amort - juros\)/)
  })
})
