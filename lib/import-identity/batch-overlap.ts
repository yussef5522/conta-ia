// Sprint Import Idempotente (18/06/2026) — overlap warning estilo QuickBooks.
//
// Antes de processar o upload, avisa o usuário se:
//   (a) ele já importou ESTE arquivo (fileHash idêntico) -> "já importou em DD/MM"
//   (b) o período do arquivo cruza um batch anterior -> "X tx já existem do
//       outro batch (serão puladas no gate)"

import { prisma } from '@/lib/db'

export interface FileMatchWarning {
  type: 'EXACT_FILE_MATCH'
  previousBatch: {
    id: string
    importedAt: Date
    fileName: string
    transactionCount: number
  }
}

export interface PeriodOverlapWarning {
  type: 'PERIOD_OVERLAP'
  overlappingBatches: Array<{
    id: string
    fileName: string
    periodStart: Date | null
    periodEnd: Date | null
    transactionCount: number
  }>
}

export type BatchWarning = FileMatchWarning | PeriodOverlapWarning

/**
 * Procura batches anteriores que indicam re-import do mesmo arquivo
 * ou sobreposição de período.
 *
 * - bankAccountId: conta sendo importada
 * - fileHash: sha256 do conteúdo do arquivo cru (computeFileHash)
 * - periodStart / periodEnd: período coberto pelo arquivo (do header OFX
 *   DTSTART / DTEND ou min/max das tx)
 *
 * Retorna lista de warnings. Vazia = caminho limpo.
 */
export async function findBatchWarnings(
  bankAccountId: string,
  fileHash: string | null,
  periodStart: Date | null,
  periodEnd: Date | null,
): Promise<BatchWarning[]> {
  const warnings: BatchWarning[] = []

  // (a) arquivo exato
  if (fileHash) {
    const same = await prisma.ofxImport.findFirst({
      where: {
        bankAccountId,
        fileHash,
        status: { in: ['SUCCESS', 'PROCESSING'] },
      },
      select: {
        id: true,
        createdAt: true,
        fileName: true,
        totalTransactions: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    if (same) {
      warnings.push({
        type: 'EXACT_FILE_MATCH',
        previousBatch: {
          id: same.id,
          importedAt: same.createdAt,
          fileName: same.fileName,
          transactionCount: same.totalTransactions,
        },
      })
    }
  }

  // (b) overlap de período
  if (periodStart && periodEnd) {
    const overlap = await prisma.ofxImport.findMany({
      where: {
        bankAccountId,
        status: 'SUCCESS',
        // [bs, be] ∩ [ps, pe] != ∅ -> bs <= pe AND be >= ps
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: {
        id: true,
        fileName: true,
        periodStart: true,
        periodEnd: true,
        totalTransactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    if (overlap.length > 0) {
      warnings.push({
        type: 'PERIOD_OVERLAP',
        overlappingBatches: overlap.map((b) => ({
          id: b.id,
          fileName: b.fileName,
          periodStart: b.periodStart,
          periodEnd: b.periodEnd,
          transactionCount: b.totalTransactions,
        })),
      })
    }
  }

  return warnings
}
