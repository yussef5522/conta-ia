// Sprint Rearquitetura-Import — REGRA 3: executa a derivação do saldoAntes nos 6
// casos que já morderam na prática (incl. o 5 e o 6, os que o Yussef mais erra).

import { describe, it, expect } from 'vitest'
import { deriveSaldoAntes, type SaldoAntesInput } from '../saldo-antes'

const d = (s: string) => new Date(`${s}T12:00:00Z`)
const line = (date: string, amt: number) => ({ date: d(date), signedAmount: amt })

function make(over: Partial<SaldoAntesInput>): SaldoAntesInput {
  return {
    current: { periodStart: null, periodEnd: null, asOf: null, ledgerBalance: null, lines: [] },
    priorStatements: [],
    existingLines: [],
    ...over,
  }
}

describe('1) SOBREPOSIÇÃO NORMAL — deriva pela linha sobreposta', () => {
  it('saldoAntes = LEDGERBAL anterior − Σ(linhas do atual até o asOf anterior)', () => {
    // anterior: asOf 05/08, LEDGERBAL 1000. atual: 03→08/08 (sobrepõe 03-05).
    // linhas do atual: 04/08 -100, 06/08 -50, 07/08 +30.
    // overlap (data<=05/08) = [-100] → saldoAntes = 1000 - (-100) = 1100.
    const r = deriveSaldoAntes(make({
      current: {
        periodStart: d('2026-08-03'), periodEnd: d('2026-08-08'), asOf: d('2026-08-08'),
        ledgerBalance: 880, lines: [line('2026-08-04', -100), line('2026-08-06', -50), line('2026-08-07', 30)],
      },
      priorStatements: [{ asOf: d('2026-08-05'), ledgerBalance: 1000 }],
      existingLines: [line('2026-08-04', -100)], // o banco tem a linha sobreposta
    }))
    expect(r.outcome).toBe('DERIVED_OVERLAP')
    expect(r.saldoAntes).toBe(1100)
    expect(r.saldoAntesKnown).toBe(true)
    // sanity do juiz: 1100 + (-100-50+30) = 980 ... e o LEDGERBAL atual seria 980.
  })
})

describe('2) SEM SOBREPOSIÇÃO, com BURACO — avisa e ancora, não bloqueia', () => {
  it('gap entre o anterior e o atual → ANCHOR_GAP com o período faltante', () => {
    const r = deriveSaldoAntes(make({
      current: { periodStart: d('2026-08-10'), periodEnd: d('2026-08-13'), asOf: d('2026-08-13'), ledgerBalance: 500, lines: [line('2026-08-11', -20)] },
      priorStatements: [{ asOf: d('2026-08-03'), ledgerBalance: 1000 }],
    }))
    expect(r.outcome).toBe('ANCHOR_GAP')
    expect(r.saldoAntesKnown).toBe(false)
    expect(r.message).toMatch(/2026-08-03.*2026-08-10/)
  })
})

describe('3) SOBREPOSIÇÃO DIVERGENTE — reporta, não ancora em cima de dado divergente', () => {
  it('linha sobreposta com valor diferente do banco → BLOCKED_DIVERGENT', () => {
    const r = deriveSaldoAntes(make({
      current: {
        periodStart: d('2026-08-03'), periodEnd: d('2026-08-08'), asOf: d('2026-08-08'),
        ledgerBalance: 900, lines: [line('2026-08-04', -100)], // atual diz -100
      },
      priorStatements: [{ asOf: d('2026-08-05'), ledgerBalance: 1000 }],
      existingLines: [line('2026-08-04', -999)], // banco tem -999 → não bate
    }))
    expect(r.outcome).toBe('BLOCKED_DIVERGENT')
    expect(r.saldoAntesKnown).toBe(false)
    expect(r.message).toMatch(/não batem/i)
  })
})

describe('4) PRIMEIRO IMPORT — sem anterior, ancora', () => {
  it('nenhum prior → ANCHOR_FIRST_IMPORT', () => {
    const r = deriveSaldoAntes(make({
      current: { periodStart: d('2026-06-01'), periodEnd: d('2026-06-30'), asOf: d('2026-06-30'), ledgerBalance: 22000, lines: [line('2026-06-05', -100)] },
    }))
    expect(r.outcome).toBe('ANCHOR_FIRST_IMPORT')
    expect(r.saldoAntesKnown).toBe(false)
  })
})

describe('5) MESMO DIA com LEDGERBAL diferente — o mais recente manda', () => {
  // caso real: Banrisul 13/08 baixado de manhã (-8349.33) e de tarde (-2644.08).
  // Importando a TARDE, a manhã (mesmo asOf) é superseded → deriva do prior de 11/08.
  it('prior do mesmo asOf é superseded; deriva do anterior de verdade', () => {
    const r = deriveSaldoAntes(make({
      current: {
        periodStart: d('2026-08-03'), periodEnd: d('2026-08-13'), asOf: d('2026-08-13'),
        ledgerBalance: -2644.08, lines: [line('2026-08-11', -100), line('2026-08-12', -50)],
      },
      priorStatements: [
        { asOf: d('2026-08-13'), ledgerBalance: -8349.33 }, // manhã (mesmo dia) → superseded
        { asOf: d('2026-08-11'), ledgerBalance: -781.08 }, // o anterior de verdade
      ],
      existingLines: [line('2026-08-11', -100)], // sobreposição bate
    }))
    expect(r.supersedesPriorSameDay).toBe(true)
    expect(r.fromPriorAsOf && r.fromPriorAsOf.toISOString().slice(0, 10)).toBe('2026-08-11')
    // derivou do 11/08 (-781.08), não da manhã (-8349.33)
    expect(r.outcome).toBe('DERIVED_OVERLAP')
    expect(r.saldoAntes).toBe(-681.08) // -781.08 - (-100)
  })
})

describe('6) EXTRATO ANTIGO importado DEPOIS de um novo — não bagunça o saldo vivo', () => {
  it('importar junho depois de já ter agosto → isHistorical, deriva de prior pré-junho', () => {
    const r = deriveSaldoAntes(make({
      current: { periodStart: d('2026-06-01'), periodEnd: d('2026-06-30'), asOf: d('2026-06-30'), ledgerBalance: 5000, lines: [line('2026-06-10', -200)] },
      priorStatements: [
        { asOf: d('2026-08-31'), ledgerBalance: 9000 }, // agosto (mais novo) → NÃO deriva daqui
        { asOf: d('2026-05-31'), ledgerBalance: 5200 }, // maio (pré-junho) → deriva daqui
      ],
    }))
    expect(r.isHistorical).toBe(true) // o saldo vivo é de agosto, não deste import
    expect(r.fromPriorAsOf && r.fromPriorAsOf.toISOString().slice(0, 10)).toBe('2026-05-31')
    // maio 31 → junho 01 é contíguo (gap 1 dia) → deriva
    expect(r.outcome).toBe('DERIVED_CONTIGUOUS')
    expect(r.saldoAntes).toBe(5200)
  })
})

describe('5b) DTSERVER desempata + o mais antigo NÃO desfaz o mais novo', () => {
  it('subir a MANHÃ depois da TARDE (já importada) → NÃO sobrescreve o saldo vivo', () => {
    // atual = manhã (DTSERVER cedo). prior = tarde (mesmo asOf, DTSERVER tarde).
    const r = deriveSaldoAntes(make({
      current: {
        periodStart: d('2026-08-03'), periodEnd: d('2026-08-13'), asOf: d('2026-08-13'),
        dtServer: new Date('2026-08-13T09:00:00Z'), ledgerBalance: -8349.33, lines: [line('2026-08-11', -100)],
      },
      priorStatements: [
        { asOf: d('2026-08-13'), ledgerBalance: -2644.08, dtServer: new Date('2026-08-13T17:00:00Z') }, // tarde
        { asOf: d('2026-08-11'), ledgerBalance: -781.08 },
      ],
      existingLines: [line('2026-08-11', -100)],
    }))
    expect(r.shouldUpdateLiveBalance).toBe(false) // o mais antigo (manhã) não desfaz a tarde
  })
  it('subir a TARDE depois da manhã → SOBRESCREVE (é o mais recente)', () => {
    const r = deriveSaldoAntes(make({
      current: {
        periodStart: d('2026-08-03'), periodEnd: d('2026-08-13'), asOf: d('2026-08-13'),
        dtServer: new Date('2026-08-13T17:00:00Z'), ledgerBalance: -2644.08, lines: [line('2026-08-11', -100)],
      },
      priorStatements: [
        { asOf: d('2026-08-13'), ledgerBalance: -8349.33, dtServer: new Date('2026-08-13T09:00:00Z') }, // manhã
        { asOf: d('2026-08-11'), ledgerBalance: -781.08 },
      ],
      existingLines: [line('2026-08-11', -100)],
    }))
    expect(r.shouldUpdateLiveBalance).toBe(true)
    expect(r.supersedesPriorSameDay).toBe(true)
  })
})

describe('3b) ESCAPE da divergência — destrava e segue (registrado como forçado)', () => {
  it('overrideDivergent → DERIVED_OVERLAP com forcedOverDivergence=true', () => {
    const r = deriveSaldoAntes(make({
      current: {
        periodStart: d('2026-08-03'), periodEnd: d('2026-08-08'), asOf: d('2026-08-08'),
        ledgerBalance: 900, lines: [line('2026-08-04', -100)],
      },
      priorStatements: [{ asOf: d('2026-08-05'), ledgerBalance: 1000 }],
      existingLines: [line('2026-08-04', -999)], // diverge
      overrideDivergent: true, // "é o banco que reemitiu, pode seguir"
    }))
    expect(r.outcome).toBe('DERIVED_OVERLAP')
    expect(r.forcedOverDivergence).toBe(true)
    expect(r.saldoAntes).toBe(1100)
  })
})

describe('6b) histórico não atualiza o saldo vivo', () => {
  it('junho depois de agosto → shouldUpdateLiveBalance=false', () => {
    const r = deriveSaldoAntes(make({
      current: { periodStart: d('2026-06-01'), periodEnd: d('2026-06-30'), asOf: d('2026-06-30'), ledgerBalance: 5000, lines: [line('2026-06-10', -200)] },
      priorStatements: [{ asOf: d('2026-08-31'), ledgerBalance: 9000 }, { asOf: d('2026-05-31'), ledgerBalance: 5200 }],
    }))
    expect(r.isHistorical).toBe(true)
    expect(r.shouldUpdateLiveBalance).toBe(false)
  })
})

describe('extra — só há downloads do mesmo dia (sem anterior real)', () => {
  it('ancora + avisa que só há repetido do mesmo dia', () => {
    const r = deriveSaldoAntes(make({
      current: { periodStart: d('2026-08-03'), periodEnd: d('2026-08-13'), asOf: d('2026-08-13'), ledgerBalance: -2644.08, lines: [line('2026-08-11', -100)] },
      priorStatements: [{ asOf: d('2026-08-13'), ledgerBalance: -8349.33 }],
    }))
    expect(r.saldoAntesKnown).toBe(false)
    expect(r.supersedesPriorSameDay).toBe(true)
    expect(r.message).toMatch(/mesmo dia/i)
  })
})
