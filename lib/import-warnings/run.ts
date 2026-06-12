// Fase 4 — Orquestrador do detector pós-import.
//
// Chamado APÓS o commit do atomic /v2-confirm (fire-and-forget). Se falha,
// o import já está commitado e safe — apenas logamos a exceção.

import type { PrismaClient } from '@prisma/client'
import { detectDuplicatesPostImport, type NewTxForDetect, type ExistingTxForDetect } from './detect'

const DEFAULT_WINDOW_MINUTES = 5

export interface RunDetectorArgs {
  bankAccountId: string
  companyId: string
  importId?: string
  /** Janela em minutos pra considerar tx "nova" (default 5) */
  windowMinutes?: number
}

export interface RunDetectorResult {
  newTxsScanned: number
  existingCandidates: number
  warningsRecorded: number
}

/**
 * Roda detector + grava warnings. NÃO está dentro do atomic do v2-confirm.
 * Pode falhar sem comprometer o import.
 */
export async function runDetectorPostImport(
  prisma: PrismaClient,
  args: RunDetectorArgs,
): Promise<RunDetectorResult> {
  const windowMs = (args.windowMinutes ?? DEFAULT_WINDOW_MINUTES) * 60_000
  const since = new Date(Date.now() - windowMs)

  // 1. NewTxs: criadas no bankAccount nos últimos N minutos
  const newTxs = await prisma.transaction.findMany({
    where: {
      bankAccountId: args.bankAccountId,
      createdAt: { gte: since },
    },
    select: {
      id: true, bankAccountId: true, amount: true, date: true,
      description: true, type: true, origin: true, createdAt: true,
      reconciledWithId: true,
      reconciledFrom: { select: { id: true } },
    },
  })

  if (newTxs.length === 0) {
    return { newTxsScanned: 0, existingCandidates: 0, warningsRecorded: 0 }
  }

  // 2. Range de datas das newTxs ±2d (cobre janela 1d com folga)
  const minDate = new Date(Math.min(...newTxs.map((t) => t.date.getTime())) - 2 * 86400_000)
  const maxDate = new Date(Math.max(...newTxs.map((t) => t.date.getTime())) + 2 * 86400_000)
  const minCreated = new Date(Math.min(...newTxs.map((t) => t.createdAt.getTime())))

  const existingRaw = await prisma.transaction.findMany({
    where: {
      bankAccountId: args.bankAccountId,
      date: { gte: minDate, lte: maxDate },
      createdAt: { lt: minCreated },  // só tx criadas ANTES das newTxs
    },
    select: {
      id: true, bankAccountId: true, amount: true, date: true,
      description: true, type: true, createdAt: true,
      reconciledWithId: true,
      reconciledFrom: { select: { id: true } },
    },
  })

  // 3. Mapeia pros tipos do detector
  const newTxsForDetect: NewTxForDetect[] = newTxs.map((t) => ({
    id: t.id,
    bankAccountId: t.bankAccountId ?? args.bankAccountId,
    amount: t.amount,
    date: t.date,
    description: t.description,
    type: t.type,
    origin: t.origin,
    createdAt: t.createdAt,
    hasReconciledLink: t.reconciledWithId !== null,
    reconciledFromCount: t.reconciledFrom.length,
  }))
  const existingForDetect: ExistingTxForDetect[] = existingRaw.map((t) => ({
    id: t.id,
    bankAccountId: t.bankAccountId ?? args.bankAccountId,
    amount: t.amount,
    date: t.date,
    description: t.description,
    type: t.type,
    createdAt: t.createdAt,
    hasReconciledLink: t.reconciledWithId !== null,
    reconciledFromCount: t.reconciledFrom.length,
  }))

  // 4. Chama detector PURO
  const warnings = detectDuplicatesPostImport({
    newTxs: newTxsForDetect,
    existingTxs: existingForDetect,
  })

  // 5. Grava warnings (cada um INSERT independente — se algum falhar, outros passam)
  let recorded = 0
  for (const w of warnings) {
    try {
      await prisma.importWarning.create({
        data: {
          companyId: args.companyId,
          bankAccountId: args.bankAccountId,
          importId: args.importId,
          newTxId: w.newTxId,
          suspectedDupId: w.suspectedDupId,
          similarity: w.similarity,
          reason: w.reason,
        },
      })
      recorded += 1
    } catch (err) {
      console.error('[detector] falha ao gravar warning:', err)
    }
  }

  return {
    newTxsScanned: newTxs.length,
    existingCandidates: existingRaw.length,
    warningsRecorded: recorded,
  }
}
