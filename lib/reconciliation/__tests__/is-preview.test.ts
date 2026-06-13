import { describe, it, expect } from 'vitest'
import { isPreviewLine, fitidLooksLikeDate } from '../is-preview'

const D = (s: string) => new Date(`${s}T12:00:00Z`)

describe('fitidLooksLikeDate', () => {
  it('caso real EMPRESTIMO: FITID 260611 + date 2026-06-11 = match', () => {
    expect(fitidLooksLikeDate('260611', D('2026-06-11'))).toBe(true)
  })

  it('FITID com formato diferente NÃO é preview', () => {
    expect(fitidLooksLikeDate('802039', D('2026-06-10'))).toBe(false)
    expect(fitidLooksLikeDate('007842', D('2026-06-11'))).toBe(false)
  })

  it('FITID vazio/undefined retorna false (defensivo)', () => {
    expect(fitidLooksLikeDate(undefined, D('2026-06-11'))).toBe(false)
    expect(fitidLooksLikeDate('', D('2026-06-11'))).toBe(false)
  })

  it('FITID com 6 dígitos que NÃO bate com a data', () => {
    expect(fitidLooksLikeDate('260612', D('2026-06-11'))).toBe(false) // dia errado
    expect(fitidLooksLikeDate('260711', D('2026-06-11'))).toBe(false) // mês errado
    expect(fitidLooksLikeDate('270611', D('2026-06-11'))).toBe(false) // ano errado
  })

  it('FITID não-numérico retorna false', () => {
    expect(fitidLooksLikeDate('ABC123', D('2026-06-11'))).toBe(false)
  })
})

describe('isPreviewLine', () => {
  it('DTPOSTED > DTASOF é preview (agendado futuro)', () => {
    // T4 caso real: PAGAMENTO CARTAO 15/06 com DTASOF 12/06
    const line = { datePosted: D('2026-06-15'), fitid: '100048' }
    expect(isPreviewLine(line, D('2026-06-12'))).toBe(true)
  })

  it('DTPOSTED <= DTASOF e FITID normal NÃO é preview', () => {
    const line = { datePosted: D('2026-06-11'), fitid: '007842' }
    expect(isPreviewLine(line, D('2026-06-12'))).toBe(false)
  })

  it('FITID == YYMMDD da própria data é preview MESMO COM DTPOSTED <= DTASOF', () => {
    // T1 caso real EMPRESTIMO: DTPOSTED 11/06, FITID 260611, DTASOF 12/06
    const line = { datePosted: D('2026-06-11'), fitid: '260611' }
    expect(isPreviewLine(line, D('2026-06-12'))).toBe(true)
  })

  it('mesma data e sem FITID suspeito NÃO é preview', () => {
    const line = { datePosted: D('2026-06-12'), fitid: '999888' }
    expect(isPreviewLine(line, D('2026-06-12'))).toBe(false)
  })
})
