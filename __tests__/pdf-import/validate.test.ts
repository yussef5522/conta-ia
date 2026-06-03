// Sprint PF Fatia 3.5 — Validações (4 camadas).

import { describe, expect, test } from 'vitest'
import { validateExtraction } from '@/lib/pdf-import/validate'
import type { PdfExtractResult } from '@/lib/pdf-import/types'

function baseResult(overrides: Partial<PdfExtractResult> = {}): PdfExtractResult {
  return {
    detectedBank: 'Nubank',
    scanQuality: 'DIGITAL',
    closingDate: '2026-05-14',
    dueDate: '2026-05-20',
    declaredTotal: 1000,
    extractedSum: 1000,
    declaredTxCount: 3,
    confidence: 0.95,
    detectedCardLast4: '1234',
    transactions: [
      { fitid: 'PDF-1', date: '2026-05-01', amount: 500, type: 'DEBIT', memo: 'X', lineConfidence: 0.95 },
      { fitid: 'PDF-2', date: '2026-05-02', amount: 300, type: 'DEBIT', memo: 'Y', lineConfidence: 0.95 },
      { fitid: 'PDF-3', date: '2026-05-03', amount: 200, type: 'DEBIT', memo: 'Z', lineConfidence: 0.95 },
    ],
    warnings: [],
    modelVersion: 'sonnet',
    inputTokens: 100,
    outputTokens: 50,
    costCentsUsdX100: 10,
    ...overrides,
  }
}

describe('Camada 1 — Soma=Total', () => {
  test('soma bate dentro da tolerância → confidence intacta', () => {
    const r = validateExtraction(baseResult({ declaredTotal: 1000.40, extractedSum: 1000 }))
    expect(r.shouldReject).toBe(false)
    expect(r.result.confidence).toBeCloseTo(0.95, 2)
    expect(r.result.warnings).toHaveLength(0)
  })

  test('diferença pequena (<2%) reduz confidence ligeiramente', () => {
    const r = validateExtraction(baseResult({ declaredTotal: 1000, extractedSum: 990 }))
    expect(r.shouldReject).toBe(false)
    expect(r.result.confidence).toBeLessThan(0.95)
    expect(r.result.warnings.some((w) => w.includes('Soma'))).toBe(true)
  })

  test('diferença grande (>10%) reduz confidence muito', () => {
    const r = validateExtraction(baseResult({ declaredTotal: 1000, extractedSum: 800 }))
    expect(r.result.confidence).toBeLessThanOrEqual(0.5)
  })

  test('declaredTotal NULL → warn + penalty leve', () => {
    const r = validateExtraction(baseResult({ declaredTotal: null }))
    expect(r.shouldReject).toBe(false)
    expect(r.result.warnings.some((w) => w.includes('total'))).toBe(true)
  })
})

describe('Camada 2 — Count', () => {
  test('count bate (±1) → ok', () => {
    const r = validateExtraction(baseResult({ declaredTxCount: 4 })) // tem 3
    expect(r.result.warnings.find((w) => w.includes('transações'))).toBeUndefined()
  })

  test('count muito diferente → warn + penalty', () => {
    const r = validateExtraction(baseResult({ declaredTxCount: 10 })) // tem 3
    expect(r.result.warnings.some((w) => w.includes('declara 10'))).toBe(true)
  })
})

describe('Camada 3 — Confidence por linha', () => {
  test('linhas com lineConfidence baixa puxam global pra baixo', () => {
    const r = validateExtraction(
      baseResult({
        transactions: [
          { fitid: 'A', date: '2026-05-01', amount: 100, type: 'DEBIT', memo: 'X', lineConfidence: 0.5 },
          { fitid: 'B', date: '2026-05-02', amount: 100, type: 'DEBIT', memo: 'Y', lineConfidence: 0.5 },
        ],
      }),
    )
    expect(r.result.confidence).toBeLessThan(0.6)
  })
})

describe('Camada 4 — Quality (REJEITA foto de celular)', () => {
  test('MOBILE_PHOTO → REJEITA com mensagem clara', () => {
    const r = validateExtraction(baseResult({ scanQuality: 'MOBILE_PHOTO' }))
    expect(r.shouldReject).toBe(true)
    expect(r.rejectReason).toMatch(/foto/i)
  })

  test('SCANNED_LOW → NÃO rejeita mas penaliza forte + warn', () => {
    const r = validateExtraction(baseResult({ scanQuality: 'SCANNED_LOW' }))
    expect(r.shouldReject).toBe(false)
    expect(r.result.confidence).toBeLessThan(0.6)
    expect(r.result.warnings.some((w) => w.includes('BAIXA'))).toBe(true)
  })

  test('SCANNED_HIGH → penalty leve', () => {
    const r = validateExtraction(baseResult({ scanQuality: 'SCANNED_HIGH', confidence: 0.9 }))
    expect(r.shouldReject).toBe(false)
    expect(r.result.confidence).toBeCloseTo(0.9 * 0.85, 2)
  })

  test('DIGITAL → sem penalty', () => {
    const r = validateExtraction(baseResult({ scanQuality: 'DIGITAL', confidence: 0.9 }))
    expect(r.shouldReject).toBe(false)
    expect(r.result.confidence).toBeCloseTo(0.9, 2)
  })

  test('UNKNOWN → penalty média', () => {
    const r = validateExtraction(baseResult({ scanQuality: 'UNKNOWN', confidence: 0.9 }))
    expect(r.result.confidence).toBeCloseTo(0.9 * 0.7, 2)
  })
})

describe('Confidence final é clamped [0, 1]', () => {
  test('múltiplos penalties não vão abaixo de 0', () => {
    const r = validateExtraction(
      baseResult({
        scanQuality: 'SCANNED_LOW',
        confidence: 0.5,
        declaredTotal: 1000,
        extractedSum: 200,
        declaredTxCount: 20,
      }),
    )
    expect(r.result.confidence).toBeGreaterThanOrEqual(0)
    expect(r.result.confidence).toBeLessThanOrEqual(1)
  })
})
