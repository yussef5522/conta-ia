import { describe, it, expect } from 'vitest'
import { applyImportedSchedule, type ApplyImportInstallment } from '../apply-imported-schedule'
import type { ParsedScheduleContract, ParsedScheduleInstallment } from '../bank-schedule-parser'

const inst = (number: number, situacao: 'LIQUIDADO' | 'NORMAL', principal: number, encargos: number): ParsedScheduleInstallment => ({
  number, situacao, dueDate: `2026-${String(number).padStart(2, '0')}-15`,
  encargosProvisionados: 0, encargosTotais: encargos, valorPrincipal: principal,
  valorParcela: Math.round((principal + encargos) * 100) / 100,
})

// contrato SAC: 4 parcelas, 2 liquidadas, saldo doc = 5.000
const contract: ParsedScheduleContract = {
  contractNumber: 'C41022227-1', numParcelas: 4, dataContratacao: '2024-07-23',
  saldoDevedor: 5000, valorFinanciado: 10000, jurosNormaisAnual: 22.72,
  installments: [
    inst(1, 'LIQUIDADO', 2500, 300),
    inst(2, 'LIQUIDADO', 2500, 250),
    inst(3, 'NORMAL', 2500, 0),
    inst(4, 'NORMAL', 2500, 0),
  ],
}
const loan = { contractNumber: 'C41022227-1', rateType: 'POS' as const }

describe('applyImportedSchedule', () => {
  it('ancora o saldo no documento: closing da última paga = saldoDevedor', () => {
    const r = applyImportedSchedule(contract, loan, [])
    expect(r.saldoDepois).toBe(5000)
    const p2 = r.rows.find((x) => x.number === 2)!
    expect(p2.closingBalance).toBeCloseTo(5000, 2) // última liquidada
    const p1 = r.rows.find((x) => x.number === 1)!
    expect(p1.openingBalance).toBeCloseTo(10000, 2) // = valor financiado
  })

  it('liquidada vira PAID com split do documento (principal fora / encargos DRE)', () => {
    const r = applyImportedSchedule(contract, loan, [])
    const p1 = r.rows.find((x) => x.number === 1)!
    expect(p1.status).toBe('PAID')
    expect(p1.amortization).toBe(2500)
    expect(p1.paidInterest).toBe(300) // encargos → despesa financeira
    expect(p1.paidTotal).toBe(2800)
  })

  it('normal futura = OPEN, encargos 0, isEstimate (pós-fixado)', () => {
    const r = applyImportedSchedule(contract, loan, [])
    const p3 = r.rows.find((x) => x.number === 3)!
    expect(p3.status).toBe('OPEN')
    expect(p3.paidInterest).toBeNull()
    expect(p3.isEstimate).toBe(true)
  })

  it('novoSplitDRE: parcela liquidada que não tinha split antes', () => {
    const existing: ApplyImportInstallment[] = [
      { number: 1, status: 'PAID', reconciledTransactionId: 't1', hasNPayments: false, paidInterest: 300 }, // já tinha split
      { number: 2, status: 'PAID', reconciledTransactionId: null, hasNPayments: true, paidInterest: null }, // vinculada SEM split → ganha
    ]
    const r = applyImportedSchedule(contract, loan, existing)
    expect(r.novoSplitDRE.map((s) => s.number)).toEqual([2])
    expect(r.novoSplitDRE[0].encargos).toBe(250)
  })

  it('vínculo preservado quando a parcela existe no documento → não bloqueia', () => {
    const existing: ApplyImportInstallment[] = [{ number: 2, status: 'PAID', reconciledTransactionId: null, hasNPayments: true, paidInterest: null }]
    expect(applyImportedSchedule(contract, loan, existing).blocked).toBe(false)
  })

  it('BLOQUEIA quando parcela vinculada some do documento', () => {
    const existing: ApplyImportInstallment[] = [{ number: 99, status: 'PAID', reconciledTransactionId: 'tx99', hasNPayments: false, paidInterest: 100 }]
    const r = applyImportedSchedule(contract, loan, existing)
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/#99|vínculo/i)
  })
})
