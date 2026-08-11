// FASE 2 — resolução da ÂNCORA de saldo/data dirigida pelo perfil do banco.
//
// É o comportamento com bug concreto: o Sicredi carimba DTASOF no FIM DO MÊS
// (futuro), então a âncora max(DTASOF, DTEND) fica no futuro → o descarte de
// futuro não corta nada E a validação Σ(EFFECTED)×LEDGERBAL fica TOOTHLESS
// (sempre "bate" trivialmente). Aqui a âncora passa a respeitar o perfil.

import { settledThroughDate } from '../ofx/future-line'
import type { BankProfile } from './types'

export interface AnchorInput {
  /** DTASOF do LEDGERBAL. */
  dtAsOf: Date | null | undefined
  /** DTEND do BANKTRANLIST. */
  dtEnd: Date | null | undefined
  /** Última data de tx que JÁ liquidou (≤ hoje) no arquivo. Fallback quando DTASOF não serve. */
  lastRealTxDate: Date | null | undefined
  /** Instante atual (default new Date()). Só usado na rede de segurança "DTASOF no futuro". */
  today?: Date
}

export interface AnchorResult {
  /** Data-âncora resolvida ("liquidado até aqui"). null se não deu pra determinar. */
  anchor: Date | null
  /** Regra aplicada. */
  rule: 'DTASOF' | 'LAST_REAL_TX' | 'FUTURE_FALLBACK' | 'UNKNOWN_CONSERVATIVE'
  /** Explicação legível (vai pro log e pode ir pra tela). */
  reason: string
}

const endOfDay = (d: Date) => d.getTime()

/**
 * Resolve a âncora conforme o perfil. Perfil null (banco desconhecido) →
 * conservador: ancora pela última tx real. Regra dura GENERALIZADA: se a âncora
 * candidata (DTASOF/DTEND) cair no FUTURO, cai pra última tx real — cobre o
 * Sicredi de hoje E qualquer banco que faça igual amanhã, sem tratar caso a caso.
 */
export function resolveStatementAnchor(
  profile: BankProfile | null,
  input: AnchorInput,
): AnchorResult {
  const today = input.today ?? new Date()
  const base = settledThroughDate(input.dtAsOf ?? null, input.dtEnd ?? null) // max(DTASOF, DTEND)
  const last = input.lastRealTxDate ?? null

  // Banco desconhecido → conservador (nunca adivinha o DTASOF).
  if (!profile) {
    return {
      anchor: last ?? base,
      rule: 'UNKNOWN_CONSERVATIVE',
      reason: 'Banco não reconhecido — âncora conservadora pela última transação real.',
    }
  }

  // Perfil declara âncora pela última tx real (ex: Sicredi, DTASOF no fim do mês).
  if (profile.dateAnchor === 'LAST_REAL_TX') {
    return {
      anchor: last ?? base,
      rule: 'LAST_REAL_TX',
      reason: `${profile.displayName}: âncora pela última transação real (${profile.rationale.dateAnchor})`,
    }
  }

  // Perfil DTASOF, mas rede de segurança: se a âncora candidata está no FUTURO,
  // ela não pode ser "liquidado até aqui" → usa a última tx real.
  if (base && endOfDay(base) > endOfDay(today) && last) {
    return {
      anchor: last,
      rule: 'FUTURE_FALLBACK',
      reason: `${profile.displayName}: DTASOF/DTEND (${base.toISOString().slice(0, 10)}) está no futuro → âncora pela última transação real (${last.toISOString().slice(0, 10)}).`,
    }
  }

  return {
    anchor: base ?? last,
    rule: 'DTASOF',
    reason: `${profile.displayName}: âncora max(DTASOF, DTEND).`,
  }
}
