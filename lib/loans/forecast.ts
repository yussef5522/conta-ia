// Sprint Fase 2 Empréstimos (15/08/2026) — PREVISÃO da próxima parcela.
//
// Regra (decidida com o Yussef, ver CLAUDE.md "Empréstimos — decisões de
// arquitetura"): parcela POS ainda-não-paga mostra o VALOR DA ÚLTIMA PARCELA
// CASADA como previsão (juros pós-fixado varia pouco mês a mês; é a melhor
// referência disponível, muito melhor que a amortização nominal que mente pra
// baixo). PRE tem juros calculável → usa o valor da agenda (é fato).
//
// TRAVA DURA: só serve de base uma parcela CASADA (com pagamento real linkado —
// `reconciledTransactionId` 1:1 OU `LoanInstallmentPayment` N:1). Pagamento
// avulso/tarifa/parcial NUNCA. Sem parcela casada → "a apurar", não inventa.
//
// PREVISÃO É DISPLAY-ONLY, calculada ao vivo — nunca gravada como fato (senão
// vira 3ª fonte de verdade que envelhece). REGRA 6: a tela marca "~previsto".

export interface ForecastLoan {
  rateType: string | null
}
export interface ForecastInstallment {
  number: number
  dueDate: Date
  status: string
  payment: number
  /** valor REAL pago (N:1 = soma dos LoanInstallmentPayment; 1:1 = tx.amount) */
  paidTotal: number | null
  reconciledTransactionId: string | null
  /** quantos LoanInstallmentPayment a parcela tem (0 = sem ponte N:1) */
  paymentsCount: number
}

export interface ForecastResult {
  /** valor a exibir; null quando "a apurar" (POS sem parcela casada) */
  valor: number | null
  /** true = previsão (~), false = fato (agenda PRE ou parcela já paga) */
  isForecast: boolean
  /** parcela usada de base, quando previsão POS */
  baseNumber: number | null
  baseDate: Date | null
  /** venc da próxima OPEN */
  dueDate: Date | null
}

/** true quando a parcela tem pagamento REAL linkado (as duas portas). */
export function isCasada(i: ForecastInstallment): boolean {
  return i.status === 'PAID' && (i.reconciledTransactionId !== null || i.paymentsCount > 0)
}

/**
 * Previsão da PRÓXIMA parcela OPEN. Função pura.
 */
export function forecastProxima(
  loan: ForecastLoan,
  installments: ForecastInstallment[],
): ForecastResult {
  const sorted = [...installments].sort((a, b) => a.number - b.number)
  const prox = sorted.find((i) => i.status === 'OPEN')
  if (!prox) return { valor: null, isForecast: false, baseNumber: null, baseDate: null, dueDate: null }

  // PRE (pré-fixado) → o valor da agenda é calculável = fato.
  if (loan.rateType !== 'POS') {
    return { valor: prox.payment, isForecast: false, baseNumber: null, baseDate: null, dueDate: prox.dueDate }
  }

  // POS → previsão pela ÚLTIMA parcela CASADA (maior dueDate), com a trava.
  const base = sorted
    .filter(isCasada)
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0]

  if (!base) {
    // sem casada → a apurar (não inventa)
    return { valor: null, isForecast: true, baseNumber: null, baseDate: null, dueDate: prox.dueDate }
  }
  return {
    valor: base.paidTotal ?? base.payment,
    isForecast: true,
    baseNumber: base.number,
    baseDate: base.dueDate,
    dueDate: prox.dueDate,
  }
}
