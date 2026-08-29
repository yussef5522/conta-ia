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

  // ⛔ REGRA DERRUBADA POR EVIDÊNCIA (28/08/2026). Este teste afirmava que FITID YYMMDD
  // tornava a linha PREVIEW mesmo com DTPOSTED <= DTASOF. A regra nasceu deste caso de
  // 11/06 e depois escondeu DÉBITO REAL de empréstimo DUAS vezes (4.092,02 em 13/08 ·
  // 2.444,62 em 28/08); nas duas o saldo declarado pelo banco provou que tinha liquidado.
  // Todo FITID do Banrisul tem 6 dígitos e nas linhas de empréstimo o banco usa a DATA
  // como id: convenção de IDENTIFICADOR, não estado do lançamento. Quem decide é o SALDO.
  // Detalhe em lib/ofx/__tests__/fitid-nao-descarta-emprestimo.test.ts.
  it('FITID == YYMMDD com DTPOSTED <= DTASOF NÃO é preview (o formato do id não decide)', () => {
    const line = { datePosted: D('2026-06-11'), fitid: '260611' }
    expect(isPreviewLine(line, D('2026-06-12'))).toBe(false)
  })

  it('⚠️ e a DATA continua mandando: depois do corte é preview, com fitid ou sem', () => {
    expect(isPreviewLine({ datePosted: D('2026-06-13'), fitid: '260613' }, D('2026-06-12'))).toBe(true)
    expect(isPreviewLine({ datePosted: D('2026-06-13'), fitid: '999888' }, D('2026-06-12'))).toBe(true)
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
