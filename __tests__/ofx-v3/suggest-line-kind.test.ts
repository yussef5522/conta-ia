// Sprint OFX V3 — testes da IA que sugere kind + explica

import { describe, it, expect } from 'vitest'
import { suggestLineKind, confidencePillVisual } from '@/lib/ofx-v3/suggest-line-kind'

describe('suggestLineKind', () => {
  it('PAGAMENTO_CARTAO alta confiança quando cardPaymentLikely+cardCandidate', () => {
    const r = suggestLineKind({
      description: 'PAGAMENTO CARTAO DE CREDITO',
      type: 'DEBIT',
      amount: 2654.63,
      cardPaymentLikely: true,
      cardCandidate: { id: 'card-1', name: 'Banrisul' },
    })
    expect(r.suggestedKind).toBe('PAGAMENTO_CARTAO')
    expect(r.confidence).toBe('ALTA')
    expect(r.reason).toContain('Banrisul')
    expect(r.suggestedCardId).toBe('card-1')
  })

  it('PAGAMENTO_CARTAO confiança média quando não sabe o cartão', () => {
    const r = suggestLineKind({
      description: 'PAGAMENTO CARTAO',
      type: 'DEBIT',
      amount: 100,
      cardPaymentLikely: true,
    })
    expect(r.suggestedKind).toBe('PAGAMENTO_CARTAO')
    expect(r.confidence).toBe('MEDIA')
    expect(r.suggestedCardId).toBeNull()
  })

  it('PAGAMENTO_EMPRESTIMO ALTA quando valor bate exato + data no dia', () => {
    const r = suggestLineKind({
      description: 'EMPRESTIMO',
      type: 'DEBIT',
      amount: 2365.59,
      loanInstallmentCandidate: {
        loanLender: 'Banrisul',
        contractNumber: '002100057538834',
        installmentNumber: 56,
        plannedAmount: 2365.59,
        daysFromDueDate: 0,
      },
    })
    expect(r.suggestedKind).toBe('PAGAMENTO_EMPRESTIMO')
    expect(r.confidence).toBe('ALTA')
    expect(r.reason).toContain('56')
    expect(r.suggestedInstallmentNumber).toBe(56)
  })

  it('PAGAMENTO_EMPRESTIMO MEDIA quando valor divergente <=10% (caso BNDES pos-fixado)', () => {
    // Caso real: tx R$ 2.516,91 vs parcela R$ 2.365,59 = diff R$ 151,32 (6.4% > 5%)
    const r = suggestLineKind({
      description: 'EMPRESTIMO',
      type: 'DEBIT',
      amount: 2516.91,
      loanInstallmentCandidate: {
        loanLender: 'Banrisul',
        contractNumber: '002100057538834',
        installmentNumber: 56,
        plannedAmount: 2365.59,
        daysFromDueDate: 0,
      },
    })
    expect(r.suggestedKind).toBe('PAGAMENTO_EMPRESTIMO')
    expect(r.confidence).toBe('MEDIA')
    expect(r.reason).toContain('correção pós-fixada')
  })

  it('TRANSFER ALTA quando tem par + confiança alta', () => {
    const r = suggestLineKind({
      description: 'PIX ENVIADO',
      type: 'DEBIT',
      amount: 1000,
      transferDetected: { confidence: 0.92, hasPair: true, keyword: 'PIX' },
    })
    expect(r.suggestedKind).toBe('TRANSFER')
    expect(r.confidence).toBe('ALTA')
  })

  it('TRANSFER AGUARDA_PAR quando keyword PIX mas sem par ainda', () => {
    const r = suggestLineKind({
      description: 'PIX ENVIADO',
      type: 'DEBIT',
      amount: 5500,
      transferDetected: { confidence: 0.50, hasPair: false, keyword: 'PIX' },
    })
    expect(r.suggestedKind).toBe('TRANSFER')
    expect(r.confidence).toBe('AGUARDA_PAR')
    expect(r.reason).toContain('aguarda')
  })

  it('RECEITA ALTA quando CREDIT + predictedConfidence >= 0.95', () => {
    const r = suggestLineKind({
      description: 'DEBITO STONE LIQUIDACAO',
      type: 'CREDIT',
      amount: 5000,
      predictedCategoryId: 'cat-receita',
      predictedCategoryName: 'Receita de Vendas',
      predictedConfidence: 0.95,
      predictedRulePattern: 'DEBITO STONE',
    })
    expect(r.suggestedKind).toBe('RECEITA')
    expect(r.confidence).toBe('ALTA')
    expect(r.suggestedCategoryId).toBe('cat-receita')
    expect(r.reason).toContain('Receita de Vendas')
  })

  it('RECEITA BAIXA quando CREDIT sem predict', () => {
    const r = suggestLineKind({
      description: 'DEPOSITO MISTERIOSO',
      type: 'CREDIT',
      amount: 100,
    })
    expect(r.suggestedKind).toBe('RECEITA')
    expect(r.confidence).toBe('BAIXA')
  })

  it('DESPESA quando DEBIT sem nenhuma pista', () => {
    const r = suggestLineKind({
      description: 'COMPRA ALEATORIA',
      type: 'DEBIT',
      amount: 50,
    })
    expect(r.suggestedKind).toBe('DESPESA')
    expect(r.confidence).toBe('BAIXA')
  })

  it('PAGAMENTO_CARTAO tem prioridade sobre RECEITA/DESPESA', () => {
    const r = suggestLineKind({
      description: 'PAGAMENTO CARTAO',
      type: 'DEBIT',
      amount: 100,
      cardPaymentLikely: true,
      predictedCategoryId: 'cat-x',
    })
    expect(r.suggestedKind).toBe('PAGAMENTO_CARTAO')
  })
})

describe('confidencePillVisual', () => {
  it('ALTA → emerald + label "tenho certeza"', () => {
    const v = confidencePillVisual('ALTA')
    expect(v.tone).toBe('emerald')
    expect(v.label).toBe('tenho certeza')
  })
  it('MEDIA → amber + label "confira"', () => {
    expect(confidencePillVisual('MEDIA').tone).toBe('amber')
  })
  it('AGUARDA_PAR → blue', () => {
    expect(confidencePillVisual('AGUARDA_PAR').tone).toBe('blue')
  })
  it('BAIXA → slate', () => {
    expect(confidencePillVisual('BAIXA').tone).toBe('slate')
  })
})
