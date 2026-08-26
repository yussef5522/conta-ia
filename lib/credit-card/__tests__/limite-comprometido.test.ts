// REGRA 1 — o limite contava SÓ a fatura importada (26/08).
//
// O DONO PEGOU: o cartão dizia R$ 18.348,72 de usado enquanto o banco tinha ~40 mil
// comprometidos. E o pior nem estava na tela ainda: **ao casar o pagamento, o usado
// ZERARIA** — o sistema afirmaria limite inteiro livre com R$ 28.989,62 de parcelado
// pendurado. A própria fatura avisa: *"o valor total do parcelamento COMPROMETERÁ o
// limite de crédito do seu cartão e será recomposto à medida que as parcelas forem
// pagas."*

import { describe, it, expect } from 'vitest'
import { calculateCardSummary, type CardSummaryInput } from '../calculate-card-summary'

// Os números REAIS do cartão do dono.
const LIMITE = 76150
const FATURA = 18348.72
const PARCELADO = 28989.62 // ago 10.747,10 + set 5.012,90 + demais 13.229,62
const PISO = 47338.34 // o que o dono calculou: 18.348,72 + 28.989,62

const AGORA = new Date(Date.UTC(2026, 7, 26))
const base = (paid: number, parcelado: number | null): CardSummaryInput => ({
  cardId: 'c1',
  creditLimit: LIMITE,
  invoices: [{
    id: 'i1', reference: '2026-07',
    closingDate: new Date(Date.UTC(2026, 6, 29)),
    dueDate: new Date(Date.UTC(2026, 7, 10)),
    totalAmount: FATURA, paidAmount: paid, status: paid >= FATURA ? 'PAID' : 'OVERDUE',
  }],
  futureParcelasNotInvoiced: [],
  parceladoAVencer: parcelado,
})

describe('o limite conta TUDO que o banco compromete', () => {
  it('⭐ com a fatura em aberto: usado = fatura + parcelado a vencer', () => {
    const r = calculateCardSummary(base(0, PARCELADO), AGORA)
    expect(r.limitUsed).toBeCloseTo(PISO, 2)
    expect(r.limitBreakdown.faturasNaoPagas).toBeCloseTo(FATURA, 2)
    expect(r.limitBreakdown.parceladoAVencer).toBeCloseTo(PARCELADO, 2)
  })

  it('⭐⭐ PAGAR A FATURA NÃO ZERA — o parcelado continua comprometendo', () => {
    const r = calculateCardSummary(base(FATURA, PARCELADO), AGORA)
    expect(r.limitUsed).toBeCloseTo(PARCELADO, 2) // NÃO é 0
    expect(r.limitBreakdown.faturasNaoPagas).toBe(0) // a fatura liberou
    expect(r.limitBreakdown.parceladoAVencer).toBeCloseTo(PARCELADO, 2)
  })

  it('o disponível cai junto — nunca afirma limite inteiro livre', () => {
    const r = calculateCardSummary(base(FATURA, PARCELADO), AGORA)
    expect(r.limitAvailable).toBeCloseTo(LIMITE - PARCELADO, 2)
    expect(r.limitAvailable).toBeLessThan(LIMITE)
  })

  it('⚠️ o comportamento ANTIGO (só faturas) daria o número errado', () => {
    const antigo = calculateCardSummary(base(0, null), AGORA)
    expect(antigo.limitUsed).toBeCloseTo(FATURA, 2) // era isso que a tela mostrava
    expect(antigo.limitUsed).toBeLessThan(PISO)
    // e ao pagar, zerava:
    expect(calculateCardSummary(base(FATURA, null), AGORA).limitUsed).toBe(0)
  })

  it('⭐ o ciclo atual é SEMPRE desconhecido — o usado é um PISO', () => {
    const r = calculateCardSummary(base(0, PARCELADO), AGORA)
    expect(r.limitBreakdown.cicloAtualDesconhecido).toBe(true)
    // a tela usa isso pra dizer "pelo menos" / "no máximo"
  })

  it('cartão sem PDF importado não inventa parcelado (fica só a fatura)', () => {
    const r = calculateCardSummary(base(0, null), AGORA)
    expect(r.limitBreakdown.parceladoAVencer).toBe(0)
    expect(r.limitUsed).toBeCloseTo(FATURA, 2)
  })

  it('percentual e barra acompanham o usado real', () => {
    const r = calculateCardSummary(base(0, PARCELADO), AGORA)
    expect(r.limitUsedPercent).toBeCloseTo((PISO / LIMITE) * 100, 1)
    expect(r.limitUsedPercent).toBeGreaterThan(60) // antes marcava ~24%
  })

  it('⚠️ não dobra: o parcelado A VENCER não inclui o que já está na fatura', () => {
    // o banco declara "a vencer" — o que está na fatura corrente já saiu de lá.
    // Somar os dois é correto justamente porque são conjuntos disjuntos.
    const r = calculateCardSummary(base(0, PARCELADO), AGORA)
    expect(r.limitUsed).toBeCloseTo(FATURA + PARCELADO, 2)
    expect(r.limitUsed).toBeLessThan(LIMITE) // ainda cabe no limite — sanidade
  })
})
