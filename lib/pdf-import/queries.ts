// Sprint PF Fatia 3.5 — Orquestrador "preview PDF".
//
// Junta:
//   1. Feature flag (gate produção/ZDR)
//   2. SHA256 hash do PDF
//   3. Cache hit OU chamada Claude Vision
//   4. Converte PdfExtractResult → linhas que vão pra createPreview da Fatia 3
//   5. PersonalOfxImport recebe sourceType='PDF' + pdfSha256 + scanQuality + confidence
//
// 🛡️ MULTI-TENANT via checkProfileAccess (igual Fatia 3).

import { prisma } from '@/lib/db'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { getCardInProfile, CreditCardError } from '@/lib/credit-card/queries'
import { calculateInvoiceReference } from '@/lib/credit-card/calculate-invoice-reference'
import { dedupHashOFX } from '@/lib/ofx/dedup'
import {
  categorizePf,
  type PfRuleSnapshot,
} from '@/lib/ai-categorizer/categorize-pf'
import { detectInstallment } from '@/lib/ofx-card/detect-installment'
import { detectSpecialTx } from '@/lib/ofx-card/detect-special-tx'
import {
  findDuplicatesAgainstManual,
  type OfxTxLite,
  type ManualTxLite,
} from '@/lib/ofx-card/dedup-against-manual'
import { checkPdfImportFlag } from './feature-flag'
import {
  extractFromPdf,
  sha256Pdf,
  type FetchLike,
} from './extract-from-pdf'
import {
  detectBankFromFileName,
  type BankHint,
} from './pdf-templates'
import { getCachedExtraction, saveCachedExtraction } from './cache'
import { PdfExtractError, type PdfExtractResult } from './types'
import type { PreviewLine } from '@/lib/ofx-card/queries'

export class PdfImportError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'PdfImportError'
  }
}

export interface CreatePdfPreviewInput {
  userId: string
  profileId: string
  creditCardId: string
  fileName: string
  pdfBytes: Uint8Array
  bankHint?: BankHint
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PdfPreviewResult {
  importId: string
  pdfSha256: string
  detectedBank: string | null
  scanQuality: string
  declaredTotal: number | null
  extractedSum: number | null
  declaredTxCount: number | null
  detectedCardLast4: string | null
  confidence: number
  cacheHit: boolean
  totalLines: number
  toImport: number
  parcelasDetected: number
  invoicePaymentsSkipped: number
  encargosDetected: number
  possibleDups: number
  warnings: string[]
  lines: PreviewLine[]
  costCentsUsdX100: number
  inputTokens: number
  outputTokens: number
}

export async function createPdfPreview(
  input: CreatePdfPreviewInput,
  deps: { fetch?: FetchLike; apiKey?: string } = {},
): Promise<PdfPreviewResult> {
  // === 1. Gate ===
  const gate = checkPdfImportFlag()
  if (!gate.allowed) {
    throw new PdfImportError(gate.message, gate.reason)
  }

  // === 2. Multi-tenant ===
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const card = await getCardInProfile(input.profileId, input.creditCardId)

  // === 3. Hash + Cache ===
  const pdfSha256 = sha256Pdf(input.pdfBytes)
  let extraction = await getCachedExtraction(pdfSha256)
  let cacheHit = !!extraction

  if (!extraction) {
    extraction = await extractFromPdf(
      {
        pdfBytes: input.pdfBytes,
        fileName: input.fileName,
        bankHint: input.bankHint,
      },
      { fetch: deps.fetch, apiKey: deps.apiKey },
    )
    await saveCachedExtraction({
      pdfSha256,
      ownerUserId: input.userId,
      result: extraction,
    })
  }

  // === 4. Cria PersonalOfxImport (sourceType='PDF') ===
  const periodStart = extraction.transactions.length > 0
    ? new Date(
        Math.min(
          ...extraction.transactions
            .map((t) => Date.parse(t.date))
            .filter((n) => Number.isFinite(n)),
        ),
      )
    : null
  const periodEnd = extraction.transactions.length > 0
    ? new Date(
        Math.max(
          ...extraction.transactions
            .map((t) => Date.parse(t.date))
            .filter((n) => Number.isFinite(n)),
        ),
      )
    : null

  const importRec = await prisma.personalOfxImport.create({
    data: {
      profileId: input.profileId,
      creditCardId: input.creditCardId,
      userId: input.userId,
      status: 'PROCESSING',
      fileName: input.fileName,
      fileSize: input.pdfBytes.length,
      statementType: 'CREDITCARD',
      sourceType: 'PDF',
      pdfSha256,
      pdfScanQuality: extraction.scanQuality,
      extractionConfidence: extraction.confidence,
      detectedOrg: extraction.detectedBank,
      detectedAcctId: extraction.detectedCardLast4
        ? `****${extraction.detectedCardLast4}`
        : null,
      totalTransactions: extraction.transactions.length,
      periodStart: Number.isFinite(periodStart?.getTime()) ? periodStart : null,
      periodEnd: Number.isFinite(periodEnd?.getTime()) ? periodEnd : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })

  // === 5. Categorias + regras + tx manuais ===
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
  const ofxLites: OfxTxLite[] = extraction.transactions.map((t) => ({
    fitid: t.fitid,
    date: new Date(t.date),
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

  const alreadyImportedHashes = new Set(
    manualTxs.map((m) => m.dedupHash).filter((h): h is string => !!h),
  )

  // === 6. Linhas pra preview ===
  const lines: PreviewLine[] = []
  let parcelasCount = 0
  let invoicePaymentsCount = 0
  let encargosCount = 0
  let possibleDupsCount = 0

  for (let i = 0; i < extraction.transactions.length; i++) {
    const tx = extraction.transactions[i]
    const txDate = new Date(tx.date)
    const result = categorizePf({
      description: tx.memo,
      amount: tx.amount,
      type: tx.type,
      rules: ruleSnapshots,
      categoriesByName,
    })

    const dedupHash = dedupHashOFX({
      fitid: tx.fitid,
      datePosted: txDate,
      amount: tx.amount,
      type: tx.type,
      memo: tx.memo,
    })
    const isReimport = alreadyImportedHashes.has(dedupHash)
    const dupMatch = dupByFitid.get(tx.fitid)

    if (result.isInstallment) parcelasCount++
    if (result.specialKind === 'INVOICE_PAYMENT') invoicePaymentsCount++
    if (result.specialKind && result.specialKind !== 'INVOICE_PAYMENT') encargosCount++
    if (dupMatch || isReimport) possibleDupsCount++

    const suggestedCategoryName = result.categoryId
      ? categoriesById.get(result.categoryId)?.name ?? null
      : null

    // Confidence final pra UI: agrega categorize + extração linha
    const combinedConfidence = result.confidence * tx.lineConfidence

    lines.push({
      index: i,
      fitid: tx.fitid,
      date: txDate.toISOString(),
      rawAmount: tx.amount,
      type: tx.type,
      description: tx.memo,
      baseDescription: result.baseDescription,
      isInstallment: result.isInstallment,
      installmentNumber: result.installmentNumber,
      installmentTotal: result.installmentTotal,
      specialKind: result.specialKind,
      isInternational: result.isInternational || tx.isInternational === true,
      shouldSkipImport: result.shouldSkipImport || isReimport,
      suggestedCategoryId: result.categoryId,
      suggestedCategoryName,
      confidence: combinedConfidence,
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
    pdfSha256,
    detectedBank: extraction.detectedBank,
    scanQuality: extraction.scanQuality,
    declaredTotal: extraction.declaredTotal,
    extractedSum: extraction.extractedSum,
    declaredTxCount: extraction.declaredTxCount,
    detectedCardLast4: extraction.detectedCardLast4,
    confidence: extraction.confidence,
    cacheHit,
    totalLines: lines.length,
    toImport,
    parcelasDetected: parcelasCount,
    invoicePaymentsSkipped: invoicePaymentsCount,
    encargosDetected: encargosCount,
    possibleDups: possibleDupsCount,
    warnings: extraction.warnings,
    lines,
    costCentsUsdX100: extraction.costCentsUsdX100,
    inputTokens: extraction.inputTokens,
    outputTokens: extraction.outputTokens,
  }
}

export function isPdfImportError(err: unknown): err is PdfImportError {
  return err instanceof PdfImportError
}
export function isPdfExtractError(err: unknown): err is PdfExtractError {
  return err instanceof PdfExtractError
}
export function isProfileAccessError(err: unknown): err is ProfileAccessError {
  return err instanceof ProfileAccessError
}
export function isCreditCardError(err: unknown): err is CreditCardError {
  return err instanceof CreditCardError
}
