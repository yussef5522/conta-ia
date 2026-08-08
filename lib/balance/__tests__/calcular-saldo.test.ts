// FASE 2.5 (07/08) — regressão do saldo com movimento futuro/agendado.
// Núcleo PURO do recalc. No código pré-fix estas funções não existiam
// (recalc somava TODO date>âncora sem filtrar lifecycle) → import falha = VERMELHO.
// Invariante: no modo âncora, só EFFECTED entra no saldo realizado.

import { describe, it, expect } from 'vitest'
import { calcularSaldo, contaNoSaldoRealizado } from '../recalcular'

const tx = (over: Partial<Parameters<typeof calcularSaldo>[0]['txs'][number]>) => ({
  id: Math.random().toString(36), date: new Date('2026-08-10T12:00:00Z'),
  createdAt: new Date('2026-08-10T12:00:00Z'), type: 'DEBIT', amount: 0,
  bankAccountId: 'acc', transferGroupId: null, transferDirection: null,
  lifecycle: 'EFFECTED', ...over,
})

describe('calcularSaldo — agendado NÃO entra no saldo realizado (anchor)', () => {
  it('caso Banrisul: PAYABLE após âncora excluído, EFFECTED conta → bate LEDGERBAL', () => {
    const txs = [
      tx({ id: 'p1', amount: 70.02, type: 'DEBIT', lifecycle: 'PAYABLE' }),
      tx({ id: 'p2', amount: 1478.51, type: 'DEBIT', lifecycle: 'PAYABLE' }),
      tx({ id: 'p3', amount: 13779.73, type: 'DEBIT', lifecycle: 'PAYABLE' }),
      tx({ id: 'e1', amount: 200, type: 'CREDIT', lifecycle: 'EFFECTED' }),
    ]
    const r = calcularSaldo({ ledgerBal: -6178.45, usaAnchor: true, txs, bankAccountId: 'acc' })
    expect(r.saldo).toBe(-5978.45) // -6178.45 + 200; os -15.328,26 de agendado FORA
    expect(r.txConsideradas).toBe(1) // só o EFFECTED
  })

  it('RECEIVABLE também é excluído do saldo realizado', () => {
    const txs = [tx({ id: 'r', amount: 5000, type: 'CREDIT', lifecycle: 'RECEIVABLE' })]
    const r = calcularSaldo({ ledgerBal: 100, usaAnchor: true, txs, bankAccountId: 'acc' })
    expect(r.saldo).toBe(100) // agendado não soma
  })

  it('lifecycle null (legado) CONTA como realizado', () => {
    const txs = [tx({ id: 'x', amount: 50, type: 'DEBIT', lifecycle: null })]
    const r = calcularSaldo({ ledgerBal: 0, usaAnchor: true, txs, bankAccountId: 'acc' })
    expect(r.saldo).toBe(-50)
  })

  it('SUM_TODAS (caixa manual, sem âncora) NÃO filtra lifecycle', () => {
    const txs = [tx({ id: 'p', amount: 100, type: 'DEBIT', lifecycle: 'PAYABLE' })]
    const r = calcularSaldo({ ledgerBal: null, usaAnchor: false, txs, bankAccountId: 'acc' })
    expect(r.saldo).toBe(-100)
  })
})

describe('contaNoSaldoRealizado', () => {
  it('EFFECTED e null contam; PAYABLE/RECEIVABLE não', () => {
    expect(contaNoSaldoRealizado('EFFECTED')).toBe(true)
    expect(contaNoSaldoRealizado(null)).toBe(true)
    expect(contaNoSaldoRealizado(undefined)).toBe(true)
    expect(contaNoSaldoRealizado('PAYABLE')).toBe(false)
    expect(contaNoSaldoRealizado('RECEIVABLE')).toBe(false)
  })
})
