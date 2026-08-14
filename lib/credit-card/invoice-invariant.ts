// Sprint Fatura-Paga-Por-Competencia (14/08/2026) — INVARIANTE da fatura paga.
//
// REGRA 5 (disciplina vira impossibilidade): não pode existir fatura marcada como
// PAID/PARTIAL com paidAmount = 0 — isso é "afirmo que pagou E pagou zero" ao mesmo
// tempo. O status TEM que refletir o dinheiro. Este guard é o ponto único que
// qualquer escrita de status pago deve atravessar; chamado no `payInvoice` (o único
// setter de PAID/PARTIAL, provado por REGRA 4). Se um dia surgir outro setter, ele
// chama isto e o erro aparece no teste — não em produção calada.

export class InvoiceInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceInvariantError'
  }
}

/** Barreira: status pago (PAID/PARTIAL) exige paidAmount > 0. Lança se violado. */
export function assertInvoicePaidConsistency(input: { status: string; paidAmount: number }): void {
  const pago = input.status === 'PAID' || input.status === 'PARTIAL'
  if (pago && input.paidAmount <= 0.001) {
    throw new InvoiceInvariantError(
      `Fatura ${input.status} exige paidAmount > 0 (recebeu ${input.paidAmount}). ` +
        `Um pagamento tem que existir antes de marcar a fatura como paga — status deriva do dinheiro, não o contrário.`,
    )
  }
}
