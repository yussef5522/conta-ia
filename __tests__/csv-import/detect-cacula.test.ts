// Sprint CSV Import (30/05/2026)

import { describe, it, expect } from 'vitest'
import { CACULA_HEADERS, isCaculaHeader } from '@/lib/csv-import/detect-cacula'

describe('isCaculaHeader', () => {
  it('header CACULA exato (20 campos) → true', () => {
    expect(isCaculaHeader([...CACULA_HEADERS])).toBe(true)
  })

  it('header CACULA + trailing "" (21º campo vazio do CSV) → true', () => {
    expect(isCaculaHeader([...CACULA_HEADERS, ''])).toBe(true)
  })

  it('header CACULA case-insensitive → true', () => {
    const lower = CACULA_HEADERS.map((h) => h.toLowerCase())
    expect(isCaculaHeader([...lower])).toBe(true)
  })

  it('header CACULA com whitespace extra → true', () => {
    const padded = CACULA_HEADERS.map((h) => `  ${h}  `)
    expect(isCaculaHeader([...padded])).toBe(true)
  })

  it('header com 1 coluna a menos → false (estrito)', () => {
    expect(isCaculaHeader(CACULA_HEADERS.slice(0, 19))).toBe(false)
  })

  it('header com 1 coluna extra (não vazia) → false', () => {
    expect(isCaculaHeader([...CACULA_HEADERS, 'EXTRA_COLUMN'])).toBe(false)
  })

  it('header com mesmas colunas mas em ordem diferente → false', () => {
    const swapped: string[] = [...CACULA_HEADERS]
    ;[swapped[1], swapped[2]] = [swapped[2], swapped[1]]
    expect(isCaculaHeader(swapped)).toBe(false)
  })

  it('header genérico Excel (Fornecedor, Valor, etc) → false', () => {
    expect(
      isCaculaHeader([
        'Fornecedor',
        'Valor',
        'Vencimento',
        'Pagamento',
        'Status',
      ]),
    ).toBe(false)
  })

  it('header vazio → false', () => {
    expect(isCaculaHeader([])).toBe(false)
  })

  it('header com 1 nome ligeiramente diferente ("OBS" vs "OBS.") → false', () => {
    const variant: string[] = [...CACULA_HEADERS]
    variant[variant.length - 1] = 'OBS' // falta o ponto
    expect(isCaculaHeader(variant)).toBe(false)
  })

  it('CACULA_HEADERS tem exatamente 20 campos', () => {
    expect(CACULA_HEADERS).toHaveLength(20)
  })
})
