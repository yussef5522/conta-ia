// Sprint A/B-no-Painel (10/08/2026) — monta o body do POST /api/pontes a partir
// do estado do painel de retirada. PURO e testável (Regra 3). O ponto que
// regrediu: o WithdrawalPanel nunca mandava `spend` (fluxo B "já gastei") — sem
// ele o saldo do PF inflava. Aqui `spend` entra SÓ quando "já gastei" está
// marcado E há categoria do gasto.

export interface BuildPontePayloadInput {
  companyId: string
  pjTransactionId: string
  profileId: string
  pfBankAccountId: string
  pfCategoryId: string
  kind: string
  socioPFId: string
  createdVia?: string
  /** fluxo B: "já gastei esse dinheiro". */
  spendChecked: boolean
  /** categoria EXPENSE do gasto (fluxo B). */
  spendCategoryId: string
}

export interface PontePayload {
  companyId: string
  pjTransactionId: string
  profileId: string
  pfBankAccountId: string
  pfCategoryId: string
  kind: string
  createdVia: string
  socioPFId: string
  spend?: { categoryId: string }
}

export function buildPontePayload(i: BuildPontePayloadInput): PontePayload {
  return {
    companyId: i.companyId,
    pjTransactionId: i.pjTransactionId,
    profileId: i.profileId,
    pfBankAccountId: i.pfBankAccountId,
    pfCategoryId: i.pfCategoryId,
    kind: i.kind,
    createdVia: i.createdVia ?? 'CREATED_MANUAL',
    socioPFId: i.socioPFId,
    // Fluxo B só quando marcado E com categoria — senão é fluxo A (só entrada).
    spend: i.spendChecked && i.spendCategoryId ? { categoryId: i.spendCategoryId } : undefined,
  }
}
