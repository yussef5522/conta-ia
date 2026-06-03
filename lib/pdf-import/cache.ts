// Sprint PF Fatia 3.5 — Cache SHA256 do PDF.
//
// Cache GLOBAL: hash bate → mesmo resultado pra qualquer user.
// MAS owner é registrado (user que cacheou primeiro) — só ele pode deletar.
//
// TTL 7 dias. Expiração por job futuro OU lazy (read miss + delete).

import { prisma } from '@/lib/db'
import type { PdfExtractResult } from './types'
import { sanitizeForCache } from './extract-from-pdf'

const TTL_DAYS = 7

export async function getCachedExtraction(
  pdfSha256: string,
): Promise<PdfExtractResult | null> {
  const cached = await prisma.personalPdfExtractCache.findUnique({
    where: { pdfSha256 },
  })
  if (!cached) return null
  // Verifica expiração lazy
  if (cached.expiresAt < new Date()) {
    // Soft-clean (best-effort; ignora erro)
    prisma.personalPdfExtractCache
      .delete({ where: { id: cached.id } })
      .catch(() => {})
    return null
  }
  // Incrementa hitCount
  prisma.personalPdfExtractCache
    .update({ where: { id: cached.id }, data: { hitCount: { increment: 1 } } })
    .catch(() => {})
  try {
    return JSON.parse(cached.resultJson) as PdfExtractResult
  } catch {
    return null
  }
}

export interface CacheInput {
  pdfSha256: string
  ownerUserId: string
  result: PdfExtractResult
}

export async function saveCachedExtraction(input: CacheInput): Promise<void> {
  const sanitized = sanitizeForCache(input.result)
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000)
  await prisma.personalPdfExtractCache.upsert({
    where: { pdfSha256: input.pdfSha256 },
    create: {
      pdfSha256: input.pdfSha256,
      modelVersion: sanitized.modelVersion,
      resultJson: JSON.stringify(sanitized),
      inputTokens: sanitized.inputTokens,
      outputTokens: sanitized.outputTokens,
      costCentsUsdX100: sanitized.costCentsUsdX100,
      ownerUserId: input.ownerUserId,
      expiresAt,
    },
    update: {
      // Refresh TTL no upsert
      expiresAt,
      hitCount: { increment: 1 },
    },
  })
}

/**
 * Deleta cache por SHA256 — só permite se o user é o owner.
 * Retorna true se deletou, false se cache não existe ou não é dono.
 */
export async function deleteCachedExtraction(
  pdfSha256: string,
  userId: string,
): Promise<boolean> {
  const cached = await prisma.personalPdfExtractCache.findUnique({
    where: { pdfSha256 },
  })
  if (!cached) return false
  if (cached.ownerUserId !== userId) return false
  await prisma.personalPdfExtractCache.delete({ where: { id: cached.id } })
  return true
}

/**
 * Lista caches do user (LGPD — user vê o que está armazenado em seu nome).
 */
export async function listOwnerCaches(userId: string) {
  return prisma.personalPdfExtractCache.findMany({
    where: { ownerUserId: userId },
    select: {
      id: true,
      pdfSha256: true,
      modelVersion: true,
      inputTokens: true,
      outputTokens: true,
      costCentsUsdX100: true,
      hitCount: true,
      cachedAt: true,
      expiresAt: true,
    },
    orderBy: { cachedAt: 'desc' },
  })
}
