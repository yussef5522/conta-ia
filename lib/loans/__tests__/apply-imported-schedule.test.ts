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

  it('DRE só recebe VINCULADAS (por competência); histórico sem vínculo fica FORA', () => {
    const existing: ApplyImportInstallment[] = [
      // #1 vinculada 1:1, competência 2024-10 (encargo hoje 300 → doc 300)
      { number: 1, status: 'PAID', reconciledTransactionId: 't1', hasNPayments: false, paidInterest: 300, competenceMonth: '2024-10', currentEncargo: 300 },
      // #2 vinculada N:1, competência 2026-07, encargo hoje 0 → doc 250 (entra no DRE de julho)
      { number: 2, status: 'PAID', reconciledTransactionId: null, hasNPayments: true, paidInterest: null, competenceMonth: '2026-07', currentEncargo: 0 },
    ]
    const r = applyImportedSchedule(contract, loan, existing)
    // impacto no DRE: 2024-10 (300) + 2026-07 (250)
    const jul = r.dreImpactByMonth.find((m) => m.month === '2026-07')!
    expect(jul.depois).toBe(250)
    expect(jul.antes).toBe(0)
    expect(r.dreImpactTotalDepois).toBe(550)
    // nada foi pra histórico (ambas vinculadas)
    expect(r.historicoSemVinculoCount).toBe(0)
  })

  it('parcela liquidada SEM vínculo → NÃO entra no DRE, só reconstrução de histórico', () => {
    // nenhuma existente vinculada → todas as liquidadas do doc caem no histórico
    const r = applyImportedSchedule(contract, loan, [])
    expect(r.dreImpactByMonth).toEqual([]) // nada no DRE
    expect(r.dreImpactTotalDepois).toBe(0)
    expect(r.historicoSemVinculoCount).toBe(2) // #1 e #2 são liquidadas com encargo
    expect(r.historicoEncargos).toBe(550) // 300 + 250, FORA do resultado
  })

  it('vínculo preservado quando a parcela existe no documento → não bloqueia', () => {
    const existing: ApplyImportInstallment[] = [{ number: 2, status: 'PAID', reconciledTransactionId: null, hasNPayments: true, paidInterest: null, competenceMonth: '2026-07', currentEncargo: 0 }]
    expect(applyImportedSchedule(contract, loan, existing).blocked).toBe(false)
  })

  it('BLOQUEIA quando parcela vinculada some do documento', () => {
    const existing: ApplyImportInstallment[] = [{ number: 99, status: 'PAID', reconciledTransactionId: 'tx99', hasNPayments: false, paidInterest: 100, competenceMonth: '2026-06', currentEncargo: 100 }]
    const r = applyImportedSchedule(contract, loan, existing)
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/#99|vínculo/i)
  })
})
