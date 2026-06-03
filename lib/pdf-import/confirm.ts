// Sprint PF Fatia 3.5 — Confirm import PDF.
//
// Diferente do confirm OFX (re-parsea raw content) — PDF lê do cache
// SHA256 e cria PersonalTransactions com base nas decisions.

import { prisma } from '@/lib/db'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { getCardInProfile, CreditCardError } from '@/lib/credit-card/queries'
import { calculateInvoiceReference } from '@/lib/credit-card/calculate-invoice-reference'
import { dedupHashOFX } from '@/lib/ofx/dedup'
import { getCachedExtraction } from './cache'
import { detectInstallment } from '@/lib/ofx-card/detect-installment'
import { detectSpecialTx } from '@/lib/ofx-card/detect-special-tx'

export interface PdfConfirmDecision {
  fitid: string
  skip: boolean
  categoryId: string | null
}

export interface PdfConfirmInput {
  userId: string
  profileId: string
  importId: string
  decisions: PdfConfirmDecision[]
}

export interface PdfConfirmResult {
  importId: string
  imported: number
  skipped: number
  invoicesUpdated: number
}

export class PdfConfirmError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'PdfConfirmError'
  }
}

export async function confirmPdfImport(
  input: PdfConfirmInput,
): Promise<PdfConfirmResult> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const importRec = await prisma.personalOfxImport.findUnique({
    where: { id: input.importId },
  })
  if (!importRec || importRec.profileId !== input.profileId) {
    throw new PdfConfirmError('Import não encontrado', 'IMPORT_NOT_FOUND')
  }
  if (importRec.sourceType !== 'PDF') {
    throw new PdfConfirmError('Import não é PDF', 'WRONG_SOURCE')
  }
  if (importRec.status !== 'PROCESSING') {
    throw new PdfConfirmError(`Import já foi ${importRec.status}`, 'INVALID_STATUS')
  }
  if (!importRec.pdfSha256) {
    throw new PdfConfirmError('Import sem hash do PDF', 'NO_HASH')
  }
  if (!importRec.creditCardId) {
    throw new PdfConfirmError('Import sem cartão', 'NO_CARD')
  }
  const card = await getCardInProfile(input.profileId, importRec.creditCardId)
  const extraction = await getCachedExtraction(importRec.pdfSha256)
  if (!extraction) {
    throw new PdfConfirmError(
      'Cache da extração PDF expirou. Faça upload novamente.',
      'CACHE_EXPIRED',
    )
  }

  const decisionMap = new Map(input.decisions.map((d) => [d.fitid, d]))

  // Valida categoryIds das decisões
  const decisionCatIds = new Set(
    input.decisions
      .map((d) => d.categoryId)
      .filter((id): id is string => !!id),
  )
  if (decisionCatIds.size > 0) {
    const valid = await prisma.personalCategory.findMany({
      where: { id: { in: [...decisionCatIds] }, profileId: input.profileId },
      select: { id: true },
    })
    if (valid.length !== decisionCatIds.size) {
      throw new PdfConfirmError(
        'Uma ou mais categorias não pertencem a este perfil',
        'INVALID_CATEGORY',
      )
    }
  }

  let imported = 0
  let skipped = 0
  const invoiceIdsUpdated = new Set<string>()

  await prisma.$transaction(async (tx) => {
    for (const ext of extraction.transactions) {
      const decision = decisionMap.get(ext.fitid)
      if (!decision || decision.skip) {
        skipped++
        continue
      }
      const txDate = new Date(ext.date)
      if (!Number.isFinite(txDate.getTime())) {
        skipped++
        continue
      }
      const inst = detectInstallment(ext.memo)
      const special = detectSpecialTx(ext.memo, ext.type)

      const invRef = calculateInvoiceReference(txDate, {
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

      const dedupHash = dedupHashOFX({
        fitid: ext.fitid,
        datePosted: txDate,
        amount: ext.amount,
        type: ext.type,
        memo: ext.memo,
      })

      try {
        await tx.personalTransaction.create({
          data: {
            profileId: input.profileId,
            categoryId: decision.categoryId ?? null,
            date: txDate,
            description: ext.memo,
            amount: ext.amount,
            type: ext.type,
            status: 'RECONCILED',
            origin: 'OFX', // tratamos PDF como OFX no enum existente
            externalId: ext.fitid,
            dedupHash,
            creditCardId: card.id,
            creditCardInvoiceId: invoice.id,
            installmentNumber: inst.installmentNumber ?? null,
            installmentTotal: inst.installmentTotal ?? null,
            installmentGroupId: null,
            isInternational: special.isInternational || ext.isInternational === true,
            internationalCurrency: ext.originalCurrency ?? null,
            ofxImportId: input.importId,
            classifiedBy: decision.categoryId ? 'PDF_AI' : null,
          },
        })
        if (ext.type === 'DEBIT') {
          await tx.creditCardInvoice.update({
            where: { id: invoice.id },
            data: { totalAmount: { increment: ext.amount } },
          })
        }
        invoiceIdsUpdated.add(invoice.id)
        imported++
      } catch {
        skipped++
      }
    }

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

export function isPdfConfirmError(err: unknown): err is PdfConfirmError {
  return err instanceof PdfConfirmError
}
