// Sprint Contraparte PIX — testes do parser Banrisul contra o LAYOUT REAL
// (Pro Fit Itaqui, ag 0230, jul/2026). Cobre: documento alfanumérico, valor
// negativo no fim, NOME opcional, NOME grudado por \f, nome == própria empresa,
// nome truncado, documento 000000, ignore de SALDO/cabeçalho, herança de dia.

import { describe, it, expect } from 'vitest'
import { banrisulPdfParser, parseBrlAmount } from '../banrisul-parser'
import { BankStatementParseError } from '../types'

// \f (form feed) antes de "    NOME: PRO FIT..." simula o gluing entre páginas.
const REAL = [
  'B A N R I S U L',
  'AGENCIA: 0230',
  'CONTA..: 0606342204',
  'NOME...: PRO FIT ITAQUI LTDA',
  '',
  'DIA HISTORICO           DOCUMENTO        V A L O R',
  '01   REND CDB AUT        0000RC                0,03',
  '     VERO ANTECIPACAO    779867              108,92',
  '     PIX RECEBIDO        355540              129,90',
  '      NOME: JOAO FRANCISCO RODRIGUES FILHO',
  '     PIX RECEBIDO        489226                4,95',
  '\f    NOME: PRO FIT ITAQUI LTDA',
  '     TAR PIX COMPRA      008610                1,46-',
  '     IOF                 000000                2,07-',
  '     SALDO NA DATA                        13.106,53',
  '06   PGTO BOLETO         229583              563,00-',
  '     PIX ENVIADO         198074            1.215,00-',
  '      NOME: MARCOS ADRIEL LEAL KERNBAUM',
  '     PIX ENVIADO         593152              500,00-',
  '      NOME: FACEBOOK SERVICOS ONLINE DO BRASIL LTDA',
  '     PIX ENVIADO         883088           10.500,00-',
  '      NOME: PIFFERO, NEDEL E CIA. LTDA',
  '     PIX ENVIADO         491711           17.061,85-',
  '      NOME: RECEITA FEDERAL',
  '09   PIX RECEBIDO        000000              139,90',
  '      NOME: GRUBERT E BRAGA COMERCIO DE COLCHOES LT',
  '10   PIX RECEBIDO        000000              139,90',
  '      NOME: OUTRO PAGADOR TOTALMENTE DIFERENTE LTDA',
].join('\n')

describe('parseBrlAmount', () => {
  it('valor negativo (sinal no fim)', () => {
    expect(parseBrlAmount('1.215,00-')).toEqual({ amount: 1215, signed: -1215 })
  })
  it('valor positivo pequeno', () => {
    expect(parseBrlAmount('0,03')).toEqual({ amount: 0.03, signed: 0.03 })
  })
  it('milhar', () => {
    expect(parseBrlAmount('17.061,85-')).toEqual({ amount: 17061.85, signed: -17061.85 })
  })
  it('rejeita não-valor', () => {
    expect(parseBrlAmount('0000RC')).toBeNull()
    expect(parseBrlAmount('SALDO')).toBeNull()
  })
})

describe('banrisulPdfParser', () => {
  const r = banrisulPdfParser.parse(REAL)
  const byDoc = (d: string) => r.lines.filter((l) => l.documento === d)

  it('cabeçalho: agência, conta, titular', () => {
    expect(r.header).toEqual({ agencia: '0230', conta: '0606342204', titular: 'PRO FIT ITAQUI LTDA' })
  })

  it('conta o total de lançamentos (ignora SALDO/cabeçalho)', () => {
    expect(r.lines).toHaveLength(13)
    expect(r.lines.some((l) => /SALDO/i.test(l.historico))).toBe(false)
    expect(r.lines.some((l) => /^DIA/i.test(l.historico))).toBe(false)
  })

  it('documento alfanumérico (0000RC) e valor +0,03', () => {
    const l = byDoc('0000RC')[0]
    expect(l).toMatchObject({ historico: 'REND CDB AUT', amount: 0.03, signed: 0.03 })
  })

  it('valor negativo (TAR PIX COMPRA)', () => {
    const l = byDoc('008610')[0]
    expect(l.signed).toBe(-1.46)
    expect(l.amount).toBe(1.46)
  })

  it('herança de dia: VERO ANTECIPACAO herda o dia 01', () => {
    const l = byDoc('779867')[0]
    expect(l.day).toBe(1)
    const pixEnv = byDoc('198074')[0]
    expect(pixEnv.day).toBe(6)
  })

  it('NOME: gruda no lançamento certo (PIX ENVIADO 198074 → MARCOS)', () => {
    expect(byDoc('198074')[0].counterpartyName).toBe('MARCOS ADRIEL LEAL KERNBAUM')
    expect(byDoc('491711')[0].counterpartyName).toBe('RECEITA FEDERAL')
  })

  it('NOME grudado por \\f gruda no lançamento ANTERIOR (489226 → PRO FIT)', () => {
    expect(byDoc('489226')[0].counterpartyName).toBe('PRO FIT ITAQUI LTDA')
  })

  it('lançamento sem NOME fica com counterpartyName null', () => {
    expect(byDoc('779867')[0].counterpartyName).toBeNull()
    expect(byDoc('229583')[0].counterpartyName).toBeNull() // PGTO BOLETO
  })

  it('nome truncado pelo banco é preservado como veio', () => {
    const l = r.lines.find((x) => x.documento === '000000' && x.day === 9)
    expect(l?.counterpartyName).toBe('GRUBERT E BRAGA COMERCIO DE COLCHOES LT')
  })

  it('documento 000000 aparece em lançamentos distintos (fonte da ambiguidade)', () => {
    const zeros = byDoc('000000')
    expect(zeros.length).toBeGreaterThanOrEqual(3) // IOF + 2 PIX 139,90
    const pix139 = zeros.filter((l) => l.amount === 139.9)
    expect(pix139).toHaveLength(2)
  })

  it('PDF sem texto → erro claro NO_TEXT_LAYER (não cai pro Vision)', () => {
    expect(() => banrisulPdfParser.parse('   ')).toThrowError(BankStatementParseError)
    try {
      banrisulPdfParser.parse('')
    } catch (e) {
      expect((e as BankStatementParseError).code).toBe('NO_TEXT_LAYER')
    }
  })
})
