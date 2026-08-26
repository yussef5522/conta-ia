// REGRA 1/3 — os 3 lançamentos REAIS da parcela #21 do C41033828 (25/08/2026).
// A conta não tinha saldo e o Sicredi debitou conforme o dinheiro entrava.
// Antes: caíam em "escolha você". Depois: cada uma vem sugerida com contrato + parcela.

import { describe, it, expect } from 'vitest'
import { sugerirVinculoEmprestimo, escolherParcela, type ParcelaLite } from '../sugerir-vinculo'
import type { DetectLoanLite } from '../detect-payment'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

// Os contratos REAIS da Cacula no Sicredi (mesma conta) — o detector tem que
// escolher o certo pelo número na descrição, não pelo dia de vencimento.
const LOANS: DetectLoanLite[] = [
  { id: 'L-3828', contractNumber: 'C41033828-8', lender: 'Sicredi', status: 'ACTIVE', dueDay: 25 },
  { id: 'L-2227', contractNumber: 'C41022227-1', lender: 'Sicredi', status: 'ACTIVE', dueDay: 25 },
  { id: 'L-caixa', contractNumber: '000000000001837311', lender: 'Caixa Econômica Federal', status: 'ACTIVE', dueDay: 25 },
]

// Agenda real do C41033828 em torno da #21.
const PARCELAS: ParcelaLite[] = [
  { number: 19, dueDate: d('2026-06-25'), payment: 10234.35, status: 'PAID', paidTotal: 10234.35 },
  { number: 20, dueDate: d('2026-07-25'), payment: 10234.35, status: 'PAID', paidTotal: 10234.35 },
  { number: 21, dueDate: d('2026-08-25'), payment: 10234.35, status: 'OPEN', paidTotal: 0 },
  { number: 22, dueDate: d('2026-09-25'), payment: 10234.35, status: 'OPEN', paidTotal: 0 },
]
const mapa = (ps: ParcelaLite[]) => ({ 'L-3828': ps })

// As 3 MORDIDAS REAIS, na ordem em que o banco debitou.
const MORDIDAS = [
  { description: 'AMORTIZACAO CONTRATO-C41033828', amount: 4923.71 },
  { description: 'AMORTIZACAO CONTRATO-C41033828', amount: 3224.94 },
  { description: 'LIQUIDACAO DE PARCELA-C41033828', amount: 2085.70 },
]

describe('as 3 mordidas reais da #21', () => {
  it('a 1ª já vem SUGERIDA com contrato e parcela (antes: "escolha você")', () => {
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[0], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(PARCELAS))
    expect(s?.kind).toBe('SUGERIDO')
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.loanId).toBe('L-3828')
    expect(s.contractNumber).toBe('C41033828-8')
    expect(s.installmentNumber).toBe(21)
    expect(s.parcial).toBe(true)
    expect(s.faltaDepois).toBe(5310.64) // 10234.35 − 4923.71
    expect(s.rotulo).toContain('C41033828-8')
    expect(s.rotulo).toContain('parcela 21')
  })

  it('a 2ª (a que o banco pegou logo após o PIX da Tuna) sugere a MESMA parcela', () => {
    const parcial = PARCELAS.map((p) => (p.number === 21 ? { ...p, paidTotal: 4923.71 } : p))
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[1], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(parcial))
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.installmentNumber).toBe(21)
    expect(s.parcial).toBe(true)
    expect(s.faltaDepois).toBe(2085.70) // exatamente a 3ª mordida
  })

  it('a 3ª FECHA a parcela — deixa de ser parcial', () => {
    const parcial = PARCELAS.map((p) => (p.number === 21 ? { ...p, paidTotal: 8148.65 } : p))
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[2], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(parcial))
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.installmentNumber).toBe(21)
    expect(s.parcial).toBe(false)
    expect(s.faltaDepois).toBe(0)
    expect(s.rotulo).toBe('Pgto empréstimo C41033828-8 — parcela 21')
  })

  it('⭐ as 3 somam a parcela AO CENTAVO e todas apontam pra #21', () => {
    let pago = 0
    const nums: number[] = []
    for (const m of MORDIDAS) {
      const ps = PARCELAS.map((p) => (p.number === 21 ? { ...p, paidTotal: pago } : p))
      const s = sugerirVinculoEmprestimo({ ...m, type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(ps))
      if (s?.kind !== 'SUGERIDO') throw new Error('devia sugerir')
      nums.push(s.installmentNumber)
      pago = Math.round((pago + m.amount) * 100) / 100
    }
    expect(nums).toEqual([21, 21, 21])
    expect(pago).toBe(10234.35)
  })

  it('não confunde com o OUTRO contrato Sicredi da mesma conta', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'LIQUIDACAO DE PARCELA-C41022227', amount: 7335.85, type: 'DEBIT', date: d('2026-08-17') },
      LOANS, { 'L-2227': [{ number: 22, dueDate: d('2026-08-25'), payment: 7335.85, status: 'OPEN' }] })
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.loanId).toBe('L-2227')
  })
})

describe('o que NÃO deve adivinhar', () => {
  it('descrição sem número (Banrisul "EMPRESTIMO") → devolve candidatos pro dono', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'EMPRESTIMO', amount: 4092.02, type: 'DEBIT', date: d('2026-08-11') },
      LOANS, mapa(PARCELAS))
    expect(s?.kind).toBe('ESCOLHER')
  })

  it('contrato na descrição que NÃO está cadastrado → avisa, não inventa', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'AMORTIZACAO CONTRATO-C99999999', amount: 100, type: 'DEBIT', date: d('2026-08-25') },
      LOANS, mapa(PARCELAS))
    expect(s?.kind).toBe('NAO_CADASTRADO')
  })

  it('CREDIT nunca é pagamento de parcela', () => {
    expect(sugerirVinculoEmprestimo(
      { description: 'AMORTIZACAO CONTRATO-C41033828', amount: 10, type: 'CREDIT', date: d('2026-08-25') },
      LOANS, mapa(PARCELAS))).toBeNull()
  })

  it('contrato certo mas SEM parcela aberta → não força, manda escolher', () => {
    const todasPagas = PARCELAS.map((p) => ({ ...p, status: 'PAID' }))
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[0], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(todasPagas))
    expect(s?.kind).toBe('ESCOLHER')
  })
})

describe('escolherParcela', () => {
  it('pega a aberta com vencimento mais próximo da data do débito', () => {
    expect(escolherParcela(PARCELAS, d('2026-08-25'))?.number).toBe(21)
    expect(escolherParcela(PARCELAS, d('2026-09-20'))?.number).toBe(22)
  })

  it('empate de distância → a MAIS ANTIGA (o banco cobra a velha primeiro)', () => {
    const ps: ParcelaLite[] = [
      { number: 21, dueDate: d('2026-08-20'), payment: 100, status: 'OPEN' },
      { number: 22, dueDate: d('2026-08-30'), payment: 100, status: 'OPEN' },
    ]
    expect(escolherParcela(ps, d('2026-08-25'))?.number).toBe(21)
  })

  it('sem parcela aberta → null', () => {
    expect(escolherParcela(PARCELAS.map((p) => ({ ...p, status: 'PAID' })), d('2026-08-25'))).toBeNull()
  })
})
