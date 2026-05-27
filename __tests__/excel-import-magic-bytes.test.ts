// Sprint 5.0.2.3 — Tests pra detectExcelType + isValidExcel.

import { describe, it, expect } from 'vitest'
import {
  detectExcelType,
  isValidExcel,
} from '@/lib/excel-import/magic-bytes'

function bytes(...vals: number[]): Uint8Array {
  return Uint8Array.from(vals)
}

describe('detectExcelType', () => {
  it('XLSX (ZIP signature) → XLSX', () => {
    expect(detectExcelType(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0))).toBe(
      'XLSX',
    )
  })

  it('XLSX (ZIP empty signature) → XLSX', () => {
    expect(detectExcelType(bytes(0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0))).toBe(
      'XLSX',
    )
  })

  it('XLS antigo (OLE2 signature) → XLS', () => {
    expect(
      detectExcelType(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)),
    ).toBe('XLS')
  })

  it('PDF (%PDF-) → INVALID', () => {
    expect(detectExcelType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35))).toBe(
      'INVALID',
    )
  })

  it('PNG → INVALID', () => {
    expect(detectExcelType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      'INVALID',
    )
  })

  it('Texto/CSV → INVALID', () => {
    expect(detectExcelType(bytes(0x46, 0x6f, 0x72, 0x6e, 0x65, 0x63, 0x65))).toBe(
      'INVALID',
    )
  })

  it('Bytes vazios → INVALID', () => {
    expect(detectExcelType(bytes())).toBe('INVALID')
  })

  it('Bytes parciais (3 bytes) → INVALID', () => {
    expect(detectExcelType(bytes(0x50, 0x4b, 0x03))).toBe('INVALID')
  })

  it('Aceita ArrayBuffer', () => {
    const ab = new ArrayBuffer(8)
    new Uint8Array(ab).set([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    expect(detectExcelType(ab)).toBe('XLSX')
  })

  it('Aceita Buffer (Node)', () => {
    expect(
      detectExcelType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])),
    ).toBe('XLSX')
  })
})

describe('isValidExcel', () => {
  it('XLSX bytes → true', () => {
    expect(isValidExcel(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0))).toBe(true)
  })

  it('XLS bytes → true', () => {
    expect(
      isValidExcel(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)),
    ).toBe(true)
  })

  it('PDF → false', () => {
    expect(isValidExcel(bytes(0x25, 0x50, 0x44, 0x46))).toBe(false)
  })

  it('Vazio → false', () => {
    expect(isValidExcel(bytes())).toBe(false)
  })
})
