// Sub-fase 2D (Yussef 12/06/2026) — /v2-confirm endpoint orquestrador.
//
// Recebe decisões explícitas do preview V2 + LEDGERBAL + flag de aceitação
// histórica. Aplica atomicamente em prisma.$transaction com 2 redes de
// segurança:
//   1. INTERNA: delta_aplicado_real == delta_esperado (rollback se divergir)
//   2. EXTERNA: balance_pos == LEDGERBAL (rollback exceto se user aceitou)
//
// Lógica de balance por ação:
//   SKIP                → nada
//   CREATE              → tx criada EFFECTED, balance MEXE
//   REPLACE_MANUAL      → cria OFX + delete manual com snapshot, balance NÃO mexe
//   CONCILIATE_PAYABLE  → cria OFX + atualiza Excel + opcionalmente cria ADJ
//                          balance MEXE (Excel não tinha bankAccount)
//
// /confirm legado INTACTO — esta é uma rota nova separada.

import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { buildAdjustmentTxData } from '@/lib/conciliacao/create-adjustment'

// ───────────────────────────────────────────────────────────────
// Tipos públicos
// ───────────────────────────────────────────────────────────────

export type V2ConfirmAction = 'SKIP' | 'CREATE' | 'REPLACE_MANUAL' | 'CONCILIATE_PAYABLE'

export interface V2ConfirmRawTx {
  fitid: string
  dedupHash: string
  /** ISO date */
  date: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

export interface V2ConfirmDecision {
  ofxIndex: number
  rawTx: V2ConfirmRawTx
  action: V2ConfirmAction
  matchedTxId?: string
  adjustment?: {
    amount: number
    categoryId: string
    sign: 'EXPENSE' | 'INCOME'
    description: string
  }
}

export interface V2ConfirmRequestBody {
  decisions: V2ConfirmDecision[]
  ledgerBalAmount: number | null
  expectedDeltaImportProposto: number
  /** Sempre exigido quando ledgerBalAmount diverge.
   *  Yussef decisão 12/06: nunca auto-marcado pela UI — sempre confirmação humana. */
  acceptHistoricalDivergence: boolean
}

export interface V2ConfirmResult {
  success: true
  decisionsApplied: number
  balancePre: number
  balancePos: number
  deltaAplicado: number
  ledgerBalCheck: {
    available: boolean
    bate: boolean
    diff: number
  }
  counts: {
    skip: number
    create: number
    replaceManual: number
    conciliatePayable: number
    adjustmentCreated: number
  }
}

// ───────────────────────────────────────────────────────────────
// Errors estruturados (mapeados pra status HTTP no handler)
// ───────────────────────────────────────────────────────────────

export class V2ConfirmError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 422,
    public detail?: unknown,
  ) {
    super(message)
    this.name = 'V2ConfirmError'
  }
}

// ───────────────────────────────────────────────────────────────
// Tolerâncias
// ───────────────────────────────────────────────────────────────

const TOL_AMOUNT = 0.02
const TOL_LEDGER = 0.02

// ───────────────────────────────────────────────────────────────
// Funções puras testáveis
// ───────────────────────────────────────────────────────────────

/** signed amount: CRED +, DEBIT - */
export function signedTxAmount(t: { type: 'CREDIT' | 'DEBIT'; amount: number }): number {
  return t.type === 'CREDIT' ? t.amount : -t.amount
}

/** Adjustment signed: EXPENSE = -, INCOME = + */
export function signedAdjustmentAmount(adj: {
  amount: number
  sign: 'EXPENSE' | 'INCOME'
}): number {
  return adj.sign === 'EXPENSE' ? -adj.amount : adj.amount
}

/**
 * Validação de integridade: cada decisions[i].rawTx tem que bater EXATAMENTE
 * com a tx[ofxIndex] do arquivo reparseado. Defesa contra request forjado
 * (cliente não pode mandar decisões + OFX divergentes).
 */
export function validateIntegrity(
  decisions: V2ConfirmDecision[],
  parsedTransactions: Array<{
    fitid: string
    datePosted: Date
    amount: number
    type: 'CREDIT' | 'DEBIT'
    memo: string
  }>,
): void {
  for (const dec of decisions) {
    const parsed = parsedTransactions[dec.ofxIndex]
    if (!parsed) {
      throw new V2ConfirmError(
        'INTEGRITY_CHECK_FAILED',
        `decisions[${dec.ofxIndex}] aponta pra tx fora do arquivo`,
        422,
        { ofxIndex: dec.ofxIndex },
      )
    }
    if (parsed.fitid !== dec.rawTx.fitid) {
      throw new V2ConfirmError(
        'INTEGRITY_CHECK_FAILED',
        `FITID divergente em ofxIndex=${dec.ofxIndex}`,
        422,
      )
    }
    if (Math.abs(parsed.amount - dec.rawTx.amount) > TOL_AMOUNT) {
      throw new V2ConfirmError(
        'INTEGRITY_CHECK_FAILED',
        `amount divergente em ofxIndex=${dec.ofxIndex}`,
        422,
      )
    }
    if (parsed.type !== dec.rawTx.type) {
      throw new V2ConfirmError(
        'INTEGRITY_CHECK_FAILED',
        `type divergente em ofxIndex=${dec.ofxIndex}`,
        422,
      )
    }
  }
}

/**
 * Computa delta esperado (sum signed das ações que MEXEM balance):
 *   CREATE → ±amount
 *   CONCILIATE_PAYABLE → ±amount (+ ±adjustment se houver)
 *   SKIP, REPLACE_MANUAL → não contribuem
 */
export function computeExpectedDelta(decisions: V2ConfirmDecision[]): number {
  let delta = 0
  for (const dec of decisions) {
    if (dec.action === 'CREATE') {
      delta += signedTxAmount(dec.rawTx)
    } else if (dec.action === 'CONCILIATE_PAYABLE') {
      delta += signedTxAmount(dec.rawTx)
      if (dec.adjustment) {
        delta += signedAdjustmentAmount(dec.adjustment)
      }
    }
  }
  return delta
}

/**
 * Validação per-decision dado o candidato encontrado.
 * Multi-tenant, estado esperado, coerência valor/data.
 */
export interface CandidateForValidation {
  id: string
  bankAccountId: string | null
  bankAccountCompanyId: string | null
  supplierCompanyId: string | null
  customerCompanyId: string | null
  categoryCompanyId: string | null
  amount: number
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  origin: 'OFX' | 'MANUAL' | 'IMPORT_EXCEL' | 'ADJUSTMENT'
  lifecycle: 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
  reconciledWithId: string | null
  transferGroupId: string | null
  categoryId: string | null
  supplierId: string | null
}

export function validateDecisionAgainstCandidate(
  dec: V2ConfirmDecision,
  candidate: CandidateForValidation | null,
  contaCompanyId: string,
): void {
  if (dec.action === 'SKIP' || dec.action === 'CREATE') {
    // SKIP precisa do matchedTxId só pra auditoria, não pra validação aqui
    return
  }

  if (!candidate) {
    throw new V2ConfirmError('TX_NOT_FOUND', `matchedTxId não encontrado`, 422, {
      ofxIndex: dec.ofxIndex,
      matchedTxId: dec.matchedTxId,
    })
  }

  // Multi-tenant
  const candCompanyId =
    candidate.bankAccountCompanyId ??
    candidate.supplierCompanyId ??
    candidate.customerCompanyId ??
    candidate.categoryCompanyId
  if (candCompanyId !== contaCompanyId) {
    throw new V2ConfirmError(
      'CROSS_COMPANY',
      `matchedTxId pertence a outra empresa`,
      403,
      { ofxIndex: dec.ofxIndex },
    )
  }

  if (dec.action === 'REPLACE_MANUAL') {
    if (candidate.origin !== 'MANUAL') {
      throw new V2ConfirmError('NOT_MANUAL', `candidate não é MANUAL`, 422, {
        ofxIndex: dec.ofxIndex,
        actual: candidate.origin,
      })
    }
    if (candidate.lifecycle !== 'EFFECTED') {
      throw new V2ConfirmError('NOT_EFFECTED', `candidate não é EFFECTED`, 422)
    }
    if (candidate.reconciledWithId !== null) {
      throw new V2ConfirmError(
        'MANUAL_ALREADY_LINKED',
        `candidate já conciliado com outra tx`,
        422,
      )
    }
    if (Math.abs(candidate.amount - dec.rawTx.amount) > TOL_AMOUNT) {
      throw new V2ConfirmError(
        'AMOUNT_DIVERGENCE',
        `valor manual diverge do OFX`,
        422,
      )
    }
  }

  if (dec.action === 'CONCILIATE_PAYABLE') {
    if (candidate.origin !== 'IMPORT_EXCEL') {
      throw new V2ConfirmError('NOT_EXCEL', `candidate não é IMPORT_EXCEL`, 422)
    }
    if (candidate.lifecycle !== 'PAYABLE' && candidate.lifecycle !== 'RECEIVABLE') {
      throw new V2ConfirmError(
        'NOT_PAYABLE',
        `candidate não está em PAYABLE/RECEIVABLE`,
        422,
      )
    }
    if (candidate.reconciledWithId !== null) {
      throw new V2ConfirmError(
        'EXCEL_ALREADY_LINKED',
        `Excel já conciliada`,
        422,
      )
    }

    // Soma Excel + adjustment signed == OFX amount
    const adjSigned = dec.adjustment ? signedAdjustmentAmount(dec.adjustment) : 0
    const totalEsperado = candidate.amount + Math.abs(adjSigned)
    if (Math.abs(totalEsperado - dec.rawTx.amount) > TOL_AMOUNT) {
      throw new V2ConfirmError(
        'CONCILIATE_SUM_MISMATCH',
        `Excel + adjustment não bate com OFX`,
        422,
        { excelAmount: candidate.amount, ofxAmount: dec.rawTx.amount, adjSigned },
      )
    }
  }
}

/** Confere as 2 redes de segurança matemáticas. */
export function checkSafetyNets(args: {
  deltaAplicado: number
  expectedDelta: number
  balancePos: number
  ledgerBalAmount: number | null
  acceptHistoricalDivergence: boolean
}): { ledgerCheck: { available: boolean; bate: boolean; diff: number } } {
  // Rede INTERNA — sempre obrigatória
  if (Math.abs(args.deltaAplicado - args.expectedDelta) > TOL_AMOUNT) {
    throw new V2ConfirmError(
      'INTERNAL_DELTA_DIVERGENCE',
      `delta aplicado real (${args.deltaAplicado.toFixed(2)}) ` +
        `diverge do esperado (${args.expectedDelta.toFixed(2)})`,
      500,
      { deltaAplicado: args.deltaAplicado, expectedDelta: args.expectedDelta },
    )
  }

  if (args.ledgerBalAmount === null) {
    return { ledgerCheck: { available: false, bate: false, diff: 0 } }
  }

  const diff = args.ledgerBalAmount - args.balancePos
  const bate = Math.abs(diff) <= TOL_LEDGER

  if (!bate && !args.acceptHistoricalDivergence) {
    throw new V2ConfirmError(
      'LEDGER_BAL_DIVERGENCE',
      `Saldo pós-import (${args.balancePos.toFixed(2)}) não bate com extrato ` +
        `(${args.ledgerBalAmount.toFixed(2)}). Diferença: ${diff.toFixed(2)}. ` +
        `Marque "aceitar divergência histórica" pra forçar.`,
      409,
      { ledgerBalAmount: args.ledgerBalAmount, balancePos: args.balancePos, diff },
    )
  }

  return { ledgerCheck: { available: true, bate, diff } }
}

// ───────────────────────────────────────────────────────────────
// Atomic
// ───────────────────────────────────────────────────────────────

export interface ApplyV2ConfirmArgs {
  decisions: V2ConfirmDecision[]
  contaId: string
  contaCompanyId: string
  userId: string
  userName: string
  userEmail: string
  ledgerBalAmount: number | null
  expectedDelta: number
  acceptHistoricalDivergence: boolean
}

type TxClient = Prisma.TransactionClient

/**
 * Executa o atomic /v2-confirm.
 *
 * Estratégia:
 *  1. Fetch dos candidatos referenciados em REPLACE/CONCILIATE
 *  2. Valida cada decisão contra seu candidato
 *  3. Aplica decisões iterando (cria/update/delete)
 *  4. Aplica delta no balance da conta
 *  5. Checa 2 redes de segurança (throw → rollback)
 *  6. Audit log
 */
export async function applyV2Confirm(
  prisma: PrismaClient,
  args: ApplyV2ConfirmArgs,
): Promise<V2ConfirmResult> {
  return await prisma.$transaction(async (tx) => {
    // ───── Snapshot pré
    const contaPre = await tx.bankAccount.findUniqueOrThrow({
      where: { id: args.contaId },
      select: { balance: true },
    })
    const balancePre = contaPre.balance

    // ───── Fetch candidatos referenciados
    const matchedIds = args.decisions
      .filter(
        (d) =>
          d.action === 'REPLACE_MANUAL' ||
          d.action === 'CONCILIATE_PAYABLE' ||
          d.action === 'SKIP',
      )
      .map((d) => d.matchedTxId)
      .filter((id): id is string => typeof id === 'string')

    const fetchedCandidates = matchedIds.length
      ? await tx.transaction.findMany({
          where: { id: { in: matchedIds } },
          select: {
            id: true,
            bankAccountId: true,
            amount: true,
            type: true,
            origin: true,
            lifecycle: true,
            reconciledWithId: true,
            transferGroupId: true,
            categoryId: true,
            supplierId: true,
            description: true,
            date: true,
            paymentDate: true,
            bankAccount: { select: { companyId: true } },
            supplier: { select: { companyId: true } },
            customer: { select: { companyId: true } },
            category: { select: { companyId: true } },
          },
        })
      : []

    const candById = new Map(fetchedCandidates.map((c) => [c.id, c]))

    // ───── Valida cada decisão
    for (const dec of args.decisions) {
      const cand = dec.matchedTxId ? candById.get(dec.matchedTxId) : null
      const candForVal: CandidateForValidation | null = cand
        ? {
            id: cand.id,
            bankAccountId: cand.bankAccountId,
            bankAccountCompanyId: cand.bankAccount?.companyId ?? null,
            supplierCompanyId: cand.supplier?.companyId ?? null,
            customerCompanyId: cand.customer?.companyId ?? null,
            categoryCompanyId: cand.category?.companyId ?? null,
            amount: cand.amount,
            type: cand.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
            origin: cand.origin as 'OFX' | 'MANUAL' | 'IMPORT_EXCEL' | 'ADJUSTMENT',
            lifecycle: cand.lifecycle as 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE',
            reconciledWithId: cand.reconciledWithId,
            transferGroupId: cand.transferGroupId,
            categoryId: cand.categoryId,
            supplierId: cand.supplierId,
          }
        : null
      validateDecisionAgainstCandidate(dec, candForVal, args.contaCompanyId)
    }

    // ───── Aplica decisões
    let deltaAplicado = 0
    const counts = {
      skip: 0, create: 0, replaceManual: 0, conciliatePayable: 0, adjustmentCreated: 0,
    }

    for (const dec of args.decisions) {
      if (dec.action === 'SKIP') {
        counts.skip += 1
        continue
      }

      const txDate = new Date(dec.rawTx.date)

      if (dec.action === 'CREATE') {
        await tx.transaction.create({
          data: {
            bankAccountId: args.contaId,
            date: txDate,
            paymentDate: txDate,
            amount: dec.rawTx.amount,
            type: dec.rawTx.type,
            status: 'PENDING',
            origin: 'OFX',
            lifecycle: 'EFFECTED',
            externalId: dec.rawTx.fitid,
            dedupHash: dec.rawTx.dedupHash,
            description: dec.rawTx.memo || `Transação ${dec.rawTx.fitid}`,
          },
        })
        deltaAplicado += signedTxAmount(dec.rawTx)
        counts.create += 1
        continue
      }

      if (dec.action === 'REPLACE_MANUAL') {
        const manual = candById.get(dec.matchedTxId!)!
        const isTransfer = manual.transferGroupId !== null

        const newOfx = await tx.transaction.create({
          data: {
            bankAccountId: args.contaId,
            date: txDate,
            paymentDate: txDate,
            amount: dec.rawTx.amount,
            type: isTransfer ? 'TRANSFER' : dec.rawTx.type,
            status: 'RECONCILED',
            origin: 'OFX',
            lifecycle: 'EFFECTED',
            externalId: dec.rawTx.fitid,
            dedupHash: dec.rawTx.dedupHash,
            description: dec.rawTx.memo,
            transferGroupId: isTransfer ? manual.transferGroupId : null,
            categoryId: !isTransfer ? manual.categoryId : null,
            supplierId: !isTransfer ? manual.supplierId : null,
          },
        })

        // Snapshot completo no audit ANTES de deletar
        await tx.auditLog.create({
          data: {
            companyId: args.contaCompanyId,
            userId: args.userId,
            userName: args.userName,
            userEmail: args.userEmail,
            action: isTransfer
              ? 'OFX_REPLACED_MANUAL_TRANSFER'
              : 'OFX_REPLACED_MANUAL_TX',
            entityType: 'Transaction',
            entityId: dec.matchedTxId!,
            metadata: JSON.stringify({
              context:
                'Sub-fase 2D /v2-confirm — OFX assume lugar de manual provisória.',
              deletedManualSnapshot: {
                id: manual.id,
                bankAccountId: manual.bankAccountId,
                amount: manual.amount,
                type: manual.type,
                origin: manual.origin,
                lifecycle: manual.lifecycle,
                transferGroupId: manual.transferGroupId,
                categoryId: manual.categoryId,
                supplierId: manual.supplierId,
                description: manual.description,
                date: manual.date.toISOString(),
                paymentDate: manual.paymentDate?.toISOString() ?? null,
              },
              newOfxId: newOfx.id,
            }),
          },
        })

        await tx.transaction.delete({ where: { id: dec.matchedTxId! } })
        // balance NÃO mexe — manual já tinha contribuído, OFX assume mesmo valor
        counts.replaceManual += 1
        continue
      }

      if (dec.action === 'CONCILIATE_PAYABLE') {
        const excel = candById.get(dec.matchedTxId!)!
        const groupId = randomUUID()

        // Cria OFX
        const newOfx = await tx.transaction.create({
          data: {
            bankAccountId: args.contaId,
            date: txDate,
            paymentDate: txDate,
            amount: dec.rawTx.amount,
            type: dec.rawTx.type,
            status: 'RECONCILED',
            origin: 'OFX',
            lifecycle: 'EFFECTED',
            externalId: dec.rawTx.fitid,
            dedupHash: dec.rawTx.dedupHash,
            description: dec.rawTx.memo,
            reconcileGroupId: groupId,
          },
        })

        // Atualiza Excel: PAYABLE → EFFECTED + link
        await tx.transaction.update({
          where: { id: excel.id },
          data: {
            lifecycle: 'EFFECTED',
            paymentDate: txDate,
            date: txDate,
            bankAccountId: args.contaId,
            reconciledWithId: newOfx.id,
            reconcileGroupId: groupId,
            status: 'RECONCILED',
          },
        })

        // Audit principal
        await tx.auditLog.create({
          data: {
            companyId: args.contaCompanyId,
            userId: args.userId,
            userName: args.userName,
            userEmail: args.userEmail,
            action: 'EXCEL_PAYABLE_RECONCILED_VIA_OFX',
            entityType: 'Reconciliation',
            entityId: excel.id,
            metadata: JSON.stringify({
              context: 'Sub-fase 2D /v2-confirm — concilia Excel PAYABLE com OFX',
              excelId: excel.id,
              ofxId: newOfx.id,
              groupId,
            }),
          },
        })

        // ADJ opcional
        if (dec.adjustment) {
          const adjData = buildAdjustmentTxData({
            ofxTransactionId: newOfx.id,
            bankAccountId: args.contaId,
            companyId: args.contaCompanyId,
            categoryId: dec.adjustment.categoryId,
            amount: dec.adjustment.amount,
            sign: dec.adjustment.sign,
            description: dec.adjustment.description,
            reconcileGroupId: groupId,
            date: txDate,
            userId: args.userId,
          })
          const adjCreated = await tx.transaction.create({
            data: { ...adjData, supplierId: excel.supplierId },
          })

          // Audit ADJ separado (decisão Yussef 12/06)
          await tx.auditLog.create({
            data: {
              companyId: args.contaCompanyId,
              userId: args.userId,
              userName: args.userName,
              userEmail: args.userEmail,
              action: 'CREATE_ADJUSTMENT_AUTO',
              entityType: 'Adjustment',
              entityId: adjCreated.id,
              metadata: JSON.stringify({
                context:
                  'Sub-fase 2D /v2-confirm — ajuste automático criado junto com CONCILIATE_PAYABLE',
                adjId: adjCreated.id,
                ofxId: newOfx.id,
                reconcileGroupId: groupId,
                amount: dec.adjustment.amount,
                categoryId: dec.adjustment.categoryId,
                sign: dec.adjustment.sign,
              }),
            },
          })

          deltaAplicado += signedAdjustmentAmount(dec.adjustment)
          counts.adjustmentCreated += 1
        }

        deltaAplicado += signedTxAmount(dec.rawTx)
        counts.conciliatePayable += 1
        continue
      }
    }

    // ───── Aplica delta no balance
    if (Math.abs(deltaAplicado) > 0.001) {
      await tx.bankAccount.update({
        where: { id: args.contaId },
        data: { balance: { increment: deltaAplicado } },
      })
    }

    const balancePos = balancePre + deltaAplicado

    // ───── 2 redes de segurança matemáticas (qualquer throw = rollback)
    const safety = checkSafetyNets({
      deltaAplicado,
      expectedDelta: args.expectedDelta,
      balancePos,
      ledgerBalAmount: args.ledgerBalAmount,
      acceptHistoricalDivergence: args.acceptHistoricalDivergence,
    })

    return {
      success: true,
      decisionsApplied: args.decisions.length,
      balancePre,
      balancePos,
      deltaAplicado,
      ledgerBalCheck: safety.ledgerCheck,
      counts,
    } satisfies V2ConfirmResult
  })
}
