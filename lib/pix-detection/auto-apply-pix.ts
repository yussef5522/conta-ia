// Sprint 5.0.2.i — Camada 0 do pipeline: aplica detecção de Pix relacionado
// ANTES do Claude AI / regras / keywords.
//
// Quando detecta:
//   - Pix p/ CPF sócio → SOCIO_PF + categoria Distribuição/Pró-labore + RECONCILED
//   - Pix entre CNPJs grupo → GRUPO_PJ + categoria Transferência + RECONCILED
//
// Retorna { applied: boolean, ... } pra caller decidir se segue pro próximo nível.

import { prisma } from '@/lib/db'
import {
  detectPixRelacionado,
  type PixDetection,
} from './detect-pix-relacionado'
import {
  ensureSystemCategoriesForPix,
  resolveSystemCategoryId,
  type SystemCategoriesResult,
} from '@/lib/categorias/ensure-system-categories'

export interface AutoApplyPixResult {
  applied: boolean
  transactionId?: string
  relatedPartyType?: 'SOCIO_PF' | 'GRUPO_PJ'
  relatedPartyId?: string
  categoryId?: string
  detection: PixDetection
}

/**
 * Aplica detecção Pix numa transação existente já persistida (loader DB completo).
 * Update direto no banco se tipo SOCIO_PF ou GRUPO_PJ.
 */
export async function autoApplyPixForTransaction(
  companyId: string,
  transactionId: string,
  description: string | null,
  systemCategories?: SystemCategoriesResult,
): Promise<AutoApplyPixResult> {
  const [socios, empresas] = await Promise.all([
    prisma.socioPF.findMany({ where: { companyId } }),
    prisma.empresaRelacionada.findMany({ where: { companyId } }),
  ])

  const detection = detectPixRelacionado({
    description,
    socios: socios.map((s) => ({
      id: s.id,
      nome: s.nome,
      cpf: s.cpf,
      pixKeys: parsePixKeysArray(s.pixKeys),
      papel: s.papel,
    })),
    empresasRelacionadas: empresas.map((e) => ({
      id: e.id,
      nomeFantasia: e.nomeFantasia,
      cnpjRelacionado: e.cnpjRelacionado,
      pixKeys: parsePixKeysArray(e.pixKeys),
      relacao: e.relacao,
    })),
  })

  if (!detection.tipo || !detection.destinatarioId) {
    return { applied: false, detection }
  }

  const categories = systemCategories ?? (await ensureSystemCategoriesForPix(companyId))
  const categoryId = resolveSystemCategoryId(
    detection.dreGroupSugerido ?? 'TRANSFERENCIA',
    categories,
  )

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      categoryId,
      status: 'RECONCILED',
      classificationSource: 'AI', // marca como auto-classificada (Pix detection)
      aiConfidence: 1.0,
      relatedPartyType: detection.tipo,
      relatedPartyId: detection.destinatarioId,
    },
  })

  return {
    applied: true,
    transactionId,
    relatedPartyType: detection.tipo,
    relatedPartyId: detection.destinatarioId,
    categoryId,
    detection,
  }
}

/**
 * Versão batch — recebe array de tx + cadastros pre-carregados.
 * Função PURA pra uso no IMPORT OFX (autoClassifyTransactions estende).
 */
export function detectAndPlanPixApply(
  tx: { id?: string; description: string | null; dedupHash?: string | null },
  socios: Parameters<typeof detectPixRelacionado>[0]['socios'],
  empresasRelacionadas: Parameters<typeof detectPixRelacionado>[0]['empresasRelacionadas'],
  systemCategories: SystemCategoriesResult,
): {
  detection: PixDetection
  apply: boolean
  patch?: {
    categoryId: string
    status: string
    classificationSource: string
    aiConfidence: number
    relatedPartyType: 'SOCIO_PF' | 'GRUPO_PJ'
    relatedPartyId: string
  }
} {
  const detection = detectPixRelacionado({
    description: tx.description,
    socios,
    empresasRelacionadas,
  })

  if (!detection.tipo || !detection.destinatarioId) {
    return { detection, apply: false }
  }

  const categoryId = resolveSystemCategoryId(
    detection.dreGroupSugerido ?? 'TRANSFERENCIA',
    systemCategories,
  )

  return {
    detection,
    apply: true,
    patch: {
      categoryId,
      status: 'RECONCILED',
      classificationSource: 'AI',
      aiConfidence: 1.0,
      relatedPartyType: detection.tipo,
      relatedPartyId: detection.destinatarioId,
    },
  }
}

function parsePixKeysArray(stored: string): string[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}
