// Sprint Fatura-Net-Unico — REGRA 3: a ÚNICA função de total. O estorno subtrai;
// import e display dão o MESMO número; o casar acha o mês pelo valor (não "recente").

import { describe, it, expect } from 'vitest'
import { faturaNetTotal, signedFaturaAmount, pickInvoiceMonthByValue } from '../fatura-net-total'
import { checkInvoiceTotals } from '../totals-check'
import type { InvoiceExtraction, InvoiceLine } from '../types'

describe('faturaNetTotal — estorno subtrai, pagamento não conta', () => {
  it('76 DEBIT 7995.55 + 1 CREDIT 99.23 → net 7896.32 (o caso real)', () => {
    const items = [
      { type: 'DEBIT', amount: 7995.55 },
      { type: 'CREDIT', amount: 99.23 },
      { type: 'DEBIT', amount: 7896.32, isCardPayment: true }, // pagamento: ignora
    ]
    const r = faturaNetTotal(items)
    expect(r.compras).toBe(7995.55)
    expect(r.estornos).toBe(99.23)
    expect(r.net).toBe(7896.32)
  })
  it('signedFaturaAmount: CREDIT negativo, pagamento zero', () => {
    expect(signedFaturaAmount({ type: 'CREDIT', amount: 99.23 })).toBe(-99.23)
    expect(signedFaturaAmount({ type: 'DEBIT', amount: 10 })).toBe(10)
    expect(signedFaturaAmount({ type: 'DEBIT', amount: 10, isCardPayment: true })).toBe(0)
  })
})

describe('import e display dão o MESMO net (uma fonte)', () => {
  const line = (kind: InvoiceLine['suggestedKind'], amount: number): InvoiceLine => ({
    date: '2026-07-01', description: 'x', amount, suggestedKind: kind,
  })
  const ext = (over: Partial<InvoiceExtraction>): InvoiceExtraction => ({
    dueDate: null, closingDate: null, totalDeclared: 7995.55, totalToPay: 7896.32, creditLimit: null,
    availableLimit: null, detectedBank: 'Sicredi', cardLastDigitsFound: [], scanQuality: 'GOOD',
    lines: [], notes: [], ...over,
  })
  it('checkInvoiceTotals.totalFatura == faturaNetTotal.net', () => {
    const lines = [line('COMPRA_AVISTA', 7900), line('ENCARGO_FINANCEIRO', 95.55), line('ESTORNO', 99.23)]
    const check = checkInvoiceTotals(ext({ lines }))
    const net = faturaNetTotal(lines.map((l) => ({ type: l.suggestedKind === 'ESTORNO' ? 'CREDIT' : 'DEBIT', amount: l.amount }))).net
    expect(check.totalFatura).toBe(7896.32)
    expect(check.totalFatura).toBe(net)
    expect(check.matches).toBe(true)
  })
})

describe('pickInvoiceMonthByValue — o mês pelo VALOR, não "o mais recente"', () => {
  it('o bug real: pagamento 7896.32 → agosto (net bate), NÃO julho (mais recente)', () => {
    const net = new Map<string, number>([
      ['2026-07', 2304.83],
      ['2026-08', 7896.32], // net = 7995.55 − 99.23
    ])
    expect(pickInvoiceMonthByValue(net, 7896.32)).toBe('2026-08')
  })
  /**
   * ⚠️⚠️ TESTE INVERTIDO COM O MOTIVO ESCRITO (20/10/2026) — ele afirmava
   * `expect(pickInvoiceMonthByValue(net, 9999)).toBe('2026-07')`, ou seja **"sem match por
   * valor → cai na mais recente (fallback)"**.
   *
   * ⛔⛔ Era o fallback que mandou o pagamento de R$ 12.696,23 pra **2026-09** em 20/10: o
   * banner da prévia do import casa *"sem esperar o confirm"*, então a fatura de outubro ainda
   * não existia, nada batia, e o `sort().pop()` escolheu setembro **em silêncio**. Setembro
   * passou a constar PAGO com dois pagamentos e outubro ficou ABERTA.
   *
   * ⭐ A régua que fica: **competência irresolvível é `null`**, e quem recebe `null` RECUSA
   * ensinando. *Melhor um gesto recusado com a saída escrita que um vínculo plausível no mês
   * errado, que ninguém percebe até o juiz rodar.*
   */
  it('sem match por valor → NULL (o fallback "a mais recente" morreu em 20/10)', () => {
    const net = new Map<string, number>([['2026-06', 100], ['2026-07', 200]])
    expect(pickInvoiceMonthByValue(net, 9999)).toBeNull()
  })
  it('o caso REAL de 20/10: a fatura do mês ainda não existe → NULL, nunca o mês anterior', () => {
    // só setembro está no banco (net 8.626,98); o pagamento é da fatura de OUTUBRO,
    // cujas 36 linhas só nasceram 3 minutos depois do gesto.
    const net = new Map<string, number>([['2026-08', 7305.55], ['2026-09', 8626.98]])
    expect(pickInvoiceMonthByValue(net, 12696.23)).toBeNull()
  })
  it('a folga de DEPOIS continua valendo: juros/encargo dentro de 2% ainda casa', () => {
    const net = new Map<string, number>([['2026-09', 8626.98]])
    // 8.700,00 = 8.626,98 + 73,02 (0,85%) — pagamento com juros, caso legítimo
    expect(pickInvoiceMonthByValue(net, 8700)).toBe('2026-09')
  })
})
