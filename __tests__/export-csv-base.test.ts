// Sprint Export CSV+PDF (29/05/2026) — Testes CSV base.

import { describe, it, expect } from 'vitest'
import { escapeCsvField, buildCSV } from '@/lib/export/csv/base'

describe('escapeCsvField', () => {
  it('null/undefined → string vazia', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('string simples sem caracteres especiais → não escapa', () => {
    expect(escapeCsvField('IRPJ')).toBe('IRPJ')
    expect(escapeCsvField('100')).toBe('100')
  })

  it('número vira string', () => {
    expect(escapeCsvField(42)).toBe('42')
    expect(escapeCsvField(0)).toBe('0')
    expect(escapeCsvField(-1.5)).toBe('-1.5')
  })

  it('escapa vírgula', () => {
    expect(escapeCsvField('Salários, comissões')).toBe('"Salários, comissões"')
  })

  it('escapa aspas duplicando', () => {
    expect(escapeCsvField('NF "123"')).toBe('"NF ""123"""')
  })

  it('escapa quebra de linha', () => {
    expect(escapeCsvField('linha1\nlinha2')).toBe('"linha1\nlinha2"')
    expect(escapeCsvField('r1\r\nr2')).toBe('"r1\r\nr2"')
  })

  it('escapa ponto-vírgula (Excel BR usa como separador secundário)', () => {
    expect(escapeCsvField('IRPJ; CSLL')).toBe('"IRPJ; CSLL"')
  })
})

describe('buildCSV', () => {
  it('inclui BOM UTF-8 no início', () => {
    const csv = buildCSV(['col1'], [['valor1']])
    expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM
  })

  it('usa vírgula como separador de campo', () => {
    const csv = buildCSV(['A', 'B', 'C'], [['1', '2', '3']])
    expect(csv).toContain('A,B,C')
    expect(csv).toContain('1,2,3')
  })

  it('usa \\r\\n como line ending', () => {
    const csv = buildCSV(['A'], [['1'], ['2']])
    // BOM + header + CRLF + row1 + CRLF + row2
    expect(csv).toBe('﻿A\r\n1\r\n2')
  })

  it('matriz vazia → só header + BOM', () => {
    const csv = buildCSV(['A', 'B'], [])
    expect(csv).toBe('﻿A,B')
  })

  it('escapa campos com vírgula corretamente', () => {
    const csv = buildCSV(
      ['Categoria', 'Valor'],
      [['Salários, comissões', 1000]],
    )
    expect(csv).toContain('"Salários, comissões",1000')
  })

  it('mistura tipos (string, número, null)', () => {
    const csv = buildCSV(
      ['A', 'B', 'C'],
      [['texto', 42, null]],
    )
    expect(csv).toContain('texto,42,')
  })

  it('aceita ReadonlyArray (immutable input)', () => {
    const headers = ['A', 'B'] as const
    const rows: ReadonlyArray<ReadonlyArray<string | number>> = [
      ['x', 1],
      ['y', 2],
    ]
    const csv = buildCSV([...headers], rows)
    expect(csv).toContain('A,B')
    expect(csv).toContain('x,1')
  })
})
