// Sprint PF Fatia 2 — Gera as N parcelas de uma compra parcelada.
//
// FUNÇÃO PURA: input = compra + N parcelas + config cartão.
// Output = array de N InstallmentRow ordenado por número da parcela.
//
// Garantias:
//   - sum(amounts) === totalAmount (precisão centavo via "última parcela ajusta resto")
//   - Cada parcela cai na fatura correta calculada por
//     calculateInvoiceReference(addMonths(purchase, N-1), card)
//   - Compra 31/jan em 6x → 28/fev, 31/mar, 30/abr, 31/mai, 30/jun, 31/jul
//   - Limite hard: 1 a 24 parcelas (decisão Yussef #2)

import { addMonths } from '@/lib/dates/add-months'
import {
  calculateInvoiceReference,
  type CardConfig,
  type InvoiceReferenceResult,
} from './calculate-invoice-reference'

export const MAX_INSTALLMENTS = 24

export interface BuildInstallmentsInput {
  purchaseDate: Date
  totalAmount: number   // R$ total
  installments: number  // 1 a 24
  card: CardConfig
}

export interface InstallmentRow {
  installmentNumber: number
  installmentTotal: number
  date: Date           // data desta parcela (purchaseDate + (N-1) meses)
  amount: number       // valor desta parcela (somam exatamente totalAmount)
  reference: string    // YYYY-MM da fatura
  closingDate: Date
  dueDate: Date
}

export function buildInstallments(input: BuildInstallmentsInput): InstallmentRow[] {
  validate(input)

  const { purchaseDate, totalAmount, installments, card } = input

  // Round half-up das parcelas base (centavos)
  // Pra precisão de centavo: trabalhar em INTEIROS (cents) e dividir.
  const totalCents = Math.round(totalAmount * 100)
  const baseCents = Math.floor(totalCents / installments)
  const lastCents = totalCents - baseCents * (installments - 1)

  const rows: InstallmentRow[] = []
  for (let i = 1; i <= installments; i++) {
    const date = addMonths(purchaseDate, i - 1)
    const invoiceRef: InvoiceReferenceResult = calculateInvoiceReference(date, card)
    const amountCents = i === installments ? lastCents : baseCents
    rows.push({
      installmentNumber: i,
      installmentTotal: installments,
      date,
      amount: amountCents / 100,
      reference: invoiceRef.reference,
      closingDate: invoiceRef.closingDate,
      dueDate: invoiceRef.dueDate,
    })
  }
  return rows
}

function validate(input: BuildInstallmentsInput): void {
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error(`totalAmount inválido: ${input.totalAmount}`)
  }
  if (
    !Number.isInteger(input.installments) ||
    input.installments < 1 ||
    input.installments > MAX_INSTALLMENTS
  ) {
    throw new Error(
      `installments inválido: ${input.installments} (esperado 1 a ${MAX_INSTALLMENTS})`,
    )
  }
  if (!(input.purchaseDate instanceof Date) || Number.isNaN(input.purchaseDate.getTime())) {
    throw new Error('purchaseDate inválido')
  }
}
