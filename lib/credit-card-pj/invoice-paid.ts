// Sprint Fatura-Paga-Por-Competencia (14/08/2026) — a decisão ÚNICA de "esta fatura
// (competência) foi paga?". Pura, testável. Regra: paga = existe pagamento amarrado
// à MESMA competência (paidInvoiceMonth). Um pagamento de outro mês NÃO paga esta.
//
// Antes o "paga" era por-cartão-pra-sempre ("o cartão tem algum pagamento?") — o que
// fazia a fatura de setembro nascer paga por causa do pagamento de junho. Aqui a
// competência tem que BATER.

/** A competência `competencia` foi paga, dado os meses que os pagamentos do cartão quitam? */
export function invoiceMonthIsPaid(
  paidInvoiceMonths: Array<string | null | undefined>,
  competencia: string | null | undefined,
): boolean {
  if (!competencia) return false
  return paidInvoiceMonths.some((m) => m === competencia)
}
