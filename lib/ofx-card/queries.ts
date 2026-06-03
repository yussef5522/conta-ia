// Sprint PF Fatia 3 — Orquestrador import OFX cartão (preview + confirm + revert).

import { createHash, randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import type {
  PersonalOfxImport,
  PersonalTransaction,
  CreditCardInvoice,
} from '@prisma/client'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { parseOFXExtended, type OFXParseResultExt } from './parser-ext'
import {
  detectInstallment,
} from './detect-installment'
import { detectSpecialTx } from './detect-special-tx'
import {
  findDuplicatesAgainstManual,
  type DupMatch,
  type OfxTxLite,
  type ManualTxLite,
} from './dedup-against-manual'
import {
  categorizePf,
  type PfRuleSnapshot,
} from '@/lib/ai-categorizer/categorize-pf'
import { dedupHashOFX } from '@/lib/ofx/dedup'
import { getCardInProfile } from '@/lib/credit-card/queries'
import { calculateInvoiceReference } from '@/lib/credit-card/calculate-invoice-reference'

export class OfxCardError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'OfxCardError'
  }
}

// ============================================================
// PREVIEW (não cria PersonalTransaction — só prepara linhas pra UI)
// ============================================================

export interface PreviewLine {
  index: number
  fitid: string
  date: string         // ISO
  rawAmount: number
  type: 'CREDIT' | 'DEBIT'
  description: string
  baseDescription?: string
  isInstallment: boolean
  installmentNumber?: number
  installmentTotal?: number
  specialKind: string | null
  isInternational: boolean
  shouldSkipImport: boolean
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  confidence: number
  layer: string
  reasoning: string
  /** Hash interno (fitid+date+amount+memo) — usa pra dedup reimport */
  dedupHash: string
  /** Match contra tx manual já lançada (se houver) */
  manualDupMatch?: DupMatch
  manualDupTxId?: string
  manualDupDescription?: string
  /** Categoria sugerida final (pode ter sido editada pelo user no front) */
  finalCategoryId?: string | null
  /** User decidiu skipar */
  userSkip?: boolean
}

export interface PreviewResult {
  importId: string
  statementType: 'BANK' | 'CREDITCARD'
  org?: string
  fid?: string
  detectedAcctId?: string
  totalLines: number
  toImport: number
  parcelasDetected: number
  invoicePaymentsSkipped: number
  encargosDetected: number
  possibleDups: number
  lines: PreviewLine[]
}

export interface CreatePreviewInput {
  userId: string
  profileId: string
  creditCardId: string
  fileName: string
  fileSize: number
  rawContent: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function createPreview(input: CreatePreviewInput): Promise<PreviewResult> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const card = await getCardInProfile(input.profileId, input.creditCardId)

  const parsed = parseOFXExtended(input.rawContent)
  if (parsed.errors.length > 0 && parsed.transactions.length === 0) {
    throw new OfxCardError(
      `Parse falhou: ${parsed.errors.slice(0, 3).join('; ')}`,
      'PARSE_FAILED',
    )
  }

  // Limit sanity
  if (parsed.transactions.length > 500) {
    throw new OfxCardError(
      `OFX tem ${parsed.transactions.length} transações (limite: 500)`,
      'TOO_MANY_TX',
    )
  }

  // Cria PersonalOfxImport (status PROCESSING — vira SUCCESS após confirm)
  const periodStart = parsed.transactions.length > 0
    ? new Date(Math.min(...parsed.transactions.map((t) => t.datePosted.getTime())))
    : null
  const periodEnd = parsed.transactions.length > 0
    ? new Date(Math.max(...parsed.transactions.map((t) => t.datePosted.getTime())))
    : null

  const importRec = await prisma.personalOfxImport.create({
    data: {
      profileId: input.profileId,
      creditCardId: input.creditCardId,
      userId: input.userId,
      status: 'PROCESSING',
      fileName: input.fileName,
      fileSize: input.fileSize,
      statementType: parsed.statementType,
      totalTransactions: parsed.transactions.length,
      detectedOrg: parsed.org ?? null,
      detectedFid: parsed.fid ?? null,
      detectedAcctId: parsed.accountId ?? null,
      periodStart,
      periodEnd,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })

  // Categorias + regras + tx manuais do cartão pra dup-check
  const [categories, rules, manualTxs] = await Promise.all([
    prisma.personalCategory.findMany({
      where: { profileId: input.profileId, isActive: true },
      select: { id: true, name: true, type: true },
    }),
    prisma.aiLearningRule.findMany({
      where: { profileId: input.profileId, isActive: true },
      select: {
        id: true,
        tipoMatch: true,
        padrao: true,
        personalCategoryId: true,
        confianca: true,
      },
    }),
    prisma.personalTransaction.findMany({
      where: {
        profileId: input.profileId,
        creditCardId: input.creditCardId,
      },
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        installmentGroupId: true,
        installmentNumber: true,
        installmentTotal: true,
        dedupHash: true,
      },
    }),
  ])

  const categoriesByName = new Map<string, { id: string; type: 'INCOME' | 'EXPENSE' }>()
  for (const c of categories) {
    categoriesByName.set(c.name, { id: c.id, type: c.type as 'INCOME' | 'EXPENSE' })
  }
  const categoriesById = new Map(categories.map((c) => [c.id, c]))

  const ruleSnapshots: PfRuleSnapshot[] = rules.map((r) => ({
    id: r.id,
    tipoMatch: r.tipoMatch as 'EXACT' | 'CONTAINS' | 'CNPJ',
    padrao: r.padrao,
    personalCategoryId: r.personalCategoryId,
    confianca: r.confianca,
  }))

  // Dup check
  const ofxLites: OfxTxLite[] = parsed.transactions.map((t) => ({
    fitid: t.fitid,
    date: t.datePosted,
    amount: t.amount,
    description: t.memo,
  }))
  const manualLites: ManualTxLite[] = manualTxs.map((m) => ({
    id: m.id,
    date: m.date,
    amount: m.amount,
    description: m.description,
    installmentGroupId: m.installmentGroupId,
    installmentNumber: m.installmentNumber,
    installmentTotal: m.installmentTotal,
  }))
  const dups = findDuplicatesAgainstManual(ofxLites, manualLites)
  const dupByFitid = new Map(dups.map((d) => [d.ofxFitid, d]))

  // Hash de tx já importadas antes (reimport detection)
  const alreadyImportedHashes = new Set(
    manualTxs.map((m) => m.dedupHash).filter((h): h is string => !!h),
  )

  // Montar lines
  const lines: PreviewLine[] = []
  let parcelasCount = 0
  let invoicePaymentsCount = 0
  let encargosCount = 0
  let possibleDupsCount = 0

  for (let i = 0; i < parsed.transactions.length; i++) {
    const tx = parsed.transactions[i]
    const result = categorizePf({
      description: tx.memo,
      amount: tx.amount,
      type: tx.type,
      rules: ruleSnapshots,
      categoriesByName,
    })

    const dedupHash = dedupHashOFX(tx)
    const isReimport = alreadyImportedHashes.has(dedupHash)
    const dupMatch = dupByFitid.get(tx.fitid)

    if (result.isInstallment) parcelasCount++
    if (result.specialKind === 'INVOICE_PAYMENT') invoicePaymentsCount++
    if (result.specialKind && result.specialKind !== 'INVOICE_PAYMENT') encargosCount++
    if (dupMatch || isReimport) possibleDupsCount++

    const suggestedCategoryName = result.categoryId
      ? categoriesById.get(result.categoryId)?.name ?? null
      : null

    lines.push({
      index: i,
      fitid: tx.fitid,
      date: tx.datePosted.toISOString(),
      rawAmount: tx.amount,
      type: tx.type,
      description: tx.memo,
      baseDescription: result.baseDescription,
      isInstallment: result.isInstallment,
      installmentNumber: result.installmentNumber,
      installmentTotal: result.installmentTotal,
      specialKind: result.specialKind,
      isInternational: result.isInternational,
      shouldSkipImport: result.shouldSkipImport || isReimport,
      suggestedCategoryId: result.categoryId,
      suggestedCategoryName,
      confidence: result.confidence,
      layer: result.layer,
      reasoning: isReimport
        ? 'Já importada antes (mesmo hash)'
        : result.reasoning,
      dedupHash,
      manualDupMatch: dupMatch,
      manualDupTxId: dupMatch?.manualTxId,
      manualDupDescription: dupMatch
        ? manualTxs.find((m) => m.id === dupMatch.manualTxId)?.description
        : undefined,
    })
  }

  const toImport = lines.filter((l) => !l.shouldSkipImport && !l.manualDupMatch).length

  return {
    importId: importRec.id,
    statementType: parsed.statementType,
    org: parsed.org,
    fid: parsed.fid,
    detectedAcctId: parsed.accountId,
    totalLines: lines.length,
    toImport,
    parcelasDetected: parcelasCount,
    invoicePaymentsSkipped: invoicePaymentsCount,
    encargosDetected: encargosCount,
    possibleDups: possibleDupsCount,
    lines,
  }
}

// ============================================================
// CONFIRM
// ============================================================

export interface ConfirmDecision {
  fitid: string
  /** User decidiu pular essa linha */
  skip: boolean
  /** categoryId final escolhido (pode ser diferente do sugerido) */
  categoryId: string | null
}

export interface ConfirmInput {
  userId: string
  profileId: string
  importId: string
  /** Decisões por linha — só linhas presentes aqui são consideradas */
  decisions: ConfirmDecision[]
  /** Snapshot bruto do OFX (precisamos re-parsear pra criar PersonalTransaction) */
  rawContent: string
}

export interface ConfirmResult {
  importId: string
  imported: number
  skipped: number
  invoicesUpdated: number
}

export async function confirmImport(input: ConfirmInput): Promise<ConfirmResult> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const importRec = await prisma.personalOfxImport.findUnique({
    where: { id: input.importId },
  })
  if (!importRec || importRec.profileId !== input.profileId) {
    throw new OfxCardError('Import não encontrado', 'IMPORT_NOT_FOUND')
  }
  if (importRec.status !== 'PROCESSING') {
    throw new OfxCardError(`Import já foi ${importRec.status}`, 'INVALID_STATUS')
  }
  if (!importRec.creditCardId) {
    throw new OfxCardError('Import sem cartão', 'NO_CARD')
  }
  const card = await getCardInProfile(input.profileId, importRec.creditCardId)

  const parsed = parseOFXExtended(input.rawContent)
  const decisionMap = new Map(input.decisions.map((d) => [d.fitid, d]))

  // Validar todos os categoryIds das decisões pertencem ao perfil
  const decisionCatIds = new Set(
    input.decisions.map((d) => d.categoryId).filter((id): id is string => !!id),
  )
  if (decisionCatIds.size > 0) {
    const valid = await prisma.personalCategory.findMany({
      where: { id: { in: [...decisionCatIds] }, profileId: input.profileId },
      select: { id: true },
    })
    if (valid.length !== decisionCatIds.size) {
      throw new OfxCardError(
        'Uma ou mais categorias não pertencem a este perfil',
        'INVALID_CATEGORY',
      )
    }
  }

  let imported = 0
  let skipped = 0
  const invoiceIdsUpdated = new Set<string>()

  await prisma.$transaction(async (tx) => {
    for (const ofxTx of parsed.transactions) {
      const decision = decisionMap.get(ofxTx.fitid)
      if (!decision || decision.skip) {
        skipped++
        continue
      }

      const inst = detectInstallment(ofxTx.memo)
      const special = detectSpecialTx(ofxTx.memo, ofxTx.type)

      // Calcula em qual invoice cai (usa a data da transação)
      const invRef = calculateInvoiceReference(ofxTx.datePosted, {
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        closingDayRule: card.closingDayRule as 'ATUAL' | 'PROXIMA',
      })
      const invoice = await tx.creditCardInvoice.upsert({
        where: {
          creditCardId_reference: {
            creditCardId: card.id,
            reference: invRef.reference,
          },
        },
        create: {
          creditCardId: card.id,
          reference: invRef.reference,
          closingDate: invRef.closingDate,
          dueDate: invRef.dueDate,
          status: 'OPEN',
        },
        update: {},
      })

      const dedupHash = dedupHashOFX(ofxTx)

      // Tenta criar — se dedupHash já existe (race), pula
      try {
        await tx.personalTransaction.create({
          data: {
            profileId: input.profileId,
            categoryId: decision.categoryId ?? null,
            date: ofxTx.datePosted,
            description: ofxTx.memo,
            amount: ofxTx.amount,
            type: ofxTx.type,
            status: 'RECONCILED',
            origin: 'OFX',
            externalId: ofxTx.fitid,
            dedupHash,
            creditCardId: card.id,
            creditCardInvoiceId: invoice.id,
            installmentNumber: inst.installmentNumber ?? null,
            installmentTotal: inst.installmentTotal ?? null,
            installmentGroupId: null,
            isInternational: special.isInternational,
            ofxImportId: input.importId,
            classifiedBy: decision.categoryId ? 'OFX' : null,
          },
        })

        // Atualiza totalAmount da invoice (despesa = DEBIT)
        if (ofxTx.type === 'DEBIT') {
          await tx.creditCardInvoice.update({
            where: { id: invoice.id },
            data: { totalAmount: { increment: ofxTx.amount } },
          })
        }
        invoiceIdsUpdated.add(invoice.id)
        imported++
      } catch {
        // Pode ser unique-violation no dedup → skipa
        skipped++
      }
    }

    // Atualiza importRec final
    await tx.personalOfxImport.update({
      where: { id: input.importId },
      data: {
        status: 'SUCCESS',
        newTransactions: imported,
        duplicates: skipped,
      },
    })
  })

  return {
    importId: input.importId,
    imported,
    skipped,
    invoicesUpdated: invoiceIdsUpdated.size,
  }
}

// ============================================================
// REVERT
// ============================================================

export interface RevertInput {
  userId: string
  profileId: string
  importId: string
}

export async function revertImport(input: RevertInput): Promise<{ deleted: number }> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const importRec = await prisma.personalOfxImport.findUnique({
    where: { id: input.importId },
  })
  if (!importRec || importRec.profileId !== input.profileId) {
    throw new OfxCardError('Import não encontrado', 'IMPORT_NOT_FOUND')
  }
  if (importRec.status !== 'SUCCESS') {
    throw new OfxCardError(`Import com status ${importRec.status} não pode ser revertido`, 'INVALID_STATUS')
  }

  let deleted = 0
  await prisma.$transaction(async (tx) => {
    const txs = await tx.personalTransaction.findMany({
      where: { ofxImportId: input.importId },
    })
    // Decrementa invoices
    const invoiceDeltas = new Map<string, number>()
    for (const t of txs) {
      if (t.type === 'DEBIT' && t.creditCardInvoiceId) {
        invoiceDeltas.set(
          t.creditCardInvoiceId,
          (invoiceDeltas.get(t.creditCardInvoiceId) ?? 0) + t.amount,
        )
      }
    }
    for (const [invId, amount] of invoiceDeltas.entries()) {
      await tx.creditCardInvoice.update({
        where: { id: invId },
        data: { totalAmount: { decrement: amount } },
      })
    }
    const del = await tx.personalTransaction.deleteMany({
      where: { ofxImportId: input.importId },
    })
    deleted = del.count
    await tx.personalOfxImport.update({
      where: { id: input.importId },
      data: {
        status: 'REVERTED',
        revertedAt: new Date(),
        revertedById: input.userId,
      },
    })
  })
  return { deleted }
}

export function isOfxCardError(err: unknown): err is OfxCardError {
  return err instanceof OfxCardError
}
export function isProfileAccessError(err: unknown): err is ProfileAccessError {
  return err instanceof ProfileAccessError
}
