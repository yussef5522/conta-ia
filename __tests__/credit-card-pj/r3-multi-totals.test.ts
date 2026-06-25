// Sprint Cartao R3 — testa coerce do novo campo totalToPay + ranqueamento
// dos paymentCandidates (matchScore preferindo totalToPay > totalDeclared).

import { describe, it, expect } from 'vitest'
import { coerceInvoiceExtraction } from '@/lib/credit-card-pj/extract'

describe('coerceInvoiceExtraction — totalToPay', () => {
  it('captura totalToPay quando vem na resposta', () => {
    const r = coerceInvoiceExtraction({
      totalDeclared: 2672.63,
      totalToPay: 2654.63,
    })
    expect(r.totalDeclared).toBe(2672.63)
    expect(r.totalToPay).toBe(2654.63)
  })

  it('totalToPay null quando ausente', () => {
    const r = coerceInvoiceExtraction({ totalDeclared: 100 })
    expect(r.totalToPay).toBeNull()
    expect(r.totalDeclared).toBe(100)
  })

  it('coage PT-BR vírgula tambem pra totalToPay', () => {
    const r = coerceInvoiceExtraction({ totalToPay: '2.654,63' })
    expect(r.totalToPay).toBe(2654.63)
  })
})

describe('Score de match (logica do endpoint preview)', () => {
  // Recria a logica de scoring do endpoint pra testar puro
  function scoreCandidate(
    candidateAmount: number,
    candidateIsAlreadyMarked: boolean,
    totalToPay: number | null,
    totalDeclared: number | null,
  ): number {
    let matchScore = 0
    if (totalToPay && totalToPay > 0) {
      const diff = Math.abs(candidateAmount - totalToPay)
      if (diff <= 0.02) matchScore = 1.0
      else if (diff <= 1.0) matchScore = 0.9
    }
    if (matchScore < 0.5 && totalDeclared && totalDeclared > 0) {
      const diff = Math.abs(candidateAmount - totalDeclared)
      if (diff <= 0.02) matchScore = Math.max(matchScore, 0.95)
      else if (diff <= 1.0) matchScore = Math.max(matchScore, 0.85)
    }
    if (candidateIsAlreadyMarked) matchScore = Math.max(matchScore, 0.7)
    return matchScore
  }

  it('match perfeito com totalToPay = 1.0', () => {
    expect(scoreCandidate(2654.63, false, 2654.63, 2672.63)).toBe(1.0)
  })

  it('match perfeito com totalDeclared (sem totalToPay) = 0.95', () => {
    expect(scoreCandidate(2672.63, false, null, 2672.63)).toBe(0.95)
  })

  it('totalToPay tem prioridade sobre totalDeclared (caso real Banrisul)', () => {
    // Banrisul real: totalDeclared (compras+encargos) = 2672.63;
    // totalToPay = 2654.63 (valor que saiu do banco). Pagamento bate
    // EXATAMENTE com totalToPay. matchScore=1.0
    expect(scoreCandidate(2654.63, false, 2654.63, 2672.63)).toBe(1.0)
  })

  it('candidato ja marcado pelo hook = pelo menos 0.7', () => {
    expect(scoreCandidate(999.99, true, 100, 200)).toBe(0.7)
  })

  it('candidato ja marcado + match perfeito = 1.0 (nao reduz)', () => {
    expect(scoreCandidate(2654.63, true, 2654.63, 2672.63)).toBe(1.0)
  })

  it('sem nenhum total = 0 quando nao marcado', () => {
    expect(scoreCandidate(2654.63, false, null, null)).toBe(0)
  })

  it('valor muito diferente = 0', () => {
    expect(scoreCandidate(100, false, 2654.63, 2672.63)).toBe(0)
  })

  it('valor dentro da janela ±1 real (mas nao centavos) = 0.9 / 0.85', () => {
    expect(scoreCandidate(2655.50, false, 2654.63, null)).toBe(0.9)
    expect(scoreCandidate(2673.10, false, null, 2672.63)).toBe(0.85)
  })

  it('banner azul: score >= 0.9 ativa', () => {
    // O banner so aparece com matchScore >= 0.9 (decisao de produto)
    const cases = [
      { amount: 2654.63, totals: [2654.63, 2672.63], expectsBanner: true },  // EXATO totalToPay
      { amount: 2655.50, totals: [2654.63, null], expectsBanner: true },     // proximo
      { amount: 999.99, totals: [null, null], marked: true, expectsBanner: false }, // marcado mas score 0.7
      { amount: 100, totals: [2654.63, null], expectsBanner: false },         // valor errado
    ]
    for (const c of cases) {
      const s = scoreCandidate(c.amount, !!c.marked, c.totals[0], c.totals[1])
      expect(s >= 0.9, `amount=${c.amount}`).toBe(c.expectsBanner)
    }
  })
})
