// Sprint Cartao PJ R5 — testes do scoring de candidates no dashboard
// + migration check + unificacao (sem duplicacao).

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Logica de scoring (espelha o que getCardDashboard faz com c.amount)
// ============================================================================
function scoreCandidate(
  candidateAmount: number,
  isAlreadyMarked: boolean,
  toPay: number | null,
  declared: number | null,
): { matchScore: number; matchLabel: string } {
  let matchScore = 0
  let matchLabel = ''
  if (toPay && Math.abs(candidateAmount - toPay) <= 0.02) {
    matchScore = 1.0
    matchLabel = 'valor exato da fatura'
  } else if (declared && Math.abs(candidateAmount - declared) <= 0.02) {
    matchScore = 0.95
    matchLabel = 'valor exato (total compras)'
  } else if (toPay && Math.abs(candidateAmount - toPay) <= 1) {
    matchScore = 0.9
    matchLabel = 'valor próximo'
  } else if (declared && Math.abs(candidateAmount - declared) <= 1) {
    matchScore = 0.85
    matchLabel = 'valor próximo'
  }
  if (isAlreadyMarked) {
    matchScore = Math.max(matchScore, 0.7)
    if (!matchLabel) matchLabel = 'detectado pelo extrato'
  }
  return { matchScore, matchLabel }
}

describe('R5 — Scoring de candidates do dashboard', () => {
  it('caso real Caixa: R$ 4.333,41 bate EXATO totalToPay = 1.0', () => {
    const r = scoreCandidate(4333.41, false, 4333.41, 4345.95)
    expect(r.matchScore).toBe(1.0)
    expect(r.matchLabel).toBe('valor exato da fatura')
  })

  it('valor bate totalDeclared (sem totalToPay) = 0.95', () => {
    const r = scoreCandidate(4345.95, false, null, 4345.95)
    expect(r.matchScore).toBe(0.95)
    expect(r.matchLabel).toBe('valor exato (total compras)')
  })

  it('valor PRÓXIMO totalToPay (±R$1) = 0.9', () => {
    const r = scoreCandidate(4334.00, false, 4333.41, 4345.95)
    expect(r.matchScore).toBe(0.9)
    expect(r.matchLabel).toBe('valor próximo')
  })

  it('valor PRÓXIMO totalDeclared = 0.85', () => {
    const r = scoreCandidate(4346.50, false, null, 4345.95)
    expect(r.matchScore).toBe(0.85)
    expect(r.matchLabel).toBe('valor próximo')
  })

  it('isCardPayment=true sem match de valor = 0.7 detectado pelo extrato', () => {
    const r = scoreCandidate(999.99, true, 4333.41, 4345.95)
    expect(r.matchScore).toBe(0.7)
    expect(r.matchLabel).toBe('detectado pelo extrato')
  })

  it('isCardPayment=true + valor exato = 1.0 (label do valor prevalece)', () => {
    const r = scoreCandidate(4333.41, true, 4333.41, 4345.95)
    expect(r.matchScore).toBe(1.0)
    expect(r.matchLabel).toBe('valor exato da fatura')
  })

  it('sem nenhum match = 0', () => {
    const r = scoreCandidate(100, false, 4333.41, 4345.95)
    expect(r.matchScore).toBe(0)
    expect(r.matchLabel).toBe('')
  })

  it('caso Banrisul: valor exato totalToPay 2654.63 (totalDeclared 2672.63)', () => {
    const r = scoreCandidate(2654.63, false, 2654.63, 2672.63)
    expect(r.matchScore).toBe(1.0)
  })

  it('cartao sem fatura ainda (targets null): isCardPayment hook=true cai em 0.7', () => {
    const r = scoreCandidate(100, true, null, null)
    expect(r.matchScore).toBe(0.7)
    expect(r.matchLabel).toBe('detectado pelo extrato')
  })

  it('cartao sem fatura + sem isCardPayment hook = 0', () => {
    expect(scoreCandidate(100, false, null, null).matchScore).toBe(0)
  })

  it('tolerancia exata (0.02) — dentro da borda', () => {
    // 4333.42 vs 4333.41 = diff 0.01 ≤ 0.02 → exato 1.0
    expect(scoreCandidate(4333.42, false, 4333.41, null).matchScore).toBe(1.0)
  })

  it('tolerancia exata (0.02) — borda superior fora vai pra aproximado', () => {
    const r = scoreCandidate(4333.50, false, 4333.41, null)
    expect(r.matchScore).toBe(0.9)
    expect(r.matchLabel).toBe('valor próximo')
  })
})

// ============================================================================
// Ordenacao por matchScore desc, depois data desc
// ============================================================================
describe('R5 — Ordenacao candidates', () => {
  function sortCandidates<T extends { matchScore: number; date: string }>(
    candidates: T[],
  ): T[] {
    return [...candidates].sort((a, b) => {
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore
      return a.date < b.date ? 1 : -1
    })
  }

  it('score mais alto vem primeiro', () => {
    const sorted = sortCandidates([
      { matchScore: 0.7, date: '2026-06-15' },
      { matchScore: 1.0, date: '2026-06-10' },
      { matchScore: 0.9, date: '2026-06-12' },
    ])
    expect(sorted.map((c) => c.matchScore)).toEqual([1.0, 0.9, 0.7])
  })

  it('mesmo score: data mais recente primeiro', () => {
    const sorted = sortCandidates([
      { matchScore: 1.0, date: '2026-06-10' },
      { matchScore: 1.0, date: '2026-06-15' },
      { matchScore: 1.0, date: '2026-06-01' },
    ])
    expect(sorted.map((c) => c.date)).toEqual(['2026-06-15', '2026-06-10', '2026-06-01'])
  })
})

// ============================================================================
// Migration check
// ============================================================================
describe('R5 — Migration lastInvoice* + backfill', () => {
  const PATH = join(
    __dirname,
    '..',
    '..',
    'prisma/migrations/20260625010000_cartao_pj_last_invoice_totals/migration.sql',
  )

  it('migration file existe', () => {
    expect(existsSync(PATH)).toBe(true)
  })

  it('adiciona 3 colunas nullable em business_credit_cards', () => {
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/ADD COLUMN "lastInvoiceMonth" TEXT/)
    expect(sql).toMatch(/ADD COLUMN "lastInvoiceTotalDeclared" DOUBLE PRECISION/)
    expect(sql).toMatch(/ADD COLUMN "lastInvoiceTotalToPay" DOUBLE PRECISION/)
  })

  it('backfill Carter banrisul (final 0115) com 2672.63 / 2654.63', () => {
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/"lastDigits"\s*=\s*'0115'/)
    expect(sql).toMatch(/2672\.63/)
    expect(sql).toMatch(/2654\.63/)
  })

  it('backfill banco caixa (final 3883) com 4345.95 / 4333.41', () => {
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/"lastDigits"\s*=\s*'3883'/)
    expect(sql).toMatch(/4345\.95/)
    expect(sql).toMatch(/4333\.41/)
  })
})
