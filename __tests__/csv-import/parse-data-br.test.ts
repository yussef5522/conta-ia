// Sprint CSV Import (30/05/2026)

import { describe, it, expect } from 'vitest'
import { parseDataBR } from '@/lib/csv-import/parse-data-br'

describe('parseDataBR', () => {
  it('"30/05/2026" → Date UTC midnight 2026-05-30', () => {
    const d = parseDataBR('30/05/2026')
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-05-30T00:00:00.000Z')
  })

  it('"01/01/2026" → 2026-01-01 UTC', () => {
    expect(parseDataBR('01/01/2026')!.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    )
  })

  it('"31/12/2026" → 2026-12-31 UTC (último dia do ano)', () => {
    expect(parseDataBR('31/12/2026')!.toISOString()).toBe(
      '2026-12-31T00:00:00.000Z',
    )
  })

  it('"-" → null', () => {
    expect(parseDataBR('-')).toBeNull()
  })

  it('"" → null', () => {
    expect(parseDataBR('')).toBeNull()
  })

  it('null → null', () => {
    expect(parseDataBR(null)).toBeNull()
  })

  it('whitespace "   " → null', () => {
    expect(parseDataBR('   ')).toBeNull()
  })

  it('"32/01/2026" → null (dia inválido)', () => {
    expect(parseDataBR('32/01/2026')).toBeNull()
  })

  it('"30/13/2026" → null (mês inválido)', () => {
    expect(parseDataBR('30/13/2026')).toBeNull()
  })

  it('"31/02/2026" → null (Fev não tem 31 — round-trip detecta)', () => {
    expect(parseDataBR('31/02/2026')).toBeNull()
  })

  it('"29/02/2024" → válida (ano bissexto)', () => {
    expect(parseDataBR('29/02/2024')!.toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    )
  })

  it('"29/02/2025" → null (não-bissexto)', () => {
    expect(parseDataBR('29/02/2025')).toBeNull()
  })

  it('DD/MM/YY (2 dígitos ano) → null', () => {
    expect(parseDataBR('30/05/26')).toBeNull()
  })

  it('formato US "05/30/2026" → null (mês 30 inválido)', () => {
    expect(parseDataBR('05/30/2026')).toBeNull()
  })

  it('"abc" → null', () => {
    expect(parseDataBR('abc')).toBeNull()
  })

  it('preserva trim — " 30/05/2026 " → 2026-05-30', () => {
    expect(parseDataBR(' 30/05/2026 ')!.toISOString()).toBe(
      '2026-05-30T00:00:00.000Z',
    )
  })
})
