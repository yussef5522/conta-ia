// Sprint Cartao R2 — testes do detector de pagamento de cartao

import { describe, it, expect } from 'vitest'
import { detectCardPayment } from '@/lib/credit-card-pj/payment-detector'

describe('detectCardPayment', () => {
  it('detecta "PAGAMENTO CARTAO DE CREDITO" (caso real Banrisul)', () => {
    const r = detectCardPayment({ description: 'PAGAMENTO CARTAO DE CREDITO', type: 'DEBIT' })
    expect(r.isLikely).toBe(true)
    expect(r.confidence).toBeGreaterThan(0.5)
  })

  it('detecta "PAGAMENTO CARTÃO" com acento', () => {
    expect(detectCardPayment({ description: 'PAGAMENTO CARTÃO', type: 'DEBIT' }).isLikely).toBe(true)
  })

  it('detecta variantes (PGTO, PAGTO, PAG. FATURA)', () => {
    expect(detectCardPayment({ description: 'PGTO. CARTAO', type: 'DEBIT' }).isLikely).toBe(true)
    expect(detectCardPayment({ description: 'PAGTO CARTAO BRADESCO', type: 'DEBIT' }).isLikely).toBe(true)
    expect(detectCardPayment({ description: 'PAG. FATURA NUBANK', type: 'DEBIT' }).isLikely).toBe(true)
  })

  it('NAO detecta CREDIT (mesmo com texto)', () => {
    expect(detectCardPayment({ description: 'PAGAMENTO CARTAO', type: 'CREDIT' }).isLikely).toBe(false)
  })

  it('NAO detecta tx normais', () => {
    expect(detectCardPayment({ description: 'PIX RECEBIDO XPTO', type: 'CREDIT' }).isLikely).toBe(false)
    expect(detectCardPayment({ description: 'MERCADOLIVRE', type: 'DEBIT' }).isLikely).toBe(false)
    expect(detectCardPayment({ description: 'TARIFA TED', type: 'DEBIT' }).isLikely).toBe(false)
  })

  it('NAO detecta estorno / cashback / reembolso', () => {
    expect(detectCardPayment({ description: 'ESTORNO PAGAMENTO CARTAO', type: 'DEBIT' }).isLikely).toBe(false)
    expect(detectCardPayment({ description: 'CASHBACK CARTAO', type: 'DEBIT' }).isLikely).toBe(false)
    expect(detectCardPayment({ description: 'REEMBOLSO FATURA', type: 'DEBIT' }).isLikely).toBe(false)
  })

  it('NAO detecta description vazia', () => {
    expect(detectCardPayment({ description: '', type: 'DEBIT' }).isLikely).toBe(false)
    expect(detectCardPayment({ description: '   ', type: 'DEBIT' }).isLikely).toBe(false)
  })

  it('quando type undefined assume DEBIT', () => {
    const r = detectCardPayment({ description: 'PAGAMENTO CARTAO' })
    expect(r.isLikely).toBe(true)
  })
})
