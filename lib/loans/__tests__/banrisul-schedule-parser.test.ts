// Sprint Parser Banrisul (08/08/2026) — testes contra os 2 documentos REAIS.
// Antes deste parser, detectScheduleParser(banrisul) = null ("banco não suportado")
// → estes testes ficam VERMELHOS no código pré-parser (Regra 1).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { banrisulScheduleParser } from '../banrisul-schedule-parser'
import { caixaScheduleParser } from '../caixa-schedule-parser'
import { sicrediScheduleParser } from '../sicredi-schedule-parser'
import { detectScheduleParser } from '../bank-parsers'

const PRICE = readFileSync(join(__dirname, 'fixtures', 'bnr_64956967.txt'), 'utf-8') // PRICE PRÉ
const SAC = readFileSync(join(__dirname, 'fixtures', 'bnr_57538834.txt'), 'utf-8') // SAC CDI CAR
const CAIXA = readFileSync(join(__dirname, 'fixtures', 'caixa-1837311.txt'), 'utf-8')

describe('Banrisul — detecção (2 marcas obrigatórias)', () => {
  it('detecta os dois documentos Banrisul', () => {
    expect(banrisulScheduleParser.detects(PRICE)).toBe(true)
    expect(banrisulScheduleParser.detects(SAC)).toBe(true)
  })
  it('recusa documento de OUTRO banco (Caixa)', () => {
    expect(banrisulScheduleParser.detects(CAIXA)).toBe(false)
  })
  it('exige AS DUAS marcas — só uma não basta', () => {
    expect(banrisulScheduleParser.detects('EXTRATO/DOCUMENTO DESCRITIVO DE CRÉDITO')).toBe(false)
    expect(banrisulScheduleParser.detects('BBH - CRÉDITO GERAL')).toBe(false)
  })
  it('detectScheduleParser roteia Banrisul pro parser certo', () => {
    expect(detectScheduleParser(PRICE)).toBe(banrisulScheduleParser)
    expect(detectScheduleParser(SAC)).toBe(banrisulScheduleParser)
  })
})

// FASE 2 — teste cruzado (o que protege o cliente): parser errado NÃO lê o outro.
describe('Banrisul — teste cruzado (recusa mútua)', () => {
  it('Caixa e Sicredi NÃO detectam Banrisul', () => {
    expect(caixaScheduleParser.detects(PRICE)).toBe(false)
    expect(caixaScheduleParser.detects(SAC)).toBe(false)
    expect(sicrediScheduleParser.detects(PRICE)).toBe(false)
    expect(sicrediScheduleParser.detects(SAC)).toBe(false)
  })
})

describe('Banrisul 64956967 — PRICE PRÉ', () => {
  const [c] = banrisulScheduleParser.parse(PRICE)
  it('cabeçalho + saldo (SALDO da última linha, não Valor p/ Liquidação)', () => {
    expect(c.contractNumber).toBe('002100064956967')
    expect(c.numParcelas).toBe(36)
    expect(c.saldoDevedor).toBe(48888.59)
    expect(c.valorFinanciado).toBe(103398.17)
    expect(c.sistemaAmortizacao).toBe('PRICE')
    expect(c.carenciaMeses).toBe(0)
  })
  it('22 pagas (parcela em 2 cotas contada como 1) + 14 a pagar = 36', () => {
    const pagas = c.installments.filter((i) => i.situacao === 'LIQUIDADO')
    const futuras = c.installments.filter((i) => i.situacao === 'NORMAL')
    expect(pagas.length).toBe(22)
    expect(futuras.length).toBe(14)
  })
  it('#21 = as duas cotas de 12/06 somadas (mesma parcela)', () => {
    const p21 = c.installments.find((i) => i.number === 21)!
    expect(p21.dueDate).toBe('2026-06-12')
    expect(p21.valorParcela).toBe(4177.96) // 1.393,74 + 2.784,22
    expect(p21.valorPrincipal).toBe(2954.43) // 944,23 + 2.010,20
    expect(p21.encargosTotais).toBe(1223.53) // pagamentos − amort = juros+correção+mora
  })
  it('#22 = a de 13/07 (saldo final)', () => {
    const p22 = c.installments.find((i) => i.number === 22)!
    expect(p22.dueDate).toBe('2026-07-13')
    expect(p22.valorParcela).toBe(4092.02)
  })
})

describe('Banrisul 57538834 — SAC CDI com carência de principal', () => {
  const [c] = banrisulScheduleParser.parse(SAC)
  it('cabeçalho + saldo + carência', () => {
    expect(c.contractNumber).toBe('002100057538834')
    expect(c.numParcelas).toBe(76)
    expect(c.saldoDevedor).toBe(36075.15)
    expect(c.valorFinanciado).toBe(134807.03)
    expect(c.sistemaAmortizacao).toBe('SAC')
    expect(c.indexador).toBe('CDI')
    expect(c.carenciaMeses).toBe(5) // 5 primeiras pagas com amort 0
  })
  it('57 pagas + 19 a pagar = 76', () => {
    expect(c.installments.filter((i) => i.situacao === 'LIQUIDADO').length).toBe(57)
    expect(c.installments.filter((i) => i.situacao === 'NORMAL').length).toBe(19)
  })
  it('parcela 57 (27/07) = a 2.444,15 com correção CDI (juros 122,99 + correção 422,47 + amort 1.898,69)', () => {
    const p57 = c.installments.find((i) => i.number === 57)!
    expect(p57.dueDate).toBe('2026-07-27')
    expect(p57.valorParcela).toBe(2444.15)
    expect(p57.valorPrincipal).toBe(1898.69)
    expect(p57.encargosTotais).toBe(545.46) // 122,99 + 422,47
  })
  it('carência: 5 primeiras com amort 0, saldo parado em 134.807,03', () => {
    for (let n = 1; n <= 5; n++) {
      const p = c.installments.find((i) => i.number === n)!
      expect(p.valorPrincipal).toBe(0)
    }
    // 6ª já amortiza (1.898,69 constante do SAC)
    expect(c.installments.find((i) => i.number === 6)!.valorPrincipal).toBe(1898.69)
  })
})

describe('Banrisul — aborta em leitura inconsistente (identidade não fecha)', () => {
  it('linha de pagamento que não fecha JUROS+CORREÇÃO+AMORT+MORA=PAGAMENTOS → throw', () => {
    // corrompe a AMORTIZAÇÃO de uma linha (2.007,84 → 9.999,99)
    const corrompido = PRICE.replace('2.007,84', '9.999,99')
    expect(() => banrisulScheduleParser.parse(corrompido)).toThrow(/não fecha|inconsistente/i)
  })
})
