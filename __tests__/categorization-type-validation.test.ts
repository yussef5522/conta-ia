// Sprint 5.0.2.t — Validação tipo categoria × tipo transação.

import { describe, it, expect } from 'vitest'
import {
  isCategoryCompatibleWithTxType,
  isCacheTipoCompatible,
  expectedCacheTipoTransacao,
} from '@/lib/categorization/type-validation'

describe('isCategoryCompatibleWithTxType — regras principais', () => {
  it('CREDIT (entrada) aceita INCOME', () => {
    expect(isCategoryCompatibleWithTxType('INCOME', 'CREDIT')).toBe(true)
  })

  it('CREDIT (entrada) REJEITA EXPENSE', () => {
    expect(isCategoryCompatibleWithTxType('EXPENSE', 'CREDIT')).toBe(false)
  })

  it('DEBIT (saída) aceita EXPENSE', () => {
    expect(isCategoryCompatibleWithTxType('EXPENSE', 'DEBIT')).toBe(true)
  })

  it('DEBIT (saída) REJEITA INCOME — caso CARLA FABIANA', () => {
    expect(isCategoryCompatibleWithTxType('INCOME', 'DEBIT')).toBe(false)
  })

  it('TRANSFER categoria sempre compatível', () => {
    expect(isCategoryCompatibleWithTxType('TRANSFER', 'CREDIT')).toBe(true)
    expect(isCategoryCompatibleWithTxType('TRANSFER', 'DEBIT')).toBe(true)
    expect(isCategoryCompatibleWithTxType('TRANSFER', 'TRANSFER')).toBe(true)
  })

  it('tx TRANSFER aceita só categoria TRANSFER', () => {
    expect(isCategoryCompatibleWithTxType('TRANSFER', 'TRANSFER')).toBe(true)
    expect(isCategoryCompatibleWithTxType('INCOME', 'TRANSFER')).toBe(false)
    expect(isCategoryCompatibleWithTxType('EXPENSE', 'TRANSFER')).toBe(false)
  })
})

describe('isCategoryCompatibleWithTxType — edge cases', () => {
  it('categoryType null → compatível (legacy/órfã)', () => {
    expect(isCategoryCompatibleWithTxType(null, 'DEBIT')).toBe(true)
    expect(isCategoryCompatibleWithTxType(null, 'CREDIT')).toBe(true)
  })

  it('categoryType undefined → compatível', () => {
    expect(isCategoryCompatibleWithTxType(undefined, 'DEBIT')).toBe(true)
  })

  it('txType desconhecido (não CREDIT/DEBIT/TRANSFER) → não bloqueia (fallback)', () => {
    expect(isCategoryCompatibleWithTxType('EXPENSE', 'CUSTOM_TX')).toBe(true)
  })

  it('categoryType desconhecido em DEBIT/CREDIT → BLOQUEIA (conservador)', () => {
    expect(isCategoryCompatibleWithTxType('CUSTOM_TYPE', 'DEBIT')).toBe(false)
    expect(isCategoryCompatibleWithTxType('CUSTOM_TYPE', 'CREDIT')).toBe(false)
  })
})

describe('expectedCacheTipoTransacao', () => {
  it('CREDIT → INCOME', () => {
    expect(expectedCacheTipoTransacao('CREDIT')).toBe('INCOME')
  })
  it('DEBIT → EXPENSE', () => {
    expect(expectedCacheTipoTransacao('DEBIT')).toBe('EXPENSE')
  })
  it('TRANSFER → ANY', () => {
    expect(expectedCacheTipoTransacao('TRANSFER')).toBe('ANY')
  })
})

describe('isCacheTipoCompatible', () => {
  it('ANY casa qualquer tipo de tx', () => {
    expect(isCacheTipoCompatible('ANY', 'CREDIT')).toBe(true)
    expect(isCacheTipoCompatible('ANY', 'DEBIT')).toBe(true)
  })

  it('INCOME só casa com CREDIT', () => {
    expect(isCacheTipoCompatible('INCOME', 'CREDIT')).toBe(true)
    expect(isCacheTipoCompatible('INCOME', 'DEBIT')).toBe(false)
  })

  it('EXPENSE só casa com DEBIT', () => {
    expect(isCacheTipoCompatible('EXPENSE', 'DEBIT')).toBe(true)
    expect(isCacheTipoCompatible('EXPENSE', 'CREDIT')).toBe(false)
  })
})

describe('regression: bug CARLA FABIANA (DEBIT PIX → Receita Pix)', () => {
  it('Receita Pix (INCOME) NÃO é compatível com PIX_DEB (DEBIT)', () => {
    // Cenário Yussef: "PAGAMENTO PIX-PIX_DEB ... CARLA FABIANA SCHWEIG"
    // tipo = DEBIT (saída). Sistema sugeriu "Receita Pix" (INCOME).
    // Bug deveria ser bloqueado pelo guard.
    expect(isCategoryCompatibleWithTxType('INCOME', 'DEBIT')).toBe(false)
  })
})
