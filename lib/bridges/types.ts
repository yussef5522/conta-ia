// Sprint PF Fatia 4 — Tipos + erros tipados da Ponte PJ→PF.

import type {
  PJtoPFBridge,
  Transaction as PjTransaction,
  PersonalTransaction,
  SocioPF,
  PersonalProfile,
} from '@prisma/client'

// Tipos de retirada (kind). Mapeia em kind-defaults.ts pra dreGroup PJ
// e categoria sugerida PF.
export type BridgeKind =
  | 'PRO_LABORE'
  | 'DISTRIBUICAO'
  | 'REEMBOLSO'
  | 'ADIANTAMENTO'
  | 'RETIRADA_SOCIOS'

export const BRIDGE_KINDS: readonly BridgeKind[] = [
  'PRO_LABORE',
  'DISTRIBUICAO',
  'REEMBOLSO',
  'ADIANTAMENTO',
  'RETIRADA_SOCIOS',
] as const

export type CreatedVia = 'CREATED_MANUAL' | 'CREATED_FROM_DETECTION'

export const CREATED_VIA: readonly CreatedVia[] = [
  'CREATED_MANUAL',
  'CREATED_FROM_DETECTION',
] as const

/** Modo do delete (decisão de produto §4.4 do plano). */
export type BridgeDeleteMode = 'LINK_ONLY' | 'WITH_PF_TX'

export const BRIDGE_DELETE_MODES: readonly BridgeDeleteMode[] = [
  'LINK_ONLY',
  'WITH_PF_TX',
] as const

/** Códigos de erro tipados (mapeiam em HTTP status nas routes). */
export type BridgeErrorCode =
  | 'PJ_NOT_FOUND'         // 404
  | 'PJ_WRONG_TYPE'        // 400 — tx PJ não é DEBIT
  | 'PJ_ALREADY_BRIDGED'   // 409 — UNIQUE
  | 'PJ_INVALID_LIFECYCLE' // 409 — PAYABLE/RECEIVABLE bloqueado
  | 'PJ_INTERNAL_TRANSFER' // 409 — tx PJ é transferência interna (PJ↔PJ ou conta↔conta)
  | 'PF_PROFILE_NOT_FOUND' // 404 — perfil não acessível pelo user (privacidade)
  | 'PF_ACCOUNT_NOT_FOUND' // 404 — conta PF de outro perfil
  | 'PF_CATEGORY_INVALID'  // 400 — categoria de outro perfil
  | 'INVALID_KIND'         // 400 — kind fora do enum
  | 'COMPANY_MISMATCH'     // 400 — tx PJ não pertence à companyId informado
  | 'NO_RBAC_PJ'           // 403 — sem permissão na empresa
  | 'NO_ACCESS_PF'         // 403 — sem OWNER no perfil
  | 'BRIDGE_NOT_FOUND'     // 404 — id inexistente OU privacidade (não revela)
  | 'INVALID_MODE'         // 400 — mode de delete fora do enum

export class BridgeError extends Error {
  constructor(message: string, readonly code: BridgeErrorCode) {
    super(message)
    this.name = 'BridgeError'
  }
}

export function isBridgeError(err: unknown): err is BridgeError {
  return err instanceof BridgeError
}

// === Tipos compostos pra views/queries ===

export interface BridgeCandidate {
  /** Tx PJ de saída ainda sem ponte. */
  pjTransaction: PjTransaction
  /** Sócio identificado pelo CPF (Sprint 5.0.2.h). */
  socioPF: SocioPF
  /** Perfil PF do user logado que bate com o CPF do sócio. */
  profile: PersonalProfile
  /** Kind sugerido baseado em SocioPF.papel. */
  suggestedKind: BridgeKind
  /** Conta PF sugerida (1ª ativa) — null se user não tem nenhuma. */
  suggestedAccountId: string | null
  /** Categoria PF sugerida (default da Fatia 1 do tipo INCOME) — null se inexistente. */
  suggestedCategoryId: string | null
}

export interface BridgeDetail {
  bridge: PJtoPFBridge
  pjTransaction: PjTransaction
  pfTransaction: PersonalTransaction
  socioPF: SocioPF | null
}

export interface BridgeListItem {
  id: string
  kind: BridgeKind
  amount: number
  date: Date
  createdVia: CreatedVia
  // Lado PJ (público — visível pra quem ver a ponte)
  companyId: string
  companyName: string
  pjTransactionId: string
  pjBankAccountName: string | null
  // Lado PF
  profileId: string
  profileName: string
  pfTransactionId: string
  pfBankAccountName: string | null
  socioPFName: string | null
}
