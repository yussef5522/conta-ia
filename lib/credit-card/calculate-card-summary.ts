// Sprint PF Fatia 2 — KPIs do cartão (1 cartão).
//
// FUNÇÃO PURA: input = cartão + invoices + parcelas futuras.
// Output = limite usado/disponível + fatura atual + preview próxima.
//
// Pegadinha #8 (limite real-time): sem armazenamento. Cálculo em query.

export interface CardSummaryInput {
  cardId: string
  creditLimit: number
  invoices: Array<{
    id: string
    reference: string
    closingDate: Date
    dueDate: Date
    totalAmount: number
    paidAmount: number
    status: string // OPEN | CLOSED | PAID | PARTIAL | OVERDUE
  }>
  /** Parcelas futuras não-faturadas (já estão em invoice mas precisa filtrar) */
  futureParcelasNotInvoiced: Array<{ amount: number; reference: string }>
}

export interface CardSummaryResult {
  cardId: string
  creditLimit: number
  limitUsed: number
  limitAvailable: number
  limitUsedPercent: number   // 0..100 (clamp)
  currentInvoice: {
    id: string
    reference: string
    totalAmount: number
    paidAmount: number
    closingDate: Date
    dueDate: Date
    daysUntilClosing: number   // negativo se já fechou
    daysUntilDue: number       // negativo se já venceu
  } | null
  nextInvoicePreview: number    // valor previsto da próxima fatura
}

/**
 * Limite usado = soma dos saldos não pagos das invoices em
 * (OPEN, CLOSED, PARTIAL, OVERDUE) + parcelas futuras não-faturadas.
 * PAID não conta no limite usado.
 */
export function calculateCardSummary(input: CardSummaryInput, now: Date): CardSummaryResult {
  const ACTIVE_STATUSES = new Set(['OPEN', 'CLOSED', 'PARTIAL', 'OVERDUE'])

  let limitUsedFromInvoices = 0
  for (const inv of input.invoices) {
    if (!ACTIVE_STATUSES.has(inv.status)) continue
    const remaining = inv.totalAmount - inv.paidAmount
    if (remaining > 0) limitUsedFromInvoices += remaining
  }

  const limitUsedFromFuture = input.futureParcelasNotInvoiced.reduce(
    (s, p) => s + p.amount,
    0,
  )

  const limitUsed = limitUsedFromInvoices + limitUsedFromFuture
  const limitAvailable = Math.max(0, input.creditLimit - limitUsed)
  const limitUsedPercent =
    input.creditLimit > 0 ? Math.min(100, (limitUsed / input.creditLimit) * 100) : 0

  // Fatura "atual" = a próxima a fechar (closingDate >= now) com menor closingDate.
  // Se nenhuma futura aberta, pega a mais recente CLOSED ou PARTIAL.
  const openOrUpcoming = input.invoices
    .filter((i) => i.status === 'OPEN')
    .sort((a, b) => a.closingDate.getTime() - b.closingDate.getTime())

  const closedUnpaid = input.invoices
    .filter((i) => i.status === 'CLOSED' || i.status === 'PARTIAL' || i.status === 'OVERDUE')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  const currentRaw = openOrUpcoming[0] ?? closedUnpaid[0] ?? null

  const currentInvoice = currentRaw
    ? {
        id: currentRaw.id,
        reference: currentRaw.reference,
        totalAmount: currentRaw.totalAmount,
        paidAmount: currentRaw.paidAmount,
        closingDate: currentRaw.closingDate,
        dueDate: currentRaw.dueDate,
        daysUntilClosing: Math.floor(
          (currentRaw.closingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        ),
        daysUntilDue: Math.floor(
          (currentRaw.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        ),
      }
    : null

  // Próxima fatura preview = parcelas futuras + invoices OPEN diferentes da atual
  let nextInvoicePreview = 0
  if (currentInvoice) {
    // Segunda OPEN (após a atual) ou soma de parcelas no próximo mês
    const nextRef = nextReferenceOf(currentInvoice.reference)
    nextInvoicePreview = input.futureParcelasNotInvoiced
      .filter((p) => p.reference === nextRef)
      .reduce((s, p) => s + p.amount, 0)
    const nextOpen = openOrUpcoming.find((i) => i.reference === nextRef)
    if (nextOpen) nextInvoicePreview += nextOpen.totalAmount
  }

  return {
    cardId: input.cardId,
    creditLimit: input.creditLimit,
    limitUsed,
    limitAvailable,
    limitUsedPercent,
    currentInvoice,
    nextInvoicePreview,
  }
}

/** "2026-06" → "2026-07". Trata virada de ano. */
export function nextReferenceOf(ref: string): string {
  const [yearStr, monthStr] = ref.split('-')
  const y = Number(yearStr)
  const m = Number(monthStr)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
