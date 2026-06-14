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

  it('DTASOF NO FUTURO + linha futura vs HOJE → PREVIEW (caso Sicredi 15/06 com DTASOF=30/06, hoje=13/06)', () => {
    // Sicredi declara LEDGERBAL/DTASOF no fim do mês (30/06) mesmo gerando
    // o extrato em 13/06. Linhas de 15/06 são AGENDADAS — devem virar preview.
    const line = { datePosted: D('2026-06-15'), fitid: '22474815379' }
    const dtAsOf = D('2026-06-30') // fim de mês declarado pelo banco
    const today = D('2026-06-13') // HOJE
    expect(isPreviewLine(line, dtAsOf, today)).toBe(true)
  })

  it('DTASOF futuro + linha JÁ ocorrida vs HOJE → NÃO é preview', () => {
    // Linha de 12/06 num extrato com DTASOF 30/06 e HOJE=13/06: é real
    const line = { datePosted: D('2026-06-12'), fitid: '22474815379' }
    expect(isPreviewLine(line, D('2026-06-30'), D('2026-06-13'))).toBe(false)
  })

  it('Sem parâmetro today: usa new Date() implicitamente (backward compatible)', () => {
    // Não dá pra testar valor exato sem mock, mas o cenário onde dtAsOf<<hoje funciona
    const line = { datePosted: D('2026-01-15') }
    // dtAsOf no passado, linha em data próxima do dtAsOf → não preview
    expect(isPreviewLine(line, D('2026-01-31'))).toBe(false)
  })
})
