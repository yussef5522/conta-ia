// Sprint PF Fatia 3 — detectSpecialTx puros.

import { describe, expect, test } from 'vitest'
import { detectSpecialTx } from '@/lib/ofx-card/detect-special-tx'

describe('detectSpecialTx — Pagamento recebido (CREDIT)', () => {
  test('"Pagamento recebido" + CREDIT → INVOICE_PAYMENT + skip', () => {
    const r = detectSpecialTx('Pagamento recebido', 'CREDIT')
    expect(r.kind).toBe('INVOICE_PAYMENT')
    expect(r.shouldSkipImport).toBe(true)
  })

  test('"Pagamento efetuado" + CREDIT → INVOICE_PAYMENT', () => {
    const r = detectSpecialTx('Pagamento efetuado em 12/08', 'CREDIT')
    expect(r.kind).toBe('INVOICE_PAYMENT')
    expect(r.shouldSkipImport).toBe(true)
  })

  test('"Pagamento recebido" mas DEBIT (caso esquisito) → NULL (não skipa)', () => {
    const r = detectSpecialTx('Pagamento recebido', 'DEBIT')
    expect(r.kind).toBe(null)
    expect(r.shouldSkipImport).toBe(false)
  })
})

describe('detectSpecialTx — Encargos', () => {
  test('"Multa por fatura atrasada" → LATE_FEE', () => {
    const r = detectSpecialTx('Multa por fatura atrasada', 'DEBIT')
    expect(r.kind).toBe('LATE_FEE')
    expect(r.suggestedCategoryHint).toBe('Cartão de crédito')
  })

  test('"IOF por fatura atrasada" → IOF_LATE', () => {
    const r = detectSpecialTx('IOF por fatura atrasada', 'DEBIT')
    expect(r.kind).toBe('IOF_LATE')
    expect(r.isInternational).toBe(false)
  })

  test('"IOF de compra internacional" → IOF_INTL + isInternational=true', () => {
    const r = detectSpecialTx('IOF de compra internacional', 'DEBIT')
    expect(r.kind).toBe('IOF_INTL')
    expect(r.isInternational).toBe(true)
  })

  test('"Valor pendente do mês anterior" → CARRYOVER_PREVIOUS', () => {
    const r = detectSpecialTx('Valor pendente do mês anterior', 'DEBIT')
    expect(r.kind).toBe('CARRYOVER_PREVIOUS')
    expect(r.warnMessage).toContain('rotativo')
  })

  test('"Juros do rotativo" → INTEREST_REVOLVING', () => {
    const r = detectSpecialTx('Juros do rotativo', 'DEBIT')
    expect(r.kind).toBe('INTEREST_REVOLVING')
  })

  test('IOF genérico → IOF_LATE como fallback', () => {
    const r = detectSpecialTx('IOF', 'DEBIT')
    expect(r.kind).toBe('IOF_LATE')
  })
})

describe('detectSpecialTx — compras normais', () => {
  test('"Posto Pitangueira" → kind=null + não skipa', () => {
    const r = detectSpecialTx('Posto Pitangueira', 'DEBIT')
    expect(r.kind).toBe(null)
    expect(r.shouldSkipImport).toBe(false)
  })

  test('"Apple.com/Bill" → kind=null', () => {
    const r = detectSpecialTx('Apple.com/Bill', 'DEBIT')
    expect(r.kind).toBe(null)
  })

  test('"Compra internacional em Amazon US" → kind=null + isInternational=true', () => {
    const r = detectSpecialTx('Amazon US compra internacional', 'DEBIT')
    expect(r.kind).toBe(null)
    expect(r.isInternational).toBe(true)
  })
})

describe('detectSpecialTx — case insensitivity', () => {
  test('"PAGAMENTO RECEBIDO" caps + CREDIT → INVOICE_PAYMENT', () => {
    const r = detectSpecialTx('PAGAMENTO RECEBIDO', 'CREDIT')
    expect(r.kind).toBe('INVOICE_PAYMENT')
  })
  test('"multa por atraso" lower → LATE_FEE', () => {
    const r = detectSpecialTx('multa por atraso', 'DEBIT')
    expect(r.kind).toBe('LATE_FEE')
  })
})
