// Sprint Contraparte-Banrisul FASE 4 (13/08) — REGRA 3: extração de período +
// resolução de data completa por linha (chave segura do Nível 2). Executa o
// parser real contra texto no layout do Banrisul.

import { describe, it, expect } from 'vitest'
import { banrisulPdfParser, extractStatementPeriod } from '../banrisul-parser'

describe('extractStatementPeriod', () => {
  it('lê "PERÍODO: dd/mm/aaaa a dd/mm/aaaa"', () => {
    expect(extractStatementPeriod('PERÍODO: 03/08/2026 a 10/08/2026')).toEqual({
      start: '2026-08-03',
      end: '2026-08-10',
    })
  })
  it('lê variação sem acento e com "à"', () => {
    expect(extractStatementPeriod('PERIODO 01/06/2026 à 30/06/2026')).toEqual({
      start: '2026-06-01',
      end: '2026-06-30',
    })
  })
  it('duas datas soltas ligadas por "a" também servem', () => {
    expect(extractStatementPeriod('Extrato de 01/07/2026 a 31/07/2026 emitido')).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    })
  })
  it('sem período legível → null (Nível 2 fica desligado, conservador)', () => {
    expect(extractStatementPeriod('B A N R I S U L\nAGENCIA: 0230')).toBeNull()
  })
})

describe('resolução de data por linha (via parse)', () => {
  it('período de 1 mês: cada linha ganha a data completa', () => {
    const text = [
      'B A N R I S U L',
      'AGENCIA: 0230',
      'CONTA..: 0605534106',
      'NOME...: CACULA MIX LTDA',
      'PERÍODO: 03/08/2026 a 10/08/2026',
      'DIA HISTORICO           DOCUMENTO        V A L O R',
      '03   PIX ENVIADO        198074            1.215,00-',
      '      NOME: MARCOS ADRIEL',
      '05   PIX ENVIADO        593152              500,00-',
      '      NOME: FULANO DE TAL',
    ].join('\n')
    const r = banrisulPdfParser.parse(text)
    expect(r.period).toEqual({ start: '2026-08-03', end: '2026-08-10' })
    expect(r.lines.find((l) => l.documento === '198074')!.date).toBe('2026-08-03')
    expect(r.lines.find((l) => l.documento === '593152')!.date).toBe('2026-08-05')
  })

  it('período de VÁRIOS meses: o mês avança quando o dia decresce', () => {
    const text = [
      'AGENCIA: 0230',
      'CONTA..: 0605534106',
      'PERÍODO: 28/06/2026 a 02/07/2026',
      'DIA HISTORICO           DOCUMENTO        V A L O R',
      '28   PIX ENVIADO        111111              100,00-',
      '30   PIX ENVIADO        222222              200,00-',
      '01   PIX ENVIADO        333333              300,00-', // dia caiu → julho
      '02   PIX ENVIADO        444444              400,00-',
    ].join('\n')
    const r = banrisulPdfParser.parse(text)
    expect(r.lines.find((l) => l.documento === '111111')!.date).toBe('2026-06-28')
    expect(r.lines.find((l) => l.documento === '222222')!.date).toBe('2026-06-30')
    expect(r.lines.find((l) => l.documento === '333333')!.date).toBe('2026-07-01')
    expect(r.lines.find((l) => l.documento === '444444')!.date).toBe('2026-07-02')
  })

  it('sem período: datas ficam null (não inventa)', () => {
    const text = [
      'AGENCIA: 0230',
      'CONTA..: 0605534106',
      'DIA HISTORICO           DOCUMENTO        V A L O R',
      '03   PIX ENVIADO        198074            1.215,00-',
    ].join('\n')
    const r = banrisulPdfParser.parse(text)
    expect(r.period).toBeNull()
    expect(r.lines[0].date == null).toBe(true)
  })
})
