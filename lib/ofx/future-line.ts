// Sprint Preview-Truth (29/06/2026) — corte de linha futura.
//
// Tx OFX com date FUTURA (banco exportou agendado/previsão) NÃO é movimento
// efetivado — vira PAYABLE/RECEIVABLE (Conta a Pagar/Receber) e NÃO afeta
// saldo. Quando a data chegar e o débito real aparecer no extrato, concilia
// com essa pending.
//
// Cenário Yussef: Banrisul exporta "PAGAMENTO CONSORCIO 09/07 R$1.478,51"
// no extrato de 29/06. Antes virava EFFECTED inflando o caixa errado.
//
// TIMEZONE: corte usa fim do dia em America/Sao_Paulo (BRT-3 sem horário
// de verão). Server roda UTC; uma tx de "29/06 23:59 BRT" é "30/06 02:59
// UTC". Sem cuidado, o cálculo cego em UTC marca essa tx como "futura".
// O diagnóstico achou 73 tx 29/06 sendo falsos positivos pra esse motivo.

const SAO_PAULO_OFFSET_HOURS = -3 // BRT permanente (Lei 14.001/2020)
const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Retorna a data (UTC instant) que representa o FIM DO DIA "today" em
 * America/Sao_Paulo. Linhas com `datePosted > essa instant` são genuinamente
 * futuras (hoje BRT já passou pra elas).
 *
 * @param now Instant atual (default new Date()). Aceitar param facilita test.
 */
export function endOfTodayBrazil(now: Date = new Date()): Date {
  // 1. now em "hora local Brasil" via shift do offset.
  const brazilLocal = new Date(now.getTime() + SAO_PAULO_OFFSET_HOURS * ONE_HOUR_MS)
  // 2. Pega year/month/day do tempo deslocado.
  const y = brazilLocal.getUTCFullYear()
  const m = brazilLocal.getUTCMonth()
  const d = brazilLocal.getUTCDate()
  // 3. Constrói "fim do dia BRT" (23:59:59.999 local) em UTC.
  //    Convertendo: 23:59:59.999 BRT = 02:59:59.999 UTC do DIA SEGUINTE.
  //    Em milissegundos: Date.UTC(y, m, d+1, 0, 0, 0, 0) - 1 (último ms do dia BRT).
  //    Aplicando offset reverso:
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - SAO_PAULO_OFFSET_HOURS * ONE_HOUR_MS)
}

/**
 * Linha do extrato com `datePosted` é genuinamente FUTURA (banco exportou
 * agendado) se for posterior ao fim do dia "today" em BRT?
 */
export function isFutureLineBrazil(
  datePosted: Date,
  now: Date = new Date(),
): boolean {
  return datePosted.getTime() > endOfTodayBrazil(now).getTime()
}

/**
 * Lifecycle resolvido pra uma linha do extrato.
 * - Tx futura DEBIT: PAYABLE (Conta a Pagar pendente)
 * - Tx futura CREDIT: RECEIVABLE (Conta a Receber pendente)
 * - Tx no passado/hoje: EFFECTED (movimento já realizado)
 */
export function lifecycleFromDate(
  datePosted: Date,
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string,
  now: Date = new Date(),
): 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE' {
  if (!isFutureLineBrazil(datePosted, now)) return 'EFFECTED'
  if (type === 'CREDIT') return 'RECEIVABLE'
  return 'PAYABLE'
}
