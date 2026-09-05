// ⛔⛔ O ÚLTIMO DIA DO EXTRATO NUNCA ERA CONFERIDO (05/09/2026).
//
// Linhas REAIS do `Extrato_20260905.pdf`: o banco escreve `SALDO NA DATA` nos dias do meio
// e **`SALDO NA DATA.`** — com ponto — no último. O regex exigia espaço depois de "DATA",
// então o dia mais recente (o que o dono acabou de importar) sumia da régua **em silêncio**.

import { describe, it, expect } from 'vitest'
import { banrisulPdfParser } from '../banrisul-parser'

const PDF = `
     SALDO ANT EM 31/08/2026                                           8.130,19-
++   MOVIMENTOS SET/2026
01   OP. CREDITO C/GARANTIA                             000023         4.250,99
     IOF                                                000000            11,12-
     SALDO NA DATA                                                     5.148,51-
02   ANTECIP STONE                                      670616           274,73
     SALDO NA DATA                                                     4.841,10-
04   OP.CREDITO C/GARANTIA                              014181         5.252,06
     SALDO NA DATA.                                                    6.647,67-
-------------------- EXTRATO EMITIDO AS 00:55 DE 05/09/2026 --------------------
`

describe('⛔ SALDO NA DATA com ponto no fim', () => {
  const p = banrisulPdfParser.parse(PDF) as ReturnType<typeof banrisulPdfParser.parse> & {
    saldosDiarios?: Array<{ data: string; valor: number }>
    saldoAnterior?: { data: string; valor: number } | null
  }

  it('⛔⛔ o ÚLTIMO dia entra na régua — era ele que sumia', () => {
    const dias = p.saldosDiarios ?? []
    expect(dias.map((d) => d.data), 'o dia 04 sumiu da conferência').toEqual([
      '2026-09-01', '2026-09-02', '2026-09-04',
    ])
    expect(dias[2].valor, 'o contábil de 04/09 do PDF real').toBeCloseTo(-6647.67, 2)
  })

  it('⭐ e os dias do meio continuam iguais (o fix não mexeu no que funcionava)', () => {
    const dias = p.saldosDiarios ?? []
    expect(dias[0].valor).toBeCloseTo(-5148.51, 2)
    expect(dias[1].valor).toBeCloseTo(-4841.10, 2)
  })

  it('⭐ a abertura é a do PDF de hoje — o banco reescreveu 31/08', () => {
    expect(p.saldoAnterior?.data).toBe('2026-08-31')
    expect(p.saldoAnterior?.valor).toBeCloseTo(-8130.19, 2)
  })
})
