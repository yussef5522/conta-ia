// Sprint Contract Suffix Fix — testes de integração no caminho REAL
// que o user toca: findLoanInstallmentForTransaction (preview V3) +
// auto-conciliacao (pós-import). Casos reais Sicredi Cacula.

import { describe, it, expect } from 'vitest'
import { findLoanInstallmentForTransaction } from '@/lib/loans/match-contract-in-description'

describe('Sprint Contract Suffix Fix — findLoanInstallmentForTransaction (preview V3)', () => {
  // Cenário REAL Cacula 25/06 — Yussef.
  const C41033828 = {
    id: 'loan-c41033828',
    lender: 'Sicredi',
    contractNumber: 'C41033828-8',
    pendingInstallments: [
      { number: 17, dueDate: '2026-05-25', payment: 10234.35 },
      { number: 18, dueDate: '2026-06-25', payment: 10234.35 },
      { number: 19, dueDate: '2026-07-25', payment: 10234.35 },
    ],
  }
  const C41022227 = {
    id: 'loan-c41022227',
    lender: 'Sicredi',
    contractNumber: 'C41022227-1',
    pendingInstallments: [
      { number: 21, dueDate: '2026-06-15', payment: 7309.38 },
    ],
  }

  it('🎯 C41033828-8: "LIQUIDACAO DE PARCELA-C41033828" R$10.234,35 → parcela 18', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41033828',
        amount: 10234.35,
        type: 'DEBIT',
        date: '2026-06-25',
      },
      [C41033828, C41022227],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('CONTRACT_NUMBER')
    expect(r!.loanLender).toBe('Sicredi')
    expect(r!.loanId).toBe('loan-c41033828')
    expect(r!.installmentNumber).toBe(18)
    expect(r!.contractNumber).toBe('C41033828-8') // valor original preservado
  })

  it('🎯 C41022227-1: "LIQUIDACAO DE PARCELA-C41022227" R$7.309,38 → parcela 21', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41022227',
        amount: 7309.38,
        type: 'DEBIT',
        date: '2026-06-15',
      },
      [C41033828, C41022227],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('CONTRACT_NUMBER')
    expect(r!.loanId).toBe('loan-c41022227')
    expect(r!.installmentNumber).toBe(21)
  })

  it('🎯 não confunde C41022227 com C41033828 (cores diferentes)', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41022227',
        amount: 10234.35, // valor C41033828, mas descricao C41022227
        type: 'DEBIT',
        date: '2026-06-15',
      },
      [C41033828, C41022227],
    )
    // Não casa: valor não bate com qualquer parcela do C41022227
    expect(r).toBeNull()
  })

  it('contrato sem sufixo (Banrisul BNDES) continua funcionando', () => {
    const BNDES = {
      id: 'loan-bndes',
      lender: 'BNDES Banrisul',
      contractNumber: '002100057538834',
      pendingInstallments: [
        { number: 56, dueDate: '2026-06-26', payment: 2365.59, isEstimate: true },
      ],
    }
    const r = findLoanInstallmentForTransaction(
      {
        description: 'EMPRESTIMO 002100057538834',
        amount: 2516.91, // +R$151 vs estimado (pos-fixado)
        type: 'DEBIT',
        date: '2026-06-26',
      },
      [BNDES],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('CONTRACT_NUMBER')
    expect(r!.installmentNumber).toBe(56)
  })

  it('SINAL MEDIO continua funcionando: descricao "EMPRESTIMO" generica + valor + ±3d', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'EMPRESTIMO',
        amount: 10234.35,
        type: 'DEBIT',
        date: '2026-06-26', // d+1 do vencimento parcela 18 (25/06)
      },
      [C41033828],
    )
    expect(r).not.toBeNull()
    expect(r!.matchKind).toBe('AMOUNT_DATE')
  })

  it('rejeita CREDIT (parcela = sempre DEBIT)', () => {
    const r = findLoanInstallmentForTransaction(
      {
        description: 'LIQUIDACAO DE PARCELA-C41033828',
        amount: 10234.35,
        type: 'CREDIT',
        date: '2026-06-25',
      },
      [C41033828],
    )
    expect(r).toBeNull()
  })
})

describe('Sprint Contract Suffix Fix — auto-conciliacao.ts importa helper', () => {
  it('lib/loans/auto-conciliacao.ts usa descriptionMatchesContract', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('lib/loans/auto-conciliacao.ts', 'utf-8')
    // Confirma import + uso do helper
    expect(code).toMatch(/from '\.\/contract-core'/)
    expect(code).toMatch(/descriptionMatchesContract\s*\(\s*tx\.description/)
    // Confirma que a lógica de match POR CONTRATO usa o helper (não mais
    // o normalize+includes local)
    expect(code).not.toMatch(/normalizeForContractMatch\(tx\.description\)\.includes\(contractKey\)/)
  })
})

describe('Sprint Contract Suffix Fix — match-contract-in-description.ts usa helper', () => {
  it('lib/loans/match-contract-in-description.ts usa descriptionMatchesContract', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('lib/loans/match-contract-in-description.ts', 'utf-8')
    expect(code).toMatch(/from '\.\/contract-core'/)
    expect(code).toMatch(/descriptionMatchesContract\(tx\.description, loan\.contractNumber\)/)
    // Confirma que a duplicação local foi removida
    expect(code).not.toMatch(/txDescNorm\.includes\(contractKey\)/)
  })
})
