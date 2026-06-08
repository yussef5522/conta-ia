// Sprint Fluxo-Único-Retirada (08/06/2026) — Detecção de tx PJ que SÃO
// retiradas de sócio (pela categoria) mas ainda NÃO têm ponte PJ→PF.
//
// Princípio do "fluxo único": a CATEGORIA dispara o fluxo. Quando uma tx
// PJ DEBIT EFFECTED está categorizada como Distribuição/Pró-labore/etc,
// o sistema oferece automaticamente "criar entrada PF" inline em todas
// as listas. Sem 2 caminhos.
//
// FUNÇÃO PURA — sem DB, testável. Caller passa os campos relevantes;
// helper retorna true/false.

import type { WithdrawalKind } from './suggest-from-description'

/**
 * dreGroups que disparam o fluxo de Retirada de Sócio.
 *
 * Decisão #4 do Yussef (08/06/2026):
 *   - DISTRIBUICAO_LUCROS → cobre: Distribuição, Adiantamento, Retirada genérica
 *   - DESPESAS_PESSOAL → cobre: Pró-labore (folha de sócio)
 *   - Reembolso fica de fora (não é retirada de fato — é restituição)
 */
export const WITHDRAWAL_DRE_GROUPS: ReadonlySet<string> = new Set([
  'DISTRIBUICAO_LUCROS',
  'DESPESAS_PESSOAL',
])

export interface OrphanCandidate {
  /** Lifecycle da tx (EFFECTED | PAYABLE | RECEIVABLE) */
  lifecycle: string
  /** Tipo (CREDIT | DEBIT) — só DEBIT pode ser retirada */
  type: string
  /** True quando tx pertence a transferência interna entre empresas */
  isInternalTransfer: boolean
  /** transferGroupId não-nulo = transferência entre contas da mesma empresa */
  transferGroupId: string | null
  /** dreGroup da categoria associada (null se categorizada sem dreGroup ou sem categoria) */
  categoryDreGroup: string | null
  /** True quando tx já tem ponte PJ→PF (bridge ativa) */
  hasBridge: boolean
}

/**
 * Detecta tx PJ que é uma retirada de sócio sem ponte PJ→PF ativa.
 *
 * Critérios (todos exigidos):
 *   1. type = DEBIT (saída)
 *   2. lifecycle = EFFECTED (já paga; PAYABLE futura não conta)
 *   3. NÃO é transferência interna (entre empresas OU entre contas)
 *   4. Categoria com dreGroup em WITHDRAWAL_DRE_GROUPS
 *   5. SEM bridge ativa
 */
export function isOrphanWithdrawal(c: OrphanCandidate): boolean {
  if (c.type !== 'DEBIT') return false
  if (c.lifecycle !== 'EFFECTED') return false
  if (c.isInternalTransfer) return false
  if (c.transferGroupId !== null) return false
  if (c.hasBridge) return false
  if (!c.categoryDreGroup) return false
  return WITHDRAWAL_DRE_GROUPS.has(c.categoryDreGroup)
}

/**
 * Infere o WithdrawalKind a partir do dreGroup da categoria.
 * Usado pra pré-preencher o WithdrawalPanel ao abrir o convite.
 *
 *   DISTRIBUICAO_LUCROS → DISTRIBUICAO (default; user pode trocar pra ADIANTAMENTO/RETIRADA_SOCIOS)
 *   DESPESAS_PESSOAL     → PRO_LABORE
 */
export function inferKindFromDreGroup(
  dreGroup: string | null | undefined,
): WithdrawalKind | null {
  if (!dreGroup) return null
  if (dreGroup === 'DISTRIBUICAO_LUCROS') return 'DISTRIBUICAO'
  if (dreGroup === 'DESPESAS_PESSOAL') return 'PRO_LABORE'
  return null
}
