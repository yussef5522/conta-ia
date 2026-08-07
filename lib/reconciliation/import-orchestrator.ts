// Orquestrador do import OFX no caminho RECONCILE_V2.
// CHAMADO SOMENTE quando isReconcileV2Enabled() === true. Caminho legado intacto.
//
// Fluxo:
//   1. parseOFX (existente) extrai 1 StatementLine por <STMTTRN>
//   2. Reconcilia bidirecionalmente contra EFFECTED do DB na janela (Tier 1 + Tier 2)
//   3. Persiste statement_lines + rawOfxBlob (espelho cru pra auditoria — fecha o gap)
//   4. missing → insere como EFFECTED (origin=OFX)
//   5. previews → insere como PAYABLE/RECEIVABLE (NUNCA EFFECTED)
//   6. matched → SKIP (já no DB; ZERO duplicação por FITID reciclado)
//   7. orphans → cria warnings em import_warnings (revisão humana, NUNCA delete auto)
//
// Multi-tenant: todos os writes ficam dentro do bankAccountId recebido (checado upstream).

import type { Prisma, PrismaClient } from '@prisma/client'
import { parseOFX } from '@/lib/ofx/parser'
import { dedupHashOFX } from '@/lib/ofx/dedup'
import type { CategoryOverride } from '@/lib/import-categorization/apply-overrides'
import { applyImportDecisions, type ImportDecision } from '@/lib/ofx/decisions'
import { prepareBalanceTransactions } from '@/lib/balance/prepare'
import { parseStatementFromOFX } from './parse-statement-from-ofx'
import { reconcileStatement } from './reconcile-statement'
import { stableKey } from './stable-key'
import { buildLineDedupHash, makeOccurrenceCounter } from './line-dedup-hash'
import { isPreviewLine } from './is-preview'
import { isReconcileV2Enabled } from './flag'
import { recalcularSaldoConta } from '@/lib/balance/recalcular'
import { dedupPreviewsAgainstDbPending } from './dedup-previews'
import type { DbBankTransaction } from './types'

export interface ImportOrchestratorInput {
  bankAccountId: string
  rawOfx: string
  userId: string
  fileName: string
  ipAddress?: string
  userAgent?: string
  // Override opcional pro corte min(DTASOF, today). Default = new Date().
  // Em testes ou simulações determinísticas é útil; em prod normal não passar.
  today?: Date
  // Categorias escolhidas pelo usuário no preview (mapa dedupHash → categoryId).
  // A CHAVE é o `dedupHashOFX` (sha256 fitid|date|valor|memo) — a MESMA que o
  // client conhece do preview (`filtrarNovasOFX`), NÃO o stableKey nem o
  // dedupHash de linha armazenado (stableKey#importId:occ). Recomputada por
  // linha na criação. Espelha o applyCategoryOverrides do caminho V1.
  categoryOverrides?: CategoryOverride[]
  // Decisões declarativas do preview (dedupHash → CREATE_NEW/SKIP/…). Linha
  // marcada SKIP NÃO vira tx (Etapa 3a — paridade com o V1). Mesma chave
  // dedupHashOFX dos categoryOverrides. Sem isto, "preview ≠ confirm" no V2.
  decisions?: ImportDecision[]
}

export interface ImportOrchestratorResult {
  importId: string
  ledgerBalance: number | null
  dtAsOf: Date
  classification: {
    effected: number
    preview: number
    previewAlreadyExisting: number // previews que já existem como PAYABLE no DB
    skippedMatched: number
    orphanWarnings: number
  }
  matchedExact: number
  matchedFuzzy: number
  warnings: Array<{
    dbTxId: string
    reason: string
    memo: string
    signedAmount: number
    date: string
    fitid: string | null
  }>
  insertedTxIds: string[]
  insertedWarningIds: string[]
}

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Resolve a categoria de UMA linha EFFECTED nova a partir dos overrides do
 * preview. A chave de casamento é o `dedupHashOFX` (fitid|date|valor|memo) —
 * recomputado da linha, idêntico ao que o client enviou (`filtrarNovasOFX`).
 * Espelha o applyCategoryOverrides do V1: categoria → RECONCILED/MANUAL/conf 1;
 * sem override (ou override null = "A classificar") → PENDING/sem categoria.
 * Puro — exportado só pra teste.
 */
export function resolveLineOverride(
  overrideMap: Map<string, string | null>,
  line: { datePosted: Date; signedAmount: number; memo: string; fitid?: string | null },
): { categoryId: string | null; status: 'PENDING' | 'RECONCILED'; classificationSource: 'MANUAL' | null; aiConfidence: number | null } {
  const type = line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT'
  const ofxHash = dedupHashOFX({
    datePosted: line.datePosted,
    type,
    amount: Math.abs(line.signedAmount),
    memo: line.memo,
    fitid: line.fitid ?? '',
  })
  const cat = overrideMap.has(ofxHash) ? overrideMap.get(ofxHash) ?? null : undefined
  return cat
    ? { categoryId: cat, status: 'RECONCILED', classificationSource: 'MANUAL', aiConfidence: 1.0 }
    : { categoryId: null, status: 'PENDING', classificationSource: null, aiConfidence: null }
}

export async function runImportV2(
  tx: Tx,
  input: ImportOrchestratorInput,
): Promise<ImportOrchestratorResult> {
  if (!isReconcileV2Enabled()) {
    throw new Error('runImportV2 chamado mas RECONCILE_V2 desligado — abort')
  }

  // 1. Parse
  const parsed = parseOFX(input.rawOfx)
  if (!parsed.ledgerBalance) throw new Error('OFX sem LEDGERBAL/DTASOF — abort')
  const { lines, dtAsOf: dtAsOfMaybe, ledgerBalance } = parseStatementFromOFX(parsed)
  if (!dtAsOfMaybe) throw new Error('OFX sem DTASOF — abort')
  const dtAsOf = dtAsOfMaybe
  if (lines.length === 0) throw new Error('OFX sem transações — abort')

  // 2. Janela: minDate → dtAsOf
  const minDate = lines.reduce((m, l) => (l.datePosted < m ? l.datePosted : m), lines[0].datePosted)

  // 3. Fetch tx EFFECTED da conta na janela (pra reconcile real_lines)
  // + tx PAYABLE/RECEIVABLE da janela (pra deduplicar previews — evita recriar
  // o agendado que já existe). Inclui também a janela > dtAsOf pq previews têm
  // datePosted no FUTURO (ex: PAGAMENTO CARTAO 15/06 quando DTASOF=12/06).
  const dbEffected = await tx.transaction.findMany({
    where: {
      bankAccountId: input.bankAccountId,
      lifecycle: 'EFFECTED',
      date: { gte: minDate, lte: dtAsOf },
    },
    select: {
      id: true, date: true, createdAt: true, type: true, amount: true,
      bankAccountId: true, transferGroupId: true, externalId: true, description: true,
    },
  })

  // Pending (PAYABLE/RECEIVABLE) — janela ESTENDIDA pra cobrir previews futuros
  // (ex: agendado 15/06 > DTASOF 12/06)
  const dbPending = await tx.transaction.findMany({
    where: {
      bankAccountId: input.bankAccountId,
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
      date: { gte: minDate, lte: new Date(dtAsOf.getTime() + 365 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, date: true, type: true, amount: true, description: true },
  })

  const groupIds = [
    ...new Set(dbEffected.filter((t) => t.transferGroupId).map((t) => t.transferGroupId!)),
  ]
  const sisters = groupIds.length
    ? await tx.transaction.findMany({
        where: { transferGroupId: { in: groupIds }, bankAccountId: { not: input.bankAccountId } },
        select: {
          id: true, date: true, createdAt: true, type: true, amount: true,
          bankAccountId: true, transferGroupId: true,
        },
      })
    : []

  const allForPrepare: any[] = [...dbEffected, ...sisters]
  const signedList = prepareBalanceTransactions(allForPrepare as any, input.bankAccountId)
  const signedById = new Map(signedList.map((s) => [s.id, s.signedAmount]))

  const dbBankTxs: DbBankTransaction[] = dbEffected.map((t) => ({
    id: t.id,
    date: t.date,
    signedAmount: signedById.get(t.id) ?? (t.type === 'CREDIT' ? t.amount : -t.amount),
    memo: t.description ?? '',
    fitid: t.externalId ?? undefined,
    lifecycle: 'EFFECTED',
    type: t.type,
  }))

  // 4. Reconcile bidirecional (Tier 1 EXACT + Tier 2 FUZZY)
  // Passa `today` pro corte de preview ser min(DTASOF, today) — cobre
  // bancos que declaram DTASOF futuro (Sicredi: 30/06 num extrato de 13/06).
  const result = reconcileStatement(lines, dbBankTxs, dtAsOf, input.today)

  // Overrides de categoria do preview, indexados por dedupHashOFX (a chave que
  // o client envia). Só afeta linhas EFFECTED novas (previews PAYABLE/RECEIVABLE
  // seguem sem categoria, igual ao V1). value null = "manter A classificar".
  const overrideMap = new Map<string, string | null>()
  for (const o of input.categoryOverrides ?? []) overrideMap.set(o.dedupHash, o.categoryId)
  let overridesApplied = 0

  // 5. Criar OfxImport + rawOfxBlob
  const bankAcc = await tx.bankAccount.findUniqueOrThrow({
    where: { id: input.bankAccountId },
    select: { companyId: true },
  })

  const newImport = await tx.ofxImport.create({
    data: {
      bankAccountId: input.bankAccountId,
      userId: input.userId,
      status: 'SUCCESS',
      fileName: input.fileName,
      fileSize: input.rawOfx.length,
      totalTransactions: parsed.transactions.length,
      newTransactions: result.missing.length + result.previews.length,
      duplicates: result.matched.length,
      autoClassified: 0,
      periodStart: minDate,
      periodEnd: dtAsOf,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })

  // rawOfxBlob via raw porque schema.prisma do client ainda não conhece o campo
  await tx.$executeRaw`UPDATE ofx_imports SET "rawOfxBlob"=${input.rawOfx} WHERE id=${newImport.id}`

  // 6. Persistir statement_lines (espelho cru, COM flag isPreview por linha)
  for (const line of lines) {
    const sk = stableKey({ date: line.datePosted, signedAmount: line.signedAmount, memo: line.memo })
    const isPrev = isPreviewLine({ datePosted: line.datePosted, fitid: line.fitid }, dtAsOf)
    await tx.$executeRaw`
      INSERT INTO statement_lines (id, "importId", "bankAccountId", "datePosted", "signedAmount", memo, fitid, "stableKey", "isPreview")
      VALUES (gen_random_uuid()::text, ${newImport.id}, ${input.bankAccountId}, ${line.datePosted}, ${line.signedAmount}, ${line.memo}, ${line.fitid ?? null}, ${sk}, ${isPrev})
    `
  }

  // 7. EFFECTED para missing (linhas reais novas — não previews)
  // dedupHash = identidade de LINHA (stableKey + batch + ocorrência). NUNCA o
  // stableKey puro: 2 linhas reais idênticas (mesmo stableKey) precisam virar 2
  // transações — o stableKey puro colidiria no @@unique. Ver ./line-dedup-hash.
  const nextOcc = makeOccurrenceCounter()
  const insertedTxIds: string[] = []
  // Decisões do preview (SKIP não vira tx) — mesma chave dedupHashOFX dos
  // categoryOverrides, mesma função pura do V1 (applyImportDecisions). Aplica
  // ANTES de criar, tanto em EFFECTED (missing) quanto em previews.
  const ofxHashOf = (line: { datePosted: Date; signedAmount: number; memo: string; fitid?: string | null }) =>
    dedupHashOFX({
      datePosted: line.datePosted,
      type: line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(line.signedAmount),
      memo: line.memo,
      fitid: line.fitid ?? '',
    })
  const missingDecided = applyImportDecisions(
    result.missing.map((l) => ({ line: l, dedupHash: ofxHashOf(l) })),
    input.decisions,
  )
  let skippedByDecision = missingDecided.skipped
  for (const { line } of missingDecided.filtered) {
    const sk = stableKey({ date: line.datePosted, signedAmount: line.signedAmount, memo: line.memo })
    const type = line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT'
    // Casa o override do preview pela MESMA chave que o client usou (dedupHashOFX).
    const ov = resolveLineOverride(overrideMap, line)
    if (ov.status === 'RECONCILED') overridesApplied += 1
    const created = await tx.transaction.create({
      data: {
        bankAccountId: input.bankAccountId,
        date: line.datePosted,
        description: line.memo,
        amount: Math.abs(line.signedAmount),
        type,
        // Categoria do usuário → RECONCILED (igual V1). Sem categoria → PENDING.
        status: ov.status,
        categoryId: ov.categoryId,
        classificationSource: ov.classificationSource,
        aiConfidence: ov.aiConfidence,
        origin: 'OFX',
        externalId: line.fitid ?? null,
        importId: newImport.id,
        lifecycle: 'EFFECTED',
        counterpartyName: line.counterpartyName ?? null,
        counterpartySource: line.counterpartyName ? 'OFX' : null,
        dedupHash: buildLineDedupHash(sk, newImport.id, nextOcc(sk)),
      },
      select: { id: true },
    })
    insertedTxIds.push(created.id)
  }
  // Reflete no relatório do import quantas entraram já categorizadas.
  if (overridesApplied > 0) {
    await tx.ofxImport.update({ where: { id: newImport.id }, data: { autoClassified: overridesApplied } })
  }

  // 8. PAYABLE/RECEIVABLE para previews (NUNCA EFFECTED) — com dedup contra DB pending
  const pendingForDedup = dbPending.map((t) => ({
    id: t.id,
    date: t.date,
    signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
    memo: t.description ?? '',
  }))
  const previewDedup = dedupPreviewsAgainstDbPending(result.previews, pendingForDedup)

  // SKIP do preview também vale pras linhas futuras (PAYABLE/RECEIVABLE).
  const previewsDecided = applyImportDecisions(
    previewDedup.toCreate.map((l) => ({ line: l, dedupHash: ofxHashOf(l) })),
    input.decisions,
  )
  skippedByDecision += previewsDecided.skipped
  for (const { line } of previewsDecided.filtered) {
    const sk = stableKey({ date: line.datePosted, signedAmount: line.signedAmount, memo: line.memo })
    const type = line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT'
    const lifecycle = line.signedAmount >= 0 ? 'RECEIVABLE' : 'PAYABLE'
    const created = await tx.transaction.create({
      data: {
        bankAccountId: input.bankAccountId,
        date: line.datePosted,
        description: line.memo,
        amount: Math.abs(line.signedAmount),
        type,
        status: 'PENDING',
        origin: 'OFX',
        externalId: line.fitid ?? null,
        importId: newImport.id,
        lifecycle,
        dueDate: line.datePosted, // invariante PAYABLE/RECEIVABLE: dueDate obrigatório
        // paymentDate NULL — invariante PAYABLE/RECEIVABLE
        counterpartyName: line.counterpartyName ?? null,
        counterpartySource: line.counterpartyName ? 'OFX' : null,
        dedupHash: buildLineDedupHash(sk, newImport.id, nextOcc(sk)),
      },
      select: { id: true },
    })
    insertedTxIds.push(created.id)
  }

  // 8.5. Sprint Cartao R2 (24/06/2026) — marca tx que parecem PAGAMENTO DE
  // CARTAO como isCardPayment=true (sem cartao vinculado ainda — fica
  // aguardando casar com fatura PDF). Filtro do DRE/cashflow ja pula
  // isCardPayment=true, entao a tx sai do DRE imediatamente.
  if (insertedTxIds.length > 0) {
    const { detectCardPayment } = await import('@/lib/credit-card-pj/payment-detector')
    const justCreated = await tx.transaction.findMany({
      where: { id: { in: insertedTxIds } },
      select: { id: true, description: true, type: true },
    })
    const cardPaymentIds = justCreated
      .filter((t) => detectCardPayment({ description: t.description, type: t.type }).isLikely)
      .map((t) => t.id)
    if (cardPaymentIds.length > 0) {
      await tx.transaction.updateMany({
        where: { id: { in: cardPaymentIds } },
        data: { isCardPayment: true },
      })
    }
  }

  // Corrige a contagem do import quando o usuário pediu SKIP no preview
  // (newTransactions foi setado antes dos loops, com o total pré-skip).
  if (skippedByDecision > 0) {
    await tx.ofxImport.update({
      where: { id: newImport.id },
      data: { newTransactions: insertedTxIds.length },
    })
    console.log(`[RECONCILE_V2] ${skippedByDecision} linha(s) puladas por decisão SKIP do preview`)
  }

  // 9. Warnings para orphans (NUNCA delete automático)
  const insertedWarningIds: string[] = []
  const warningsOut: ImportOrchestratorResult['warnings'] = []
  for (const orf of result.orphans) {
    const reason = `ORPHAN_RECONCILE_V2: ${orf.memo} | ${orf.signedAmount.toFixed(2)} | ${orf.date.toISOString().slice(0, 10)} | FITID=${orf.fitid ?? '-'}`
    const warn = await tx.importWarning.create({
      data: {
        companyId: bankAcc.companyId,
        bankAccountId: input.bankAccountId,
        importId: newImport.id,
        newTxId: orf.id, // tx que precisa revisão = a própria órfã
        suspectedDupId: orf.id, // sem duplicata equivalente — aponta pra si mesma
        similarity: 0,
        reason,
      },
      select: { id: true },
    })
    insertedWarningIds.push(warn.id)
    warningsOut.push({
      dbTxId: orf.id,
      reason,
      memo: orf.memo,
      signedAmount: orf.signedAmount,
      date: orf.date.toISOString().slice(0, 10),
      fitid: orf.fitid ?? null,
    })
  }

  // 10. DEFEITO 1 fix (31/07): grava o LEDGERBAL declarado pelo OFX + recalcula o
  // saldo da conta DENTRO deste mesmo $transaction (antes o V2 nunca recalculava
  // → saldo ficava travado). recalcularSaldoConta ANCORA no ledgerBal, então
  // NUNCA assume abertura 0 — respeita a abertura/histórico da conta.
  await tx.bankAccount.update({
    where: { id: input.bankAccountId },
    data: { ledgerBal: ledgerBalance, ledgerBalDate: dtAsOf },
  })
  await recalcularSaldoConta(tx, input.bankAccountId)

  return {
    importId: newImport.id,
    ledgerBalance,
    dtAsOf,
    classification: {
      effected: result.missing.length,
      preview: previewDedup.toCreate.length,
      previewAlreadyExisting: previewDedup.alreadyExisting.length,
      skippedMatched: result.matched.length,
      orphanWarnings: result.orphans.length,
    },
    matchedExact: result.matched.filter((m) => m.confidence === 'EXACT').length,
    matchedFuzzy: result.matched.filter((m) => m.confidence === 'FUZZY').length,
    warnings: warningsOut,
    insertedTxIds,
    insertedWarningIds,
  }
}
