// Sprint Wiring-do-Juiz — REGRA 3: executa a decisão ÚNICA (canônico→saldoAntes→juiz)
// na composição real da cadeia. Reproduz a FORMA do 13/08 (parcela persistente) e o
// bloqueio de dado inconsistente, e prova preview==confirm (mesma entrada → idêntico).

import { describe, it, expect } from 'vitest'
import { classifyCanonicalForImport, chainPriorStatements, type PriorCanonical } from '../classify-for-import'
import type { CanonicalStatement, CanonicalStatus, CanonicalTransaction } from '../types'

let seq = 0
const tx = (signed: number, day: string, status: CanonicalStatus = 'EFETIVADA', desc = 'X'): CanonicalTransaction => ({
  stableId: `id-${++seq}`,
  datePosted: new Date(`${day}T12:00:00Z`),
  signedAmount: signed,
  description: desc,
  counterpartyName: null,
  document: null,
  status,
})
const stmt = (
  lines: CanonicalTransaction[],
  ledger: number,
  asOf: string,
  period: [string, string],
): CanonicalStatement => ({
  bankId: '041',
  translatorId: 'BANRISUL',
  conservative: false,
  warnings: [],
  period: { start: new Date(`${period[0]}T12:00:00Z`), end: new Date(`${period[1]}T12:00:00Z`) },
  ledger: { balance: ledger, asOf: new Date(`${asOf}T12:00:00Z`) },
  transactions: lines,
})

describe('cadeia — prior.lines é PÓS-JUIZ (não re-subtrai a linha deferida)', () => {
  it('o consórcio deferido no 11/08 NÃO volta a ser subtraído no 13/08', () => {
    // 11/08: LEDGERBAL -781.08, mas lista o consórcio -1478.51 datado 11/08 que ainda
    // não debitou (o juiz rebaixa). saldoAntes 11/08 assumido conhecido via prior 07/08.
    const consorcio = tx(-1478.51, '2026-08-11', 'EFETIVADA', 'CONSORCIO')
    const s07 = stmt([tx(-100, '2026-08-06')], -1000, '2026-08-07', ['2026-08-03', '2026-08-07'])
    // 11/08 fecha rebaixando o consórcio: saldoAntes(07)=-1000, +(-100 do overlap já
    // no 07)... simplificamos: o 11 tem uma linha -50 nova + o consórcio.
    const s11 = stmt([tx(-50, '2026-08-09'), consorcio], -1050, '2026-08-11', ['2026-08-03', '2026-08-11'])
    const priors: PriorCanonical[] = [
      { canonical: s07, dtServer: new Date('2026-08-07T18:00:00Z') },
      { canonical: s11, dtServer: new Date('2026-08-11T05:00:00Z') },
    ]
    const chained = chainPriorStatements(priors)
    // o 11/08 deve ter deferido o consórcio → suas prior.lines NÃO contêm -1478.51
    const s11Prior = chained.find((p) => p.asOf.toISOString().slice(0, 10) === '2026-08-11')!
    const s11Lines = s11Prior.lines ?? []
    expect(s11Lines.some((l) => l.signedAmount === -1478.51)).toBe(false)
    expect(s11Lines.some((l) => l.signedAmount === -50)).toBe(true)
  })
})

describe('13/08 (forma real) — a parcela persistente é decidida pelo LEDGERBAL', () => {
  // prior 11/08 (LEDGERBAL -781.08) SEM a 4.092,02. atual 13/08 lista a 4.092,02
  // datada 11/08 (não estava no 11) + movimento novo. O LEDGERBAL do 13 decide.
  const build = (ledger13: number) => {
    seq = 0
    const s11 = stmt([tx(-200, '2026-08-10')], -781.08, '2026-08-11', ['2026-08-03', '2026-08-11'])
    const parcela = tx(-4092.02, '2026-08-11', 'EFETIVADA', 'PRESTACAO EMPRESTIMO')
    const s13 = stmt(
      [tx(-200, '2026-08-10'), parcela, tx(-50, '2026-08-12')],
      ledger13,
      '2026-08-13',
      ['2026-08-03', '2026-08-13'],
    )
    return { s11, s13, parcela }
  }

  it('LEDGERBAL conta com a 4.092,02 (debitou atrasada) → IMPORTA', () => {
    // saldoAntes(13) = -781.08 - Σ(matched=[-200]) = -581.08.
    // com a 4.092,02 dentro: -581.08 + (-200 -4092.02 -50) = -4923.10.
    const { s11, s13, parcela } = build(-4923.1)
    const r = classifyCanonicalForImport({
      current: s13,
      currentDtServer: new Date('2026-08-13T18:00:00Z'),
      priors: [{ canonical: s11, dtServer: new Date('2026-08-11T05:00:00Z') }],
    })
    expect(r.blocked).toBe(false)
    const idx = s13.transactions.indexOf(parcela)
    expect(r.importable[idx]).toBe(true) // debitou → importa
    expect(r.judge.closes).toBe(true)
  })

  it('LEDGERBAL NÃO conta com a 4.092,02 (não debitou) → NÃO importa, sem bloquear', () => {
    // sem a 4.092,02: -581.08 + (-200 -50) = -831.08.
    const { s11, s13, parcela } = build(-831.08)
    const r = classifyCanonicalForImport({
      current: s13,
      currentDtServer: new Date('2026-08-13T18:00:00Z'),
      priors: [{ canonical: s11, dtServer: new Date('2026-08-11T05:00:00Z') }],
    })
    expect(r.blocked).toBe(false)
    const idx = s13.transactions.indexOf(parcela)
    expect(r.importable[idx]).toBe(false) // não debitou → fica de fora (agendada)
    expect(r.judge.reclassifications.some((x) => x.signedAmount === -4092.02 && x.to === 'AGENDADA')).toBe(true)
  })
})

describe('dado inconsistente → BLOQUEIA (nunca grava em silêncio)', () => {
  it('LEDGERBAL que não fecha e nada explica → blocked=true, mensagem clara', () => {
    seq = 0
    const s11 = stmt([tx(-200, '2026-08-10')], -781.08, '2026-08-11', ['2026-08-03', '2026-08-11'])
    // 13/08 com um LEDGERBAL que não bate com nenhuma combinação plausível.
    const s13 = stmt([tx(-200, '2026-08-10'), tx(-50, '2026-08-12')], -99999, '2026-08-13', ['2026-08-03', '2026-08-13'])
    const r = classifyCanonicalForImport({
      current: s13,
      currentDtServer: new Date('2026-08-13T18:00:00Z'),
      priors: [{ canonical: s11, dtServer: new Date('2026-08-11T05:00:00Z') }],
    })
    expect(r.blocked).toBe(true)
    expect(r.message).toMatch(/não fecha|não vou gravar/i)
  })
})

describe('preview == confirm — a MESMA entrada dá o MESMO resultado', () => {
  it('duas chamadas idênticas → importable idêntico (determinístico, sem relógio)', () => {
    seq = 0
    const s11 = stmt([tx(-200, '2026-08-10')], -781.08, '2026-08-11', ['2026-08-03', '2026-08-11'])
    const s13 = stmt(
      [tx(-200, '2026-08-10'), tx(-4092.02, '2026-08-11'), tx(-50, '2026-08-12')],
      -4923.1,
      '2026-08-13',
      ['2026-08-03', '2026-08-13'],
    )
    const mk = () =>
      classifyCanonicalForImport({
        current: s13,
        currentDtServer: new Date('2026-08-13T18:00:00Z'),
        priors: [{ canonical: s11, dtServer: new Date('2026-08-11T05:00:00Z') }],
      })
    const a = mk()
    const b = mk()
    expect(a.importable).toEqual(b.importable)
    expect(a.blocked).toBe(b.blocked)
    expect(a.effectedIds).toEqual(b.effectedIds)
  })
})

describe('1º import (sem anterior) → ancora, não bloqueia', () => {
  it('nenhum prior → importa o efetivado, blocked=false', () => {
    seq = 0
    const s = stmt([tx(-200, '2026-06-10'), tx(-50, '2026-06-11')], -250, '2026-06-30', ['2026-06-01', '2026-06-30'])
    const r = classifyCanonicalForImport({ current: s, currentDtServer: new Date('2026-06-30T18:00:00Z'), priors: [] })
    expect(r.blocked).toBe(false)
    expect(r.importable.every((x) => x)).toBe(true)
  })
})
