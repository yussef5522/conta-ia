// Chave estável que IDENTIFICA uma linha de extrato bancário.
// FITID NÃO entra (Banrisul recicla FITID entre exports + usa YYMMDD pra preview).
// Componentes: data (YYYY-MM-DD UTC) + valor com sinal (2 casas) + memo normalizado.

import { normalizeMemo } from './normalize'

export interface StableKeyInput {
  date: Date
  signedAmount: number
  memo: string
}

export function stableKey(t: StableKeyInput): string {
  const dateKey = t.date.toISOString().slice(0, 10)
  const amountKey = t.signedAmount.toFixed(2)
  const memoKey = normalizeMemo(t.memo)
  return `${dateKey}|${amountKey}|${memoKey}`
}
