// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — Conecta o FREE_MONTHS
// órfão dos cupons na Subscription. Quando user cadastra com cupom
// FREE_MONTHS=N, o trial é estendido em N*30 dias.

/**
 * Calcula bônus em DIAS a partir do tipo + valor do cupom.
 *
 * - FREE_MONTHS=2 → 60 dias
 * - PERCENTAGE/FIXED_AMOUNT → 0 (não afetam trial, vão no preço quando
 *   gateway for plugado na Fatia 3)
 */
export function couponToTrialBonusDays(
  type: string,
  freeMonths: number | null | undefined,
): number {
  if (type !== 'FREE_MONTHS') return 0
  if (!freeMonths || freeMonths <= 0) return 0
  const DAYS_PER_MONTH = 30
  return freeMonths * DAYS_PER_MONTH
}
