// Sprint OFX V3 R7 — testes da lib de match de contrato em descrição.
// Casos reais Cacula Sicredi + Banrisul BNDES.

import { describe, it, expect } from 'vitest'
import {
  normalizeForContractMatch,
  extractContractCandidatesFromDescription,
  findLoanInstallmentForTransaction,
} from '@/lib/loans/match-contract-in-description'

describe('normalizeForContractMatch', () => {
  it('preserva alfanumerico, remove resto', () => {
    expect(normalizeForContractMatch('LIQUIDACAO DE PARCELA-C41022227'))
      .toBe('liquidacaodeparcelac41022227')
  })
  it('normaliza Banrisul BNDES', () => {
    expect(normalizeForContractMatch('002100057538834')).toBe('002100057538834')
  })
  it('lida com vazio', () => {
    expect(normalizeForContractMatch('')).toBe('')
    expect(normalizeForContractMatch(null as unknown as string)).toBe('')
  })
})

describe('extractContractCandidatesFromDescription', () => {
  it('extrai padrão Sicredi C\\d{8}', () => {
    expect(extractContractCandidatesFromDescription('LIQUIDACAO DE PARCELA-C41022227'))
      .toContain('C41022227')
  })
  it('extrai padrão Banrisul 002100...', () => {
    const out = extractContractCandidatesFromDescription('EMPRESTIMO 002100057538834')
    expect(out).toContain('002100057538834')
  })
})

describe('findLoanInstallmentForTransaction', () => {
  const PRICE = {
    id: 'loan-price',
    lender: 'PRICE Banrisul',
    contractNumber: '002100064956967',
    pendingInstallments: [
      { number: 21, dueDate: '2026-06-12', payment: 4092.02 },
      { number: 22, dueDate: '2026-07-12', payment: 4092.02 },
    ],
  }
  const SICREDI = {
    id: 'loan-sicredi',
    lender: 'Sicredi',
    contractNumber: 'C41022227',
    pendingInstallments: [
      { number: 12, dueDate: '2026-06-15', payment: 7309.38 },
    ],
  }

  it('SINAL FORTE: contrato Sicredi C41022227 na descrição → match imediato', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41022227',
        amount: 7309.38,
        type: 'DEBIT',
        date: '2026-06-15',
      },
      [SICREDI],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('CONTRACT_NUMBER')
    expect(r!.loanLender).toBe('Sicredi')
    expect(r!.installmentNumber).toBe(12)
  })

  it('SINAL FORTE: contrato + janela LARGA (±15d) — vence d+10', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41022227',
        amount: 7309.38,
        type: 'DEBIT',
        date: '2026-06-25', // vence dia 15 — d+10
      },
      [SICREDI],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('CONTRACT_NUMBER')
  })

  it('SINAL MEDIO: descrição genérica EMPRESTIMO + valor exato + d=0 → match', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'EMPRESTIMO',
        amount: 4092.02,
        type: 'DEBIT',
        date: '2026-06-12',
      },
      [PRICE],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('AMOUNT_DATE')
    expect(r!.installmentNumber).toBe(21)
  })

  it('SINAL MEDIO: descrição genérica + d+3 (regra Yussef) → match', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'EMPRESTIMO',
        amount: 4092.02,
        type: 'DEBIT',
        date: '2026-06-15', // vence dia 12 — d+3
      },
      [PRICE],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('AMOUNT_DATE')
  })

  it('SINAL MEDIO: descrição genérica + d+4 → REJEITA (fora janela ±3d)', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'EMPRESTIMO',
        amount: 4092.02,
        type: 'DEBIT',
        date: '2026-06-16',
      },
      [PRICE],
    )
    expect(r).toBeNull()
  })

  it('REJEITA: CREDIT nunca casa empréstimo', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41022227',
        amount: 7309.38,
        type: 'CREDIT',
        date: '2026-06-15',
      },
      [SICREDI],
    )
    expect(r).toBeNull()
  })

  it('REJEITA: descrição sem keyword loan + valor próximo → não infere parcela', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'PAGAMENTO FORNECEDOR LTDA',
        amount: 4092.02,
        type: 'DEBIT',
        date: '2026-06-12',
      },
      [PRICE],
    )
    expect(r).toBeNull()
  })

  it('AMBÍGUO: 2 parcelas mesmo valor mesma data sem contrato → null', () => {
    const dupLoan1 = {
      id: 'l1',
      lender: 'Empréstimo A',
      contractNumber: null,
      pendingInstallments: [{ number: 1, dueDate: '2026-06-12', payment: 1000.00 }],
    }
    const dupLoan2 = {
      id: 'l2',
      lender: 'Empréstimo B',
      contractNumber: null,
      pendingInstallments: [{ number: 1, dueDate: '2026-06-12', payment: 1000.00 }],
    }
    const r = findLoanInstallmentForTransaction(
      { description: 'EMPRESTIMO', amount: 1000.00, type: 'DEBIT', date: '2026-06-12' },
      [dupLoan1, dupLoan2],
    )
    expect(r).toBeNull()
  })

  it('POS-FIXADO: valor 30% acima do planejado + contrato bate → match', () => {
    const posFix = {
      id: 'bndes',
      lender: 'BNDES Banrisul',
      contractNumber: '002100057538834',
      pendingInstallments: [
        { number: 56, dueDate: '2026-06-26', payment: 2365.59, isEstimate: true },
      ],
    }
    const r = findLoanInstallmentForTransaction(
      {
        description: 'EMPRESTIMO 002100057538834',
        amount: 2516.91, // +R$151 vs estimativa
        type: 'DEBIT',
        date: '2026-06-26',
      },
      [posFix],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('CONTRACT_NUMBER')
    expect(r!.amountDiff).toBeCloseTo(151.32, 1)
  })

  it('determinístico: contrato bate em 2 parcelas → mais próximo do vencimento ganha', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'C41022227',
        amount: 7309.38,
        type: 'DEBIT',
        date: '2026-06-14',
      },
      [
        {
          id: 'l',
          lender: 'Test',
          contractNumber: 'C41022227',
          pendingInstallments: [
            { number: 11, dueDate: '2026-05-15', payment: 7309.38 },
            { number: 12, dueDate: '2026-06-15', payment: 7309.38 },
          ],
        },
      ],
    )
    expect(r).not.toBeNull()
    expect(r!.installmentNumber).toBe(12) // d=1 < d=30
  })
})
