import { describe, it, expect } from 'vitest'
import {
  CashValidationError,
  isCashAccount,
  normalizeAndValidateCashAccount,
  CASH_KIND_VALUES,
} from '@/lib/contas-bancarias/cash-validate'

const baseCash = {
  accountType: 'CASH',
  allowNegativeBalance: false,
  creditLimit: 0,
  cashKind: null,
}

describe('isCashAccount', () => {
  it('detecta CASH', () => {
    expect(isCashAccount('CASH')).toBe(true)
  })
  it('outras contas não são CASH', () => {
    expect(isCashAccount('CHECKING')).toBe(false)
    expect(isCashAccount('SAVINGS')).toBe(false)
    expect(isCashAccount(null)).toBe(false)
    expect(isCashAccount(undefined)).toBe(false)
  })
})

describe('normalizeAndValidateCashAccount — CHECKING/SAVINGS', () => {
  it('CHECKING não força nada — retorna intocado', () => {
    const input = {
      accountType: 'CHECKING',
      allowNegativeBalance: true,
      creditLimit: 600000,
      cashKind: null,
      bankName: 'Banrisul',
      bankCode: '041',
    }
    expect(normalizeAndValidateCashAccount(input)).toEqual(input)
  })
  it('SAVINGS sem cashKind passa', () => {
    const input = { ...baseCash, accountType: 'SAVINGS', cashKind: null }
    expect(() => normalizeAndValidateCashAccount(input)).not.toThrow()
  })
  it('cashKind preenchido em CHECKING → rejeita', () => {
    const input = {
      accountType: 'CHECKING',
      allowNegativeBalance: true,
      creditLimit: 0,
      cashKind: 'MAIN',
    }
    expect(() => normalizeAndValidateCashAccount(input)).toThrow(CashValidationError)
    try {
      normalizeAndValidateCashAccount(input)
    } catch (err) {
      expect((err as CashValidationError).code).toBe('CASH_KIND_ONLY_FOR_CASH')
    }
  })
})

describe('normalizeAndValidateCashAccount — CASH', () => {
  it('CASH com allowNegativeBalance=true → REJEITA (regra contábil)', () => {
    const input = { ...baseCash, allowNegativeBalance: true }
    expect(() => normalizeAndValidateCashAccount(input)).toThrow(CashValidationError)
    try {
      normalizeAndValidateCashAccount(input)
    } catch (err) {
      expect((err as CashValidationError).code).toBe('CASH_CANNOT_BE_NEGATIVE')
    }
  })

  it('CASH com creditLimit > 0 → REJEITA (sem cheque especial)', () => {
    const input = { ...baseCash, creditLimit: 1000 }
    expect(() => normalizeAndValidateCashAccount(input)).toThrow(CashValidationError)
    try {
      normalizeAndValidateCashAccount(input)
    } catch (err) {
      expect((err as CashValidationError).code).toBe('CASH_NO_CREDIT_LIMIT')
    }
  })

  it('CASH com cashKind inválido → REJEITA', () => {
    const input = { ...baseCash, cashKind: 'BOGUS' }
    expect(() => normalizeAndValidateCashAccount(input)).toThrow(CashValidationError)
    try {
      normalizeAndValidateCashAccount(input)
    } catch (err) {
      expect((err as CashValidationError).code).toBe('CASH_KIND_INVALID')
    }
  })

  it('CASH sem cashKind → normaliza pra MAIN (default no MVP)', () => {
    const result = normalizeAndValidateCashAccount(baseCash)
    expect(result.cashKind).toBe('MAIN')
  })

  it('CASH com PETTY/PDV_TERMINAL → aceita', () => {
    for (const kind of CASH_KIND_VALUES) {
      const input = { ...baseCash, cashKind: kind }
      const result = normalizeAndValidateCashAccount(input)
      expect(result.cashKind).toBe(kind)
    }
  })

  it('CASH ZERA campos bancários mesmo se passar valores', () => {
    const input = {
      ...baseCash,
      bankName: 'Banrisul',
      bankCode: '041',
      agency: '0001',
      accountNumber: '12345-6',
      pluggyItemId: 'item123',
      pluggyAccountId: 'acc456',
    }
    const result = normalizeAndValidateCashAccount(input)
    expect(result.bankName).toBeNull()
    expect(result.bankCode).toBeNull()
    expect(result.agency).toBeNull()
    expect(result.accountNumber).toBeNull()
    expect(result.pluggyItemId).toBeNull()
    expect(result.pluggyAccountId).toBeNull()
  })

  it('CASH FORÇA allowNegativeBalance=false e creditLimit=0', () => {
    const result = normalizeAndValidateCashAccount(baseCash)
    expect(result.allowNegativeBalance).toBe(false)
    expect(result.creditLimit).toBe(0)
  })

  it('CASH preserva lowBalanceThreshold se passado (alerta IA)', () => {
    const input = { ...baseCash, lowBalanceThreshold: 100 }
    const result = normalizeAndValidateCashAccount(input)
    expect(result.lowBalanceThreshold).toBe(100)
  })
})
