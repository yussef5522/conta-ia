// Sprint PF Fatia 3.5 — feature-flag (gate de produção + ZDR).

import { describe, expect, test } from 'vitest'
import { checkPdfImportFlag } from '@/lib/pdf-import/feature-flag'

describe('checkPdfImportFlag — gate básico', () => {
  test('PDF_IMPORT_ENABLED=false → DISABLED', () => {
    const r = checkPdfImportFlag({ PDF_IMPORT_ENABLED: 'false' })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('DISABLED')
  })

  test('PDF_IMPORT_ENABLED ausente → DISABLED (closed by default)', () => {
    const r = checkPdfImportFlag({})
    expect(r.allowed).toBe(false)
  })

  test('PDF_IMPORT_ENABLED=true em dev → allowed (sem exigir ZDR)', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'development',
      PDF_IMPORT_ENABLED: 'true',
    })
    expect(r.allowed).toBe(true)
  })

  test('PDF_IMPORT_ENABLED=true em test → allowed (sem exigir ZDR)', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'test',
      PDF_IMPORT_ENABLED: 'true',
    })
    expect(r.allowed).toBe(true)
  })
})

describe('checkPdfImportFlag — produção exige ZDR', () => {
  test('production + ENABLED + ZDR=false → ZDR_NOT_CONFIRMED', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'production',
      PDF_IMPORT_ENABLED: 'true',
      PDF_IMPORT_ZDR_CONFIRMED: 'false',
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('ZDR_NOT_CONFIRMED')
  })

  test('production + ENABLED + ZDR=true → allowed', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'production',
      PDF_IMPORT_ENABLED: 'true',
      PDF_IMPORT_ZDR_CONFIRMED: 'true',
    })
    expect(r.allowed).toBe(true)
  })

  test('production + ENABLED + ZDR ausente → ZDR_NOT_CONFIRMED', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'production',
      PDF_IMPORT_ENABLED: 'true',
    })
    expect(r.allowed).toBe(false)
  })

  test('production + ENABLED=false → DISABLED (ignora ZDR)', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'production',
      PDF_IMPORT_ENABLED: 'false',
      PDF_IMPORT_ZDR_CONFIRMED: 'true',
    })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.reason).toBe('DISABLED')
  })

  test('case-insensitive: "TRUE" também conta', () => {
    const r = checkPdfImportFlag({
      NODE_ENV: 'production',
      PDF_IMPORT_ENABLED: 'TRUE',
      PDF_IMPORT_ZDR_CONFIRMED: 'TRUE',
    })
    expect(r.allowed).toBe(true)
  })
})
