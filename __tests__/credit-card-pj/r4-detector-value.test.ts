// Sprint Cartao PJ R4 — testes do detector por VALOR + payment-detector estendido

import { describe, it, expect } from 'vitest'
import { detectCardPayment } from '@/lib/credit-card-pj/payment-detector'

describe('detectCardPayment — patterns R4 estendidos', () => {
  it('detecta "LIQUIDACAO BOLETO 00360305000104 CARTOES" (caso real Caixa)', () => {
    const r = detectCardPayment({
      description: 'LIQUIDACAO BOLETO-          00360305000104 CARTOES',
      type: 'DEBIT',
    })
    expect(r.isLikely).toBe(true)
  })

  it('detecta "LIQUIDAÇÃO DE BOLETO CARTÃO" com acento', () => {
    expect(
      detectCardPayment({ description: 'LIQUIDAÇÃO DE BOLETO CARTÃO', type: 'DEBIT' }).isLikely,
    ).toBe(true)
  })

  it('detecta "BOLETO CARTOES"', () => {
    expect(detectCardPayment({ description: 'BOLETO CARTOES', type: 'DEBIT' }).isLikely).toBe(true)
  })

  it('NAO detecta boleto generico (sem cartao/cartoes)', () => {
    expect(detectCardPayment({ description: 'BOLETO DAS LOJAS X', type: 'DEBIT' }).isLikely).toBe(false)
  })

  it('caso real Banrisul (R2 mantido funcionando)', () => {
    expect(
      detectCardPayment({ description: 'PAGAMENTO CARTAO DE CREDITO', type: 'DEBIT' }).isLikely,
    ).toBe(true)
  })

  it('NAO detecta CREDIT (entrada nao eh pagamento)', () => {
    expect(detectCardPayment({ description: 'LIQUIDACAO BOLETO CARTOES', type: 'CREDIT' }).isLikely).toBe(false)
  })
})

// ============================================================================
// Logica do detector da QUERY: valor EXATO sozinho basta; valor APROXIMADO
// exige descricao parecida (anti falso-positivo)
// ============================================================================
describe('Logica de candidato no findCardPaymentCandidatesInBank R4', () => {
  // Recria a regra do OR clauses pra teste puro
  type Candidate = { amount: number; descMatchesRegex: boolean; isCardPayment: boolean }

  function isCandidate(
    c: Candidate,
    totalsFatura: number[],
    tol = 1,
    exact = 0.02,
  ): boolean {
    // (c) ja marcadas pelo hook OFX
    if (c.isCardPayment) return true
    if (totalsFatura.length === 0) return false
    // (a) valor EXATO sozinho basta
    for (const t of totalsFatura) {
      if (Math.abs(c.amount - t) <= exact) return true
    }
    // (b) valor APROXIMADO + descricao parece pagamento
    if (c.descMatchesRegex) {
      for (const t of totalsFatura) {
        if (Math.abs(c.amount - t) <= tol) return true
      }
    }
    return false
  }

  it('VALOR EXATO sozinho disparа candidato (caso Caixa R$4.333,41)', () => {
    expect(
      isCandidate(
        { amount: 4333.41, descMatchesRegex: false, isCardPayment: false },
        [4333.41, 4345.95],
      ),
    ).toBe(true)
  })

  it('VALOR EXATO ate em conta diferente (pagamento Sicredi pra fatura Caixa)', () => {
    // valor bate exato, mas a descricao "LIQUIDACAO BOLETO CARTOES" antes nao
    // batia o regex antigo. Agora, valor exato sozinho basta.
    expect(
      isCandidate(
        { amount: 4333.41, descMatchesRegex: false, isCardPayment: false },
        [4333.41],
      ),
    ).toBe(true)
  })

  it('valor APROXIMADO sem regex NAO eh candidato (anti FP)', () => {
    // Valor R$ 4.334 (diff R$ 0,59) sem descricao parecida -> NAO candidato
    expect(
      isCandidate(
        { amount: 4334.00, descMatchesRegex: false, isCardPayment: false },
        [4333.41],
      ),
    ).toBe(false)
  })

  it('valor APROXIMADO + descricao parecida = candidato', () => {
    expect(
      isCandidate(
        { amount: 4334.00, descMatchesRegex: true, isCardPayment: false },
        [4333.41],
      ),
    ).toBe(true)
  })

  it('isCardPayment=true ja marcado pelo hook = sempre candidato (qq valor)', () => {
    expect(
      isCandidate(
        { amount: 100, descMatchesRegex: false, isCardPayment: true },
        [4333.41],
      ),
    ).toBe(true)
  })

  it('isCardPayment=true sem targets ainda eh candidato', () => {
    expect(
      isCandidate(
        { amount: 100, descMatchesRegex: false, isCardPayment: true },
        [],
      ),
    ).toBe(true)
  })

  it('sem nenhum dos 3 sinais -> NAO candidato', () => {
    expect(
      isCandidate(
        { amount: 100, descMatchesRegex: false, isCardPayment: false },
        [4333.41],
      ),
    ).toBe(false)
  })

  it('caso Banrisul R$ 2.654,63 (R3 mantido)', () => {
    expect(
      isCandidate(
        { amount: 2654.63, descMatchesRegex: true, isCardPayment: false },
        [2672.63, 2654.63],
      ),
    ).toBe(true)
  })

  it('valor proximo a UMA das targets (totalToPay) e nao outra (totalDeclared)', () => {
    expect(
      isCandidate(
        { amount: 2654.63, descMatchesRegex: false, isCardPayment: false },
        [2672.63, 2654.63],
      ),
    ).toBe(true) // bate exato com 2a target
  })
})

// ============================================================================
// invoiceMonth: capture do dueDate no confirm
// ============================================================================
describe('invoiceMonth: extracao do dueDate', () => {
  function extractInvoiceMonth(dueDate: string | null | undefined): string | null {
    return dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate.slice(0, 7) : null
  }

  it('extrai YYYY-MM do dueDate 2026-06-12 (Caixa)', () => {
    expect(extractInvoiceMonth('2026-06-12')).toBe('2026-06')
  })

  it('extrai YYYY-MM do dueDate 2026-06-15 (Banrisul)', () => {
    expect(extractInvoiceMonth('2026-06-15')).toBe('2026-06')
  })

  it('null quando dueDate ausente', () => {
    expect(extractInvoiceMonth(null)).toBeNull()
    expect(extractInvoiceMonth(undefined)).toBeNull()
  })

  it('null quando formato invalido', () => {
    expect(extractInvoiceMonth('06/2026')).toBeNull()
    expect(extractInvoiceMonth('2026-6-1')).toBeNull()
    expect(extractInvoiceMonth('hoje')).toBeNull()
  })
})

// ============================================================================
// Migration check
// ============================================================================
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Sprint R4 — migration invoiceMonth', () => {
  const PATH = join(
    __dirname,
    '..',
    '..',
    'prisma/migrations/20260625000000_cartao_pj_invoice_month/migration.sql',
  )

  it('migration file existe', () => {
    expect(existsSync(PATH)).toBe(true)
  })

  it('adiciona coluna invoiceMonth nullable', () => {
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/ALTER TABLE "transactions" ADD COLUMN "invoiceMonth" TEXT/)
  })

  it('cria indice (businessCreditCardId, invoiceMonth)', () => {
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/CREATE INDEX[\s\S]+"businessCreditCardId"[\s\S]+"invoiceMonth"/)
  })

  it('inclui backfill 2026-06 pra tx existentes', () => {
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/UPDATE\s+"transactions"\s+SET\s+"invoiceMonth"\s*=\s*'2026-06'/i)
    expect(sql).toMatch(/"businessCreditCardId"\s+IS\s+NOT\s+NULL/i)
    expect(sql).toMatch(/"isCardPayment"\s*=\s*false/i)
  })
})
