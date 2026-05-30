// Sprint CSV Import (30/05/2026)

import { describe, it, expect } from 'vitest'
import { isValidCsv, isValidExcel } from '@/lib/excel-import/magic-bytes'

function buf(s: string): Buffer {
  return Buffer.from(s, 'utf8')
}

describe('isValidCsv', () => {
  it('CSV simples ASCII → true', () => {
    expect(isValidCsv(buf('A;B;C\n1;2;3'))).toBe(true)
  })

  it('CSV com BOM UTF-8 → true', () => {
    expect(isValidCsv(buf('﻿A;B\n1;2'))).toBe(true)
  })

  it('CSV com acentos UTF-8 → true', () => {
    expect(isValidCsv(buf('Nome;Cidade\nGRÁFICAS;SÃO PAULO'))).toBe(true)
  })

  it('CSV com CRLF → true', () => {
    expect(isValidCsv(buf('A;B\r\n1;2'))).toBe(true)
  })

  it('buffer vazio → false', () => {
    expect(isValidCsv(new Uint8Array(0))).toBe(false)
  })

  it('XLSX disfarçado de CSV → false', () => {
    const xlsxHead = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
    expect(isValidCsv(xlsxHead)).toBe(false)
  })

  it('XLS antigo disfarçado de CSV → false', () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    expect(isValidCsv(xls)).toBe(false)
  })

  it('PDF disfarçado de CSV → false', () => {
    const pdf = Buffer.from('%PDF-1.4\nfoo')
    expect(isValidCsv(pdf)).toBe(false)
  })

  it('binário com NUL → false', () => {
    const bin = new Uint8Array([0x41, 0x00, 0x42, 0x43])
    expect(isValidCsv(bin)).toBe(false)
  })

  it('mistura de XLSX magic + acentos não engana → false', () => {
    const buffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      buf('Nome;Cidade'),
    ])
    expect(isValidCsv(buffer)).toBe(false)
  })

  it('isValidExcel rejeita CSV puro (sanity)', () => {
    expect(isValidExcel(buf('A;B\n1;2'))).toBe(false)
  })
})
