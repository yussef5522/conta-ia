// Sprint PF Fatia 2 — Em qual fatura uma compra cai?
//
// FUNÇÃO PURA: input = data da compra + config do cartão.
// Output = reference (YYYY-MM) + closingDate + dueDate da fatura alvo.
//
// Pegadinhas resolvidas (#1 e #2 do estudo):
//   - Compra no dia do fechamento: closingDayRule ATUAL vs PROXIMA
//   - closingDay > dias do mês: clamp pro último dia
//   - dueDay < closingDay: vencimento vai pro mês seguinte automaticamente

import { lastDayOfMonthUTC } from '@/lib/dates/add-months'

export interface CardConfig {
  closingDay: number          // 1-31
  dueDay: number              // 1-31
  closingDayRule: 'ATUAL' | 'PROXIMA'
}

export interface InvoiceReferenceResult {
  reference: string           // "YYYY-MM"
  closingDate: Date           // Date UTC
  dueDate: Date               // Date UTC
}

/**
 * Dado uma data de compra e a config do cartão, retorna em qual fatura
 * ela cai (reference + closingDate + dueDate exatos).
 *
 * Regra:
 *   - Compra ANTES do dia do fechamento → fatura DESSE mês
 *   - Compra DEPOIS do dia do fechamento → fatura PRÓXIMO mês
 *   - Compra NO dia do fechamento:
 *       closingDayRule='ATUAL'  → fatura DESSE mês
 *       closingDayRule='PROXIMA' → fatura PRÓXIMO mês
 *
 * dueDate é calculado a partir da closingDate alvo:
 *   - Se dueDay > closingDay (caso comum, ex: fecha 5, vence 12) →
 *     vencimento no MESMO mês da fatura
 *   - Se dueDay <= closingDay (caso raro, ex: fecha 25, vence 5) →
 *     vencimento no PRÓXIMO mês após o fechamento
 */
export function calculateInvoiceReference(
  purchaseDate: Date,
  card: CardConfig,
): InvoiceReferenceResult {
  validateCard(card)

  const purchaseYear = purchaseDate.getUTCFullYear()
  const purchaseMonth = purchaseDate.getUTCMonth()
  const purchaseDay = purchaseDate.getUTCDate()

  // Clamp closingDay pra dias reais do mês da compra
  const closingDayInPurchaseMonth = Math.min(
    card.closingDay,
    lastDayOfMonthUTC(purchaseYear, purchaseMonth),
  )

  // Decidir qual mês "fecha" a fatura
  let invoiceClosingYear: number
  let invoiceClosingMonth: number

  if (purchaseDay < closingDayInPurchaseMonth) {
    // Compra ANTES do fechamento → fatura desse mês
    invoiceClosingYear = purchaseYear
    invoiceClosingMonth = purchaseMonth
  } else if (purchaseDay > closingDayInPurchaseMonth) {
    // Compra DEPOIS do fechamento → próximo mês
    const next = nextMonth(purchaseYear, purchaseMonth)
    invoiceClosingYear = next.year
    invoiceClosingMonth = next.month
  } else {
    // EXATAMENTE no fechamento
    if (card.closingDayRule === 'ATUAL') {
      invoiceClosingYear = purchaseYear
      invoiceClosingMonth = purchaseMonth
    } else {
      const next = nextMonth(purchaseYear, purchaseMonth)
      invoiceClosingYear = next.year
      invoiceClosingMonth = next.month
    }
  }

  // closingDate exato com clamp pro último dia
  const closingDayClamped = Math.min(
    card.closingDay,
    lastDayOfMonthUTC(invoiceClosingYear, invoiceClosingMonth),
  )
  const closingDate = new Date(
    Date.UTC(invoiceClosingYear, invoiceClosingMonth, closingDayClamped),
  )

  // dueDate: se dueDay > closingDay → mesmo mês; se <= → próximo mês
  let dueYear: number
  let dueMonth: number
  if (card.dueDay > card.closingDay) {
    dueYear = invoiceClosingYear
    dueMonth = invoiceClosingMonth
  } else {
    const next = nextMonth(invoiceClosingYear, invoiceClosingMonth)
    dueYear = next.year
    dueMonth = next.month
  }
  const dueDayClamped = Math.min(card.dueDay, lastDayOfMonthUTC(dueYear, dueMonth))
  const dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDayClamped))

  const reference = `${invoiceClosingYear}-${String(invoiceClosingMonth + 1).padStart(2, '0')}`

  return { reference, closingDate, dueDate }
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 11) return { year: year + 1, month: 0 }
  return { year, month: month + 1 }
}

function validateCard(card: CardConfig): void {
  if (!Number.isInteger(card.closingDay) || card.closingDay < 1 || card.closingDay > 31) {
    throw new Error(`closingDay inválido: ${card.closingDay} (esperado 1-31)`)
  }
  if (!Number.isInteger(card.dueDay) || card.dueDay < 1 || card.dueDay > 31) {
    throw new Error(`dueDay inválido: ${card.dueDay} (esperado 1-31)`)
  }
  if (card.closingDayRule !== 'ATUAL' && card.closingDayRule !== 'PROXIMA') {
    throw new Error(`closingDayRule inválido: ${card.closingDayRule}`)
  }
}
