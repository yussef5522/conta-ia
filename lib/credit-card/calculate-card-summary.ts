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
  /** ⭐ "Despesas parceladas a vencer" declarado pelo BANCO no PDF (26/08).
   *  É a parte do limite que segue COMPROMETIDA mesmo depois de pagar a fatura. */
  parceladoAVencer?: number | null
}

export interface CardSummaryResult {
  cardId: string
  creditLimit: number
  limitUsed: number
  limitAvailable: number
  limitUsedPercent: number   // 0..100 (clamp)
  /** ⭐ de onde vem o usado — a tela precisa explicar, não só mostrar o número */
  limitBreakdown: {
    faturasNaoPagas: number
    parceladoAVencer: number
    /** true = o ciclo atual é DESCONHECIDO (só aparece na próxima fatura) */
    cicloAtualDesconhecido: boolean
  }
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
  /** ⭐ o que o BANCO declara sobre as próximas faturas (do PDF importado).
   *  null = nenhuma fatura veio de PDF ainda — a tela diz "a apurar", nunca 0,00. */
  proximasDeclaradas?: {
    proxima: number | null; seguinte: number | null; demais: number | null; total: number | null
    rotuloProxima: string | null; rotuloSeguinte: string | null
  } | null
}

/**
 * ⭐⭐ LIMITE USADO — o conceito, corrigido em 26/08.
 *
 * ⚠️ O BUG: contava SÓ as faturas não pagas. Na fatura real dava R$ 18.348,72 enquanto
 * o banco tinha ~40 mil comprometidos. E pior: **quando o pagamento casasse, o usado
 * ZERARIA** — o sistema diria que o limite inteiro está livre com R$ 28.989,62 de
 * parcelado pendurado. A própria fatura avisa: *"o valor total do parcelamento
 * COMPROMETERÁ o limite de crédito do seu cartão e será recomposto à medida que as
 * parcelas forem pagas."*
 *
 * USADO = faturas não pagas + PARCELADO A VENCER + compras do ciclo atual
 *
 * ⚠️ O TERCEIRO TERMO É DESCONHECIDO até a próxima fatura chegar — compras feitas
 * depois do fechamento (29/07 em diante) só aparecem no PDF seguinte. Por isso o
 * resultado é um **PISO**, não um valor exato, e a tela DIZ isso ("pelo menos X").
 * Afirmar limite livre que pode não existir é pior que dizer "a apurar" — é a mesma
 * regra do "sem contagem" do estoque e do "a apurar" das vendas.
 *
 * ⚠️ Pagar a fatura libera SÓ a parte dela. O parcelado continua comprometendo até
 * ser cobrado nas próximas faturas — e aí ele sai do "a vencer" e entra na fatura.
 * Contar os dois ao mesmo tempo seria dobrar; o `parceladoAVencer` declarado pelo
 * banco já EXCLUI o que está na fatura corrente (é "a vencer", não "faturado").
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
  // o declarado pelo banco manda; o `futureParcelasNotInvoiced` é o caminho antigo
  // (sempre vazio hoje) e fica como fallback pra cartão sem PDF importado.
  const parcelado = input.parceladoAVencer ?? limitUsedFromFuture

  const limitUsed = limitUsedFromInvoices + parcelado
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
    limitBreakdown: {
      faturasNaoPagas: Math.round((limitUsedFromInvoices + 1e-9) * 100) / 100,
      parceladoAVencer: Math.round((parcelado + 1e-9) * 100) / 100,
      // ⚠️ sempre true enquanto o ciclo corrente não vira fatura: o sistema NUNCA
      // conhece as compras de hoje. Deixar false seria afirmar o que não se sabe.
      cicloAtualDesconhecido: true,
    },
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
