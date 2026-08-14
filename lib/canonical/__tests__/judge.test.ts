// Sprint Rearquitetura-Import FASE 3 (13/08) — REGRA 3: executa o juiz. LEDGERBAL
// bidirecional; ambíguo bloqueia; sem explicação não grava; DESCONHECIDA nunca
// em silêncio; 1º import ancora; banco não-confiável avisa; busca limitada avisa.
// Inclui os NÚMEROS REAIS do bug de 13/08 (4.092,02).

import { describe, it, expect } from 'vitest'
import { judgeStatement } from '../judge'
import type { CanonicalStatement, CanonicalStatus, CanonicalTransaction } from '../types'

const ANCHOR = '2026-08-13'
let seq = 0
const line = (signed: number, status: CanonicalStatus, day = '2026-08-11', desc = 'X'): CanonicalTransaction => ({
  stableId: `id-${++seq}`,
  datePosted: new Date(`${day}T12:00:00Z`),
  signedAmount: signed,
  description: desc,
  counterpartyName: null,
  document: null,
  status,
})
const stmt = (lines: CanonicalTransaction[], ledger: number | null, asOf: string | null = ANCHOR): CanonicalStatement => ({
  bankId: '041',
  translatorId: 'BANRISUL',
  conservative: false,
  warnings: [],
  period: { start: null, end: null },
  ledger: { balance: ledger, asOf: asOf ? new Date(`${asOf}T12:00:00Z`) : null },
  transactions: lines,
})

describe('CLOSED — fecha de primeira', () => {
  it('saldoAntes + Σ(EFETIVADA) == LEDGERBAL → grava sem mexer', () => {
    const c = stmt([line(-100, 'EFETIVADA'), line(-50, 'EFETIVADA')], 850)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.outcome).toBe('CLOSED')
    expect(r.closes).toBe(true)
    expect(r.effectedIds).toHaveLength(2)
    expect(r.reclassifications).toHaveLength(0)
  })
})

describe('CLOSED_AFTER_RECLASS — o bug de 13/08 (numeros reais)', () => {
  it('emprestimo 4.092,02 marcado AGENDADA mas o LEDGERBAL conta com ele → vira EFETIVADA', () => {
    // saldoAntes 0 · EFETIVADA -4.257,31 · AGENDADA -4.092,02 (o emprestimo)
    // LEDGERBAL -8.349,33. gap = -8349.33 - (-4257.31) = -4092.02 = o emprestimo.
    const emp = line(-4092.02, 'AGENDADA', '2026-08-11', 'EMPRESTIMO')
    const c = stmt([line(-4257.31, 'EFETIVADA'), emp], -8349.33)
    const r = judgeStatement({ canonical: c, saldoAntes: 0 })
    expect(r.outcome).toBe('CLOSED_AFTER_RECLASS')
    expect(r.closes).toBe(true)
    expect(r.gap).toBe(-4092.02)
    expect(r.reclassifications).toHaveLength(1)
    expect(r.reclassifications[0]).toMatchObject({ stableId: emp.stableId, from: 'AGENDADA', to: 'EFETIVADA' })
    expect(r.reclassifications[0].reason).toMatch(/já conta com esta linha/i)
    expect(r.effectedIds).toContain(emp.stableId)
    expect(r.effectedIds).toHaveLength(2)
    expect(r.summary.reclassUpToEffected).toBe(1)
  })
})

describe('(A) CLOSED_AFTER_RECLASS — persistente-não-liquidada FORA do dia da âncora', () => {
  it('parcela vencida (11/08) que o canônico marcou EFETIVADA e o LEDGERBAL não conta → down-flip via knownScheduled', () => {
    // O caso real: âncora 13/08, mas a 4.092,02 é datada 11/08 (vencida). Sem o
    // knownScheduled, o down-flip só alcança 13/08 e ela escaparia (BLOQUEIO no shadow).
    const parcela = line(-4092.02, 'EFETIVADA', '2026-08-11', 'PRESTACAO EMPRESTIMO')
    const c = stmt([line(-100, 'EFETIVADA', '2026-08-12'), parcela], -100) // LEDGERBAL só conta o -100
    // saldoAntes 0. gap = -100 - (0 + (-100 -4092.02)) = -100 - (-4192.02) = 4092.02.
    const r = judgeStatement({
      canonical: c,
      saldoAntes: 0,
      knownScheduled: [{ date: new Date('2026-08-11T12:00:00Z'), signedAmount: -4092.02 }],
    })
    expect(r.outcome).toBe('CLOSED_AFTER_RECLASS')
    expect(r.closes).toBe(true)
    expect(r.reclassifications).toHaveLength(1)
    expect(r.reclassifications[0]).toMatchObject({ stableId: parcela.stableId, from: 'EFETIVADA', to: 'AGENDADA' })
    expect(r.reclassifications[0].reason).toMatch(/parcela vencida|nunca entrou/i)
    expect(r.effectedIds).not.toContain(parcela.stableId)
    expect(r.summary.reclassDownToScheduled).toBe(1)
  })

  it('SEM knownScheduled a mesma parcela BLOQUEIA (prova que o widening é o que resolve)', () => {
    const parcela = line(-4092.02, 'EFETIVADA', '2026-08-11', 'PRESTACAO EMPRESTIMO')
    const c = stmt([line(-100, 'EFETIVADA', '2026-08-12'), parcela], -100)
    const r = judgeStatement({ canonical: c, saldoAntes: 0 }) // sem knownScheduled
    expect(r.closes).toBe(false)
    expect(r.outcome).toBe('BLOCKED_NO_EXPLANATION')
  })

  it('o LEDGERBAL ainda manda: se a persistente na verdade liquidou (LEDGERBAL a conta), NÃO rebaixa', () => {
    // mesma linha marcada como candidata persistente, MAS o LEDGERBAL fecha COM ela dentro.
    const parcela = line(-4092.02, 'EFETIVADA', '2026-08-11', 'PRESTACAO EMPRESTIMO')
    const c = stmt([line(-100, 'EFETIVADA', '2026-08-12'), parcela], -4192.02) // conta com ela
    const r = judgeStatement({
      canonical: c,
      saldoAntes: 0,
      knownScheduled: [{ date: new Date('2026-08-11T12:00:00Z'), signedAmount: -4092.02 }],
    })
    expect(r.outcome).toBe('CLOSED') // fecha de primeira, não rebaixa
    expect(r.effectedIds).toContain(parcela.stableId)
    expect(r.reclassifications).toHaveLength(0)
  })
})

describe('CLOSED_AFTER_RECLASS — sentido inverso (só dia da âncora)', () => {
  it('EFETIVADA do dia da âncora que o LEDGERBAL NÃO conta → vira AGENDADA', () => {
    // consorcio -1478.51 do DIA DA ÂNCORA (13/08); LEDGERBAL só conta o -100.
    const nao = line(-1478.51, 'EFETIVADA', ANCHOR, 'PAGAMENTO CONSORCIO')
    const c = stmt([line(-100, 'EFETIVADA', ANCHOR), nao], 900) // 1000-100
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.outcome).toBe('CLOSED_AFTER_RECLASS')
    expect(r.reclassifications[0]).toMatchObject({ stableId: nao.stableId, from: 'EFETIVADA', to: 'AGENDADA' })
    expect(r.reclassifications[0].reason).toMatch(/ainda não liquidou/i)
    expect(r.effectedIds).not.toContain(nao.stableId)
    expect(r.summary.reclassDownToScheduled).toBe(1)
  })
  it('EFETIVADA FORA do dia da âncora NÃO é candidata a down-flip (é histórico)', () => {
    // mesma linha, mas datada 11/08 (não é o dia da âncora 13/08) → não flipa → bloqueia
    const nao = line(-1478.51, 'EFETIVADA', '2026-08-11', 'PAGAMENTO CONSORCIO')
    const c = stmt([line(-100, 'EFETIVADA'), nao], 900)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.closes).toBe(false)
  })
})

describe('DESCONHECIDA nunca grava em silêncio', () => {
  it('resolve por LEDGERBAL quando fecha (vira EFETIVADA)', () => {
    const desc = line(-200, 'DESCONHECIDA')
    const c = stmt([line(-100, 'EFETIVADA'), desc], 700)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.outcome).toBe('CLOSED_AFTER_RECLASS')
    expect(r.effectedIds).toContain(desc.stableId)
  })
  it('quando NÃO fecha, fica de fora e vai pras candidatas (não grava)', () => {
    const desc = line(-200, 'DESCONHECIDA')
    const c = stmt([line(-100, 'EFETIVADA'), desc], 950)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.closes).toBe(false)
    expect(r.effectedIds).not.toContain(desc.stableId)
    expect(r.candidates.some((x) => x.stableId === desc.stableId)).toBe(true)
  })
})

describe('BLOCKED — não chuta', () => {
  it('AMBÍGUO: 2 AGENDADA de mesmo valor poderiam fechar → mostra as duas', () => {
    const a = line(-50, 'AGENDADA')
    const b = line(-50, 'AGENDADA')
    const c = stmt([line(-100, 'EFETIVADA'), a, b], 850)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.outcome).toBe('BLOCKED_AMBIGUOUS')
    expect(r.candidates.map((x) => x.stableId).sort()).toEqual([a.stableId, b.stableId].sort())
  })
  it('SEM EXPLICAÇÃO: nada fecha → não grava, mostra a diferença', () => {
    const c = stmt([line(-100, 'EFETIVADA')], 903.33)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.outcome).toBe('BLOCKED_NO_EXPLANATION')
    expect(r.gap).toBe(3.33)
    expect(r.searchMayHaveMissed).toBe(false) // poucos flippáveis → busca completa
  })
})

describe('casos legítimos tratados (o override vira exceção rara)', () => {
  it('1º import (saldoAntesKnown=false) → ANCORA, não bloqueia', () => {
    const c = stmt([line(-100, 'EFETIVADA')], 22000) // conta com abertura grande
    const r = judgeStatement({ canonical: c, saldoAntes: 0, saldoAntesKnown: false })
    expect(r.outcome).toBe('CLOSED_BY_OPENING_ANCHOR')
    expect(r.closes).toBe(true)
  })
  it('banco não-confiável (Stone varre) → GRAVA avisando, não bloqueia', () => {
    const c = stmt([line(-100, 'EFETIVADA')], 500) // não fecha
    const r = judgeStatement({ canonical: c, saldoAntes: 1000, ledgerBalReliable: false })
    expect(r.outcome).toBe('WARN_UNRELIABLE_LEDGER')
    expect(r.closes).toBe(true)
  })
})

describe('NO_LEDGER — sem LEDGERBAL não julga', () => {
  it('arquivo sem saldo declarado → NO_LEDGER, closes false', () => {
    const c = stmt([line(-100, 'EFETIVADA')], null)
    const r = judgeStatement({ canonical: c, saldoAntes: 1000 })
    expect(r.outcome).toBe('NO_LEDGER')
    expect(r.closes).toBe(false)
  })
})
