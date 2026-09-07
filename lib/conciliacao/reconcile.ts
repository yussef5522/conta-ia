// Sprint 4.0.2 + Sprint A-effected (03/06/2026) — orquestrador atomic de
// conciliação OFX ↔ candidato.
//
// 2 MODOS de candidato suportados:
//
//   CLASSIC (Sprint 4.0.2):
//     - Candidato é PAYABLE/RECEIVABLE pendente (status='PENDING', sem link)
//     - Estratégia LINK: candidato vira EFFECTED + recebe paymentDate=OFX.date +
//       bankAccountId=OFX.bankAccountId + reconciledWithId=OFX.id + status=RECONCILED
//     - OFX permanece intacto (preserva FITID, dedupHash, importId)
//
//   ORPHAN (Sprint A-effected — NOVO):
//     - Candidato já é EFFECTED órfão (Excel pago ou Manual EFFECTED + sem link)
//     - Estratégia LINK SIMPLES: candidato só ganha reconciledWithId=OFX.id +
//       status=RECONCILED. NÃO mexer em lifecycle/paymentDate/date/bankAccountId/
//       amount/description (Excel/Manual já tem a verdade contábil dessas).
//     - OFX recebe BACKFILL COOPERATIVO de categoryId/supplierId (só se OFX
//       estiver com esses campos NULL — preserva classificação que o Yussef já
//       fez na AP Excel, senão a despesa cairia em "Sem categoria" no DRE).
//     - Audit metadata grava `mode=EFFECTED_ORPHAN` + estado anterior do OFX
//       (`ofxBefore`) + status anterior do candidato pra UNDO restaurar.
//
// Anti-dup no DRE caixa (filtro `lifecycle='EFFECTED' AND reconciledWithId IS NULL`):
//   - CLASSIC: candidato vira EFFECTED + link → fica fora; OFX continua → conta
//   - ORPHAN: candidato já era EFFECTED + agora ganha link → sai do DRE; OFX
//     continua → conta. Despesa para de dobrar.
//
// Pré-validações cumulativas (defesa em profundidade):
//   - |OFX.amount - candidato.amount| < 0,01 (valor exato)
//   - |OFX.date - candidato.dueDate/paymentDate/date| ≤ 5 dias
//   - Mesma direção (DEBIT/CREDIT)
//   - Mesma empresa (multi-tenant)
//   - ORPHAN: candidato.origin IN (IMPORT_EXCEL, MANUAL) — nunca OFX-vs-OFX

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'

export class ReconciliationError extends Error {
  constructor(public readonly reason: string, public readonly status: number = 422) {
    super(reason)
    this.name = 'ReconciliationError'
  }
}

export interface ReconcileInput {
  ofxTransactionId: string
  candidateId: string
  force?: boolean
  // Sprint A-effected Fase B.3 — N:1 support
  // Quando true, relaxa o guard de reverse link (permite várias candidates
  // apontarem pra mesma OFX). Default false: mantém defesa de 1:1.
  // SÓ deve ser true quando chamador validou soma das candidates == OFX.amount
  // (responsabilidade do endpoint /find-and-match/reconcile).
  allowMultiReconcile?: boolean
  // groupId compartilhado entre N candidates do mesmo Find & Match (pra
  // undo agrupado). Null quando 1:1.
  reconcileGroupId?: string | null
  /**
   * ⭐⭐ A DIFERENÇA QUE O DONO VIU E ACEITOU (07/09/2026) — juros/tarifa de boleto.
   *
   * ⛔ NÃO é um `force` disfarçado. `force` desliga TODAS as pré-validações e
   * existe pra backfill interno; este campo carrega **o número exato** que a tela
   * mostrou, e a conciliação só passa se ele **bater ao centavo** com a diferença
   * real. Assim o cliente não consegue "ignorar a checagem" — ele só consegue
   * confirmar uma diferença que ele de fato enxergou.
   *
   * Nasce do caso Cancian: boleto R$ 230,81, pago R$ 232,81. Recusar o par seria
   * deixar o mesmo dinheiro em duas linhas; casar sozinho seria inventar juros.
   */
  diferencaAceita?: number
}

const MAX_DAYS_APART = 5
const AMOUNT_EQ_TOLERANCE = 0.01

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86_400_000))
}

function resolveCandidateDate(candidate: {
  paymentDate: Date | null
  dueDate: Date | null
  date: Date
}): Date {
  return candidate.paymentDate ?? candidate.dueDate ?? candidate.date
}

export async function reconcileTransactions(
  input: ReconcileInput,
  ctx: AuthContext,
) {
  const [ofx, candidate] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: input.ofxTransactionId },
      include: {
        bankAccount: { select: { companyId: true } },
        // Sprint A-effected Fase 2-fix — reverso (Excel apontando pra OFX)
        reconciledFrom: { select: { id: true }, take: 1 },
      },
    }),
    prisma.transaction.findUnique({
      where: { id: input.candidateId },
      include: {
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    }),
  ])

  if (!ofx) throw new ReconciliationError('Transação OFX não encontrada', 404)
  if (!candidate) throw new ReconciliationError('Conta pendente não encontrada', 404)

  if (ofx.lifecycle !== 'EFFECTED' || !ofx.bankAccountId) {
    throw new ReconciliationError('Transação OFX inválida (precisa lifecycle=EFFECTED)')
  }
  if (ofx.reconciledWithId) {
    throw new ReconciliationError('Transação OFX já está conciliada')
  }
  // Sprint A-effected Fase B.3: o guard de reverse link bloqueia N:1 acidental
  // (1:1 auto-match). Quando chamador valida soma e pede explicitamente N:1
  // via allowMultiReconcile, o guard relaxa.
  if (ofx.reconciledFrom.length > 0 && !input.allowMultiReconcile) {
    throw new ReconciliationError(
      'Tx OFX já tem outra conta conciliada com ela (link reverso)',
    )
  }
  if (candidate.reconciledWithId) {
    throw new ReconciliationError('Candidato já está conciliado com outra OFX')
  }

  // Determina MODO do candidato
  let candidateMode: 'CLASSIC' | 'ORPHAN'
  if (candidate.lifecycle === 'PAYABLE' || candidate.lifecycle === 'RECEIVABLE') {
    candidateMode = 'CLASSIC'
  } else if (candidate.lifecycle === 'EFFECTED') {
    candidateMode = 'ORPHAN'
    // Defesa: nunca conciliar OFX-vs-OFX (mesma decisão do find-candidates Sprint A).
    // ⭐ ESTOQUE_NF entrou em 07/09/2026: a conta a pagar nascida da conferência de
    // NF-e vira EFFECTED quando o dono a marca como paga, e aí é EXATAMENTE a mesma
    // forma de um órfão de Excel — mesma dupla contagem, mesma saída. Ficar de fora
    // da lista era o motivo de a costura do Cancian só existir como script.
    const ORIGENS_ORFAS = ['IMPORT_EXCEL', 'MANUAL', 'ESTOQUE_NF']
    if (!ORIGENS_ORFAS.includes(candidate.origin)) {
      throw new ReconciliationError(
        `Candidato EFFECTED só pode ser conciliado se origin=${ORIGENS_ORFAS.join('/')} (recebeu ${candidate.origin})`,
      )
    }
  } else {
    throw new ReconciliationError(
      `Candidato inválido — lifecycle ${candidate.lifecycle} (esperado PAYABLE/RECEIVABLE/EFFECTED)`,
    )
  }

  // Coerência de direção
  // CLASSIC: OFX DEBIT ↔ PAYABLE / OFX CREDIT ↔ RECEIVABLE
  // ORPHAN: direção pelo type da própria tx (Excel/Manual têm type DEBIT/CREDIT igual OFX)
  if (candidateMode === 'CLASSIC') {
    if (ofx.type === 'DEBIT' && candidate.lifecycle !== 'PAYABLE') {
      throw new ReconciliationError('OFX DEBIT só concilia com PAYABLE')
    }
    if (ofx.type === 'CREDIT' && candidate.lifecycle !== 'RECEIVABLE') {
      throw new ReconciliationError('OFX CREDIT só concilia com RECEIVABLE')
    }
  } else {
    // ORPHAN
    if (ofx.type !== candidate.type) {
      throw new ReconciliationError(
        `Direção divergente — OFX ${ofx.type} vs candidato EFFECTED ${candidate.type}`,
      )
    }
  }

  // Multi-tenant: ambas têm que estar na mesma empresa
  const ofxCompanyId = ofx.bankAccount!.companyId
  const candidateCompanyId =
    candidate.bankAccount?.companyId ??
    candidate.supplier?.companyId ??
    candidate.customer?.companyId ??
    candidate.category?.companyId
  if (!candidateCompanyId || candidateCompanyId !== ofxCompanyId) {
    throw new ReconciliationError('OFX e candidato pertencem a empresas diferentes')
  }
  if (ctx.company?.id !== ofxCompanyId) {
    throw new ReconciliationError('Contexto de autenticação não corresponde à empresa')
  }
  ctx.requirePermission('transaction.update')

  // Pré-validações cumulativas (Sprint A-effected — defesa em profundidade)
  // Aplica nos 2 modos pra prevenir reconcile errôneo via API direta.
  // Sprint A-effected Fase B.3: pula validação de valor exato no N:1 (cada
  // candidate individual NÃO bate com OFX; a soma das N bate, validada
  // upstream no endpoint /find-and-match/reconcile).
  if (!input.force && !input.allowMultiReconcile) {
    const diferencaReal = Math.round((ofx.amount - candidate.amount) * 100) / 100
    // ⭐ a diferença só passa se o dono tiver CONFIRMADO ESTE número. Bater ao
    // centavo é o que separa "vi e aceito os R$ 2,00 de juros" de "ignora a trava".
    const diferencaConfirmada =
      input.diferencaAceita !== undefined &&
      Math.abs(input.diferencaAceita - diferencaReal) < AMOUNT_EQ_TOLERANCE
    if (Math.abs(diferencaReal) >= AMOUNT_EQ_TOLERANCE && !diferencaConfirmada) {
      throw new ReconciliationError(
        `Valor divergente — OFX R$ ${ofx.amount.toFixed(2)} vs candidato R$ ${candidate.amount.toFixed(2)}`
        + ` (diferença de R$ ${diferencaReal.toFixed(2)}; confirme a diferença pra conciliar)`,
      )
    }
    const candidateDate = resolveCandidateDate(candidate)
    const days = daysBetween(candidateDate, ofx.date)
    if (days > MAX_DAYS_APART) {
      throw new ReconciliationError(
        `Datas distantes — ${days} dias entre OFX (${ofx.date.toISOString().slice(0, 10)}) e candidato (${candidateDate.toISOString().slice(0, 10)}). Máximo ${MAX_DAYS_APART} dias.`,
      )
    }
  }

  // Operação atomic — branch por modo
  const updated = await prisma.$transaction(async (trx) => {
    if (candidateMode === 'CLASSIC') {
      // FLUXO ANTIGO Sprint 4.0.2 — PAYABLE/RECEIVABLE vira EFFECTED + link
      const candidateUpdated = await trx.transaction.update({
        where: { id: candidate.id },
        data: {
          lifecycle: 'EFFECTED',
          paymentDate: ofx.date,
          date: ofx.date,
          bankAccountId: ofx.bankAccountId,
          reconciledWithId: ofx.id,
          status: 'RECONCILED',
          // Sprint A-effected Fase B.3 — groupId pra undo agrupado N:1
          ...(input.reconcileGroupId !== undefined
            ? { reconcileGroupId: input.reconcileGroupId }
            : {}),
        },
        include: {
          category: { select: { id: true, name: true, color: true } },
          bankAccount: { select: { id: true, name: true, bankName: true } },
        },
      })

      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'Reconciliation',
          entityId: candidate.id,
          fieldsChanged: {
            lifecycle: { before: candidate.lifecycle, after: 'EFFECTED' },
            paymentDate: { before: null, after: ofx.date.toISOString() },
            bankAccountId: { before: candidate.bankAccountId, after: ofx.bankAccountId },
            reconciledWithId: { before: null, after: ofx.id },
          },
          metadata: {
            mode: 'CLASSIC',
            ofxTransactionId: ofx.id,
            ofxDescription: ofx.description,
            ofxAmount: ofx.amount,
            candidateDescription: candidate.description,
            candidateAmount: candidate.amount,
            reconcileGroupId: input.reconcileGroupId ?? null,
          },
        },
        trx,
      )

      return candidateUpdated
    }

    // ORPHAN MODE (Sprint A-effected) — EFFECTED já efetivado, só cria link
    // + backfill cooperativo do OFX (categoryId/supplierId só se OFX vazio).
    const ofxBefore = {
      categoryId: ofx.categoryId,
      supplierId: ofx.supplierId,
    }
    const ofxBackfill: Record<string, string> = {}
    if (ofx.categoryId === null && candidate.categoryId !== null) {
      ofxBackfill.categoryId = candidate.categoryId
    }
    if (ofx.supplierId === null && candidate.supplierId !== null) {
      ofxBackfill.supplierId = candidate.supplierId
    }

    // ⭐ o rastro da diferença fica NA CONTA, escrito, não só no audit — é o que
    // o dono lê seis meses depois quando perguntar "por que 232,81 e não 230,81?".
    const rastroDaDiferenca =
      input.diferencaAceita !== undefined && Math.abs(input.diferencaAceita) >= AMOUNT_EQ_TOLERANCE
        ? `pagamento conciliado com a linha do extrato de ${ofx.date.toISOString().slice(0, 10)}`
          + ` (R$ ${ofx.amount.toFixed(2)}) · diferença de R$ ${input.diferencaAceita.toFixed(2)}`
          + ` = juros/tarifa de boleto, confirmada por quem conciliou`
        : null

    const candidateUpdated = await trx.transaction.update({
      where: { id: candidate.id },
      data: {
        reconciledWithId: ofx.id,
        status: 'RECONCILED',
        ...(rastroDaDiferenca
          ? { notes: [candidate.notes, rastroDaDiferenca].filter(Boolean).join(' · ') }
          : {}),
        // Sprint A-effected Fase B.3 — groupId pra undo agrupado N:1
        ...(input.reconcileGroupId !== undefined
          ? { reconcileGroupId: input.reconcileGroupId }
          : {}),
        // NÃO mexer em: lifecycle, paymentDate, date, bankAccountId,
        // amount, description, categoryId, supplierId.
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        bankAccount: { select: { id: true, name: true, bankName: true } },
      },
    })

    if (Object.keys(ofxBackfill).length > 0) {
      // Sprint Escada-Status (28/06/2026): se backfill setou categoryId,
      // sobe status pra RECONCILED na mesma operação. OFX que ganha categoria
      // do candidate Excel não pode ficar PENDING (badge "Pendente" enganador
      // em /movimentacoes mesmo tendo "Matéria-Prima"/"Frete"/etc atribuído).
      // 43 das 57 tx Cacula invertidas vinham deste fluxo.
      // ofxBackfill só inclui supplierId (sem categoryId) → mantém status atual.
      const ofxBackfillWithStatus =
        'categoryId' in ofxBackfill
          ? { ...ofxBackfill, status: 'RECONCILED' as const }
          : ofxBackfill
      await trx.transaction.update({
        where: { id: ofx.id },
        data: ofxBackfillWithStatus,
      })
    }

    await logAudit(
      ctx,
      {
        action: 'UPDATE',
        entityType: 'Reconciliation',
        entityId: candidate.id,
        fieldsChanged: {
          reconciledWithId: { before: null, after: ofx.id },
          status: { before: candidate.status, after: 'RECONCILED' },
        },
        metadata: {
          mode: 'EFFECTED_ORPHAN',
          ofxTransactionId: ofx.id,
          ofxDescription: ofx.description,
          ofxAmount: ofx.amount,
          candidateDescription: candidate.description,
          candidateAmount: candidate.amount,
          // Estado prévio pra UNDO restaurar (não roda dado contábil aqui)
          ofxBefore,
          ofxBackfilled: ofxBackfill,
          candidateStatusBefore: candidate.status,
          diferencaAceita: input.diferencaAceita ?? null,
          reconcileGroupId: input.reconcileGroupId ?? null,
        },
      },
      trx,
    )

    return candidateUpdated
  })

  return { candidate: updated, ofx }
}

interface AuditFieldsChanged {
  lifecycle?: { before?: unknown; after?: unknown }
}

interface AuditMetadata {
  mode?: 'CLASSIC' | 'EFFECTED_ORPHAN'
  ofxTransactionId?: string
  ofxBefore?: { categoryId: string | null; supplierId: string | null }
  ofxBackfilled?: Record<string, string>
  candidateStatusBefore?: string
}

function parseAuditJSON<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function undoReconciliation(
  candidateId: string,
  ctx: AuthContext,
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: candidateId },
    include: {
      bankAccount: { select: { companyId: true } },
      supplier: { select: { companyId: true } },
      customer: { select: { companyId: true } },
      category: { select: { companyId: true } },
    },
  })

  if (!tx) throw new ReconciliationError('Transação não encontrada', 404)
  if (!tx.reconciledWithId) {
    throw new ReconciliationError('Transação não está conciliada')
  }

  // Última conciliação (mais recente) — usado pra detectar modo e restaurar
  // estado anterior (CLASSIC ou ORPHAN).
  const lastAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Reconciliation', entityId: candidateId, action: 'UPDATE' },
    orderBy: { timestamp: 'desc' },
  })
  if (!lastAudit) {
    throw new ReconciliationError(
      'Não foi possível desfazer (audit log da conciliação não encontrado)',
    )
  }

  const companyId =
    tx.bankAccount?.companyId ??
    tx.supplier?.companyId ??
    tx.customer?.companyId ??
    tx.category?.companyId
  if (!companyId) throw new ReconciliationError('Empresa não resolvida', 422)
  if (ctx.company?.id !== companyId) {
    throw new ReconciliationError('Contexto de autenticação não corresponde à empresa')
  }
  ctx.requirePermission('transaction.update')

  const fieldsChanged = parseAuditJSON<AuditFieldsChanged>(lastAudit.fieldsChanged) ?? {}
  const metadata = parseAuditJSON<AuditMetadata>(lastAudit.metadata) ?? {}
  const mode = metadata.mode ?? 'CLASSIC'

  const reverted = await prisma.$transaction(async (trx) => {
    if (mode === 'CLASSIC') {
      const originalLifecycle = fieldsChanged.lifecycle?.before as
        | 'PAYABLE'
        | 'RECEIVABLE'
        | undefined
      if (originalLifecycle !== 'PAYABLE' && originalLifecycle !== 'RECEIVABLE') {
        throw new ReconciliationError('Lifecycle original inválido no audit')
      }
      const updated = await trx.transaction.update({
        where: { id: candidateId },
        data: {
          lifecycle: originalLifecycle,
          paymentDate: null,
          bankAccountId: null,
          reconciledWithId: null,
          reconcileGroupId: null, // Fase B.3 — limpa groupId no undo
          status: 'PENDING',
        },
      })
      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'Reconciliation',
          entityId: candidateId,
          metadata: { undone: true, mode: 'CLASSIC', restoredLifecycle: originalLifecycle },
        },
        trx,
      )
      return updated
    }

    // ORPHAN mode — undo: limpa link + status volta pro anterior +
    // restaura OFX.categoryId/supplierId se houve backfill.
    const statusBefore = metadata.candidateStatusBefore ?? 'PENDING'
    const updated = await trx.transaction.update({
      where: { id: candidateId },
      data: {
        reconciledWithId: null,
        reconcileGroupId: null, // Fase B.3 — limpa groupId no undo
        status: statusBefore,
        // NÃO toca em lifecycle (já era EFFECTED), paymentDate, bankAccountId, etc.
      },
    })

    // Restaura OFX se houve backfill cooperativo
    const backfilled = metadata.ofxBackfilled ?? {}
    const ofxBefore = metadata.ofxBefore
    if (
      metadata.ofxTransactionId &&
      ofxBefore &&
      Object.keys(backfilled).length > 0
    ) {
      const restoreData: Record<string, string | null> = {}
      if ('categoryId' in backfilled) restoreData.categoryId = ofxBefore.categoryId
      if ('supplierId' in backfilled) restoreData.supplierId = ofxBefore.supplierId
      if (Object.keys(restoreData).length > 0) {
        await trx.transaction.update({
          where: { id: metadata.ofxTransactionId },
          data: restoreData,
        })
      }
    }

    await logAudit(
      ctx,
      {
        action: 'UPDATE',
        entityType: 'Reconciliation',
        entityId: candidateId,
        metadata: {
          undone: true,
          mode: 'EFFECTED_ORPHAN',
          restoredStatus: statusBefore,
          ofxRestored: backfilled,
        },
      },
      trx,
    )

    return updated
  })

  return reverted
}
