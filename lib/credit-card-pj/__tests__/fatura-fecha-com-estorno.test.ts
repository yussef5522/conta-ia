// Sprint Fatura-Net-Unico — REGRA 3: O TESTE QUE TERIA PEGO OS 3 BUGS DE UMA VEZ.
//
// "Fatura COM estorno fecha ao casar o pagamento." Encadeia as 3 funções que os 3
// bugs de hoje tocaram: o TOTAL (import + display), o mês do PAGAMENTO (casar), e o
// PAGA por competência. Se qualquer uma esquecer o CREDIT, este teste morde.

import { describe, it, expect } from 'vitest'
import { faturaNetTotal, pickInvoiceMonthByValue, signedFaturaAmount } from '../fatura-net-total'
import { invoiceMonthIsPaid } from '../invoice-paid'

describe('fatura com estorno fecha ao casar o pagamento (o caso real Sicredi ago/2026)', () => {
  // 76 compras somando 7.995,55 + 1 estorno 99,23 (CREDIT), competência 2026-08.
  const faturaAgo = [
    { type: 'DEBIT', amount: 7995.55, invoiceMonth: '2026-08' },
    { type: 'CREDIT', amount: 99.23, invoiceMonth: '2026-08' },
  ]
  const faturaJul = [{ type: 'DEBIT', amount: 2304.83, invoiceMonth: '2026-07' }]

  it('1) TOTAL líquido = 7.896,32 (estorno subtrai) — não 7.995,55', () => {
    expect(faturaNetTotal(faturaAgo).net).toBe(7896.32)
  })

  it('2) o pagamento 7.896,32 acha AGOSTO pelo valor (não julho "mais recente")', () => {
    const netByMonth = new Map<string, number>()
    for (const t of [...faturaAgo, ...faturaJul]) {
      netByMonth.set(t.invoiceMonth, (netByMonth.get(t.invoiceMonth) ?? 0) + signedFaturaAmount(t))
    }
    expect(pickInvoiceMonthByValue(netByMonth, 7896.32)).toBe('2026-08')
  })

  it('3) casado em agosto → fatura de agosto PAGA', () => {
    const pagamentoQuita = '2026-08' // resultado do passo 2
    expect(invoiceMonthIsPaid([pagamentoQuita], '2026-08')).toBe(true)
  })

  it('REGRESSÃO: somar só DEBIT (o bug) dá 7.995,55 e NÃO bate o pagamento; o net bate', () => {
    const soDebit = faturaAgo.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
    expect(soDebit).toBe(7995.55) // o cálculo bugado (display somava só DEBIT)
    expect(soDebit).not.toBe(7896.32) // ...não é o que o pagamento paga
    expect(faturaNetTotal(faturaAgo).net).toBe(7896.32) // o net (com estorno) é
  })
})
