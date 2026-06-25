// Sprint PDF Extrato Bancário — testes do feature flag

import { describe, it, expect } from 'vitest'
import { checkPdfBankStatementFlag } from '@/lib/pdf-bank-statement/feature-flag'

describe('checkPdfBankStatementFlag', () => {
  it('libera quando PDF_BANK_STATEMENT_ENABLED=true', () => {
    const r = checkPdfBankStatementFlag({
      PDF_BANK_STATEMENT_ENABLED: 'true',
    })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('OK')
  })

  it('bloqueia quando flag não está setada', () => {
    const r = checkPdfBankStatementFlag({})
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('DISABLED')
    expect(r.message).toContain('PDF_BANK_STATEMENT_ENABLED')
  })

  it('bloqueia quando flag=false', () => {
    const r = checkPdfBankStatementFlag({
      PDF_BANK_STATEMENT_ENABLED: 'false',
    })
    expect(r.allowed).toBe(false)
  })

  it('trata espaços e case', () => {
    expect(checkPdfBankStatementFlag({ PDF_BANK_STATEMENT_ENABLED: '  TRUE  ' }).allowed).toBe(true)
    expect(checkPdfBankStatementFlag({ PDF_BANK_STATEMENT_ENABLED: 'True' }).allowed).toBe(true)
    expect(checkPdfBankStatementFlag({ PDF_BANK_STATEMENT_ENABLED: '1' }).allowed).toBe(false) // só "true" exato libera
  })
})
