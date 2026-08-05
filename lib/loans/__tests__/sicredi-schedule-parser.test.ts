import { describe, it, expect } from 'vitest'
import { sicrediScheduleParser } from '../sicredi-schedule-parser'

// Texto no layout real do documento Sicredi (extraído por poppler).
const DOC = `
RELACAO DE TITULOS CADASTRADOS EM ORDEM DE TITULO E COMPOSICAO      04/08/2026

  Titulo .........: C41022227-1
  Nro de Parcelas : 058          Data Contratacao: 23/07/2024
  Saldo Devedor ..: 157.894,84
  Valor Financiado: 250.000,00   Juros Normais ..: 22,7200% a.a.   Juros Inadimpl. : 12,0000% a.a.

  Parc Situacao   Percentual Vencimento EncProv  EncTotais  Principal  Parcela
  021 Liquidado   1,72       15/06/2026 0,00     2.792,47   4.385,96   7.178,43
  022 Liquidado   2,70       15/07/2026 0,00     2.753,89   4.385,96   7.139,85
  023 Normal      2,70       15/08/2026 0,00     0,00       4.385,96   4.385,96
  024 Normal      2,70       15/09/2026 0,00     0,00       4.385,96   4.385,96

  Titulo .........: C41022570-0
  Nro de Parcelas : 036          Data Contratacao: 15/08/2024
  Saldo Devedor ..: 100.000,06
  Valor Financiado: 150.000,00   Juros Normais ..: 6,0000% a.a.    Juros Inadimpl. : 7,0000% a.a.

  Parc Situacao   Percentual Vencimento EncProv  EncTotais   Principal  Parcela
  001 Liquidado   0,00       15/08/2025 0,00     29.132,86   0,00       29.132,86
  011 Liquidado   2,77       15/06/2026 0,00     1.713,68    4.166,71   5.880,39
  012 Liquidado   2,77       15/07/2026 0,00     1.731,10    4.166,66   5.897,76
  013 Normal      2,77       15/08/2026 0,00     0,00        4.166,66   4.166,66
`

// Quebra de página: o cabeçalho do C41022570 repete e traz mais parcelas.
const PAGE2 = `
                                    Pagina 2

  Titulo .........: C41022570-0
  Nro de Parcelas : 036          Data Contratacao: 15/08/2024
  Saldo Devedor ..: 100.000,06
  Valor Financiado: 150.000,00   Juros Normais ..: 6,0000% a.a.

  Parc Situacao   Percentual Vencimento EncProv  EncTotais  Principal  Parcela
  014 Normal      2,77       15/09/2026 0,00     0,00       4.166,66   4.166,66
`

describe('sicrediScheduleParser', () => {
  it('parseia VÁRIOS contratos + casa cabeçalho', () => {
    const cs = sicrediScheduleParser.parse(DOC)
    expect(cs.length).toBe(2)
    const c227 = cs.find((c) => c.contractNumber === 'C41022227-1')!
    expect(c227.numParcelas).toBe(58)
    expect(c227.valorFinanciado).toBe(250000)
    expect(c227.saldoDevedor).toBe(157894.84)
    expect(c227.jurosNormaisAnual).toBeCloseTo(22.72, 2)
  })

  it('parcela LIQUIDADA: principal=amort, encargosTotais=juros+correção, parcela=total', () => {
    const c = sicrediScheduleParser.parse(DOC).find((x) => x.contractNumber === 'C41022227-1')!
    const p22 = c.installments.find((i) => i.number === 22)!
    expect(p22.situacao).toBe('LIQUIDADO')
    expect(p22.valorPrincipal).toBe(4385.96)
    expect(p22.encargosTotais).toBe(2753.89)
    expect(p22.valorParcela).toBe(7139.85)
    expect(p22.dueDate).toBe('2026-07-15')
  })

  it('parcela NORMAL futura: encargos 0,00, parcela = principal (não é erro)', () => {
    const c = sicrediScheduleParser.parse(DOC).find((x) => x.contractNumber === 'C41022227-1')!
    const p23 = c.installments.find((i) => i.number === 23)!
    expect(p23.situacao).toBe('NORMAL')
    expect(p23.encargosTotais).toBe(0)
    expect(p23.valorParcela).toBe(4385.96)
  })

  it('carência: 1ª parcela com encargos altíssimos (juros de carência capitalizados)', () => {
    const c = sicrediScheduleParser.parse(DOC).find((x) => x.contractNumber === 'C41022570-0')!
    const p1 = c.installments.find((i) => i.number === 1)!
    expect(p1.encargosTotais).toBe(29132.86)
    expect(p1.valorPrincipal).toBe(0)
  })

  it('quebra de página: header repetido → parcelas mescladas (dedupe por number)', () => {
    const cs = sicrediScheduleParser.parse(DOC + PAGE2)
    const c = cs.find((x) => x.contractNumber === 'C41022570-0')!
    // #12, #13 do bloco 1 + #14 da página 2, sem duplicar #001/#011
    expect(c.installments.map((i) => i.number)).toEqual([1, 11, 12, 13, 14])
    expect(cs.length).toBe(2) // não vira 3 contratos
  })
})
