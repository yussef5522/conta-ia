// Sprint Parser Caixa (06/08/2026) — testes contra o pdftotext -layout REAL do
// documento da Caixa (contrato 1837311, emitido 06/08/2026). Fixture verbatim.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { caixaScheduleParser } from '../caixa-schedule-parser'
import { sicrediScheduleParser } from '../sicredi-schedule-parser'
import { detectScheduleParser } from '../bank-parsers'

const TEXT = readFileSync(join(__dirname, 'fixtures', 'caixa-1837311.txt'), 'utf-8')

describe('detecção / roteamento', () => {
  it('detecta Caixa e NÃO confunde com Sicredi', () => {
    expect(caixaScheduleParser.detects(TEXT)).toBe(true)
    expect(sicrediScheduleParser.detects(TEXT)).toBe(false)
    expect(detectScheduleParser(TEXT)?.bank).toBe('Caixa Econômica Federal')
  })
  it('texto de outro banco → nenhum parser', () => {
    expect(detectScheduleParser('DEMONSTRATIVO QUALQUER DE OUTRO BANCO')).toBeNull()
  })
})

describe('cabeçalho', () => {
  const [c] = caixaScheduleParser.parse(TEXT)
  it('contrato VERBATIM (zero-padded) — casa exato com o Loan cadastrado', () =>
    expect(c.contractNumber).toBe('000000000001837311'))
  it('saldo = "Saldo Devedor Atualizado" do cabeçalho (NÃO o artefato 102.427,10)', () =>
    expect(c.saldoDevedor).toBe(14116.29))
  it('financiado, data, prazo total', () => {
    expect(c.valorFinanciado).toBe(61000)
    expect(c.dataContratacao).toBe('2023-01-26')
    expect(c.numParcelas).toBe(48)
  })
  it('sistema PRICE, taxa mensal 1,87, juros anual 22,44, indexador VAZIO (pré)', () => {
    expect(c.sistemaAmortizacao).toBe('PRICE')
    expect(c.taxaJurosMensal).toBe(1.87)
    expect(c.jurosNormaisAnual).toBe(22.44)
    expect(c.indexador).toBeNull()
  })
})

describe('carência (11 meses) — capitalização, fora das parcelas/DRE', () => {
  const [c] = caixaScheduleParser.parse(TEXT)
  it('11 linhas, saldo cresce 62.140,70 → 74.789,25', () => {
    expect(c.carencia?.count).toBe(11)
    expect(c.carencia?.saldoInicial).toBe(62140.70)
    expect(c.carencia?.saldoFinal).toBe(74789.25)
  })
  it('carência NÃO vira parcela (installments só as numeradas)', () => {
    expect(c.installments.every((i) => i.number >= 1)).toBe(true)
  })
})

describe('parcelas — colunas Caixa (Valor da Parcela = amort)', () => {
  const [c] = caixaScheduleParser.parse(TEXT)
  const byN = new Map(c.installments.map((i) => [i.number, i]))

  it('31 parcelas numeradas (1..31)', () => {
    expect(c.installments.length).toBe(31)
    expect(c.installments[0].number).toBe(1)
    expect(c.installments[30].number).toBe(31)
  })

  it('#30 PG: amort 2.615,76 + juros 311,26 = total 2.927,02 (sem enc/resíduo)', () => {
    const p = byN.get(30)!
    expect(p.situacao).toBe('LIQUIDADO')
    expect(p.valorPrincipal).toBe(2615.76)
    expect(p.juros).toBe(311.26)
    expect(p.encAtraso).toBe(0)
    expect(p.residuo).toBe(0)
    expect(p.valorParcela).toBe(2927.02)
    expect(p.encargosTotais).toBeCloseTo(311.26, 2)
    // invariante: amort + encargosTotais == total pago
    expect(p.valorPrincipal + p.encargosTotais).toBeCloseTo(p.valorParcela, 2)
  })

  it('#29 PG com ENC. POR ATRASO: amort 2.567,74 + juros 359,28 + enc 68,26 + resíduo 18,13 = 3.013,41', () => {
    const p = byN.get(29)!
    expect(p.valorPrincipal).toBe(2567.74)
    expect(p.juros).toBe(359.28)
    expect(p.encAtraso).toBe(68.26)
    expect(p.residuo).toBeCloseTo(18.13, 2)
    expect(p.valorParcela).toBe(3013.41)
    expect(p.encargosTotais).toBeCloseTo(445.67, 2) // juros+enc+resíduo
    expect(p.valorPrincipal + p.encargosTotais).toBeCloseTo(p.valorParcela, 2)
  })

  it('resíduo cresce só nas parcelas com atraso: #18=3,62 #19=10,87 #21=12,68 #28=14,50', () => {
    expect(byN.get(18)!.residuo).toBeCloseTo(3.62, 2)
    expect(byN.get(19)!.residuo).toBeCloseTo(10.87, 2)
    expect(byN.get(21)!.residuo).toBeCloseTo(12.68, 2)
    expect(byN.get(28)!.residuo).toBeCloseTo(14.50, 2)
  })

  it('parcelas sem atraso têm resíduo 0 cravado (#22, #27, #30)', () => {
    expect(byN.get(22)!.residuo).toBe(0)
    expect(byN.get(27)!.residuo).toBe(0)
    expect(byN.get(30)!.residuo).toBe(0)
  })

  it('#31 N PG (NORMAL): total pago 0 → usa agendado amort+juros = 2.927,02, fora do "pago"', () => {
    const p = byN.get(31)!
    expect(p.situacao).toBe('NORMAL')
    expect(p.valorPrincipal).toBe(2664.67)
    expect(p.juros).toBe(262.35)
    expect(p.valorParcela).toBe(2927.02) // amort + juros agendados (NÃO o 0,00 da coluna)
    expect(p.encargosTotais).toBe(262.35)
  })

  it('artefato: a coluna Saldo da última linha (102.427,10) NÃO vira o saldo do contrato', () => {
    expect(c.saldoDevedor).toBe(14116.29)
  })
})

describe('validação — nunca gravar leitura errada', () => {
  it('resíduo negativo (total < amort+juros+enc) → aborta', () => {
    // #30 tem amort 2.615,76 — forço o total pago pra 1.000,00 (amort > total).
    // Ancoro no saldo 14.029,38 (único na linha 30) pra não depender do espaçamento.
    const bad = TEXT.replace(/14\.029,38(\s+)2\.927,02/, '14.029,38$11.000,00')
    expect(bad).not.toBe(TEXT) // garante que o replace pegou
    expect(() => caixaScheduleParser.parse(bad)).toThrow(/res[íi]duo negativo|amortiza/i)
  })
})
