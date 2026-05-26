// Sprint 5.0.2.i — Garante existência das 3 categorias do sistema necessárias
// pra detecção automática de Pix.
//
// Idempotente — pode rodar quantas vezes quiser. Usa nome+dreGroup como chave
// natural (não há unique constraint formal mas evitamos duplicar via findFirst).

import { prisma } from '@/lib/db'

export interface SystemCategoriesResult {
  distribuicaoLucrosId: string
  proLaboreId: string
  transferenciaInternaId: string
}

const COR_DISTRIBUICAO = '#a855f7' // purple
const COR_PROLABORE = '#3b82f6' // blue
const COR_TRANSFERENCIA = '#64748b' // slate

/**
 * Garante que as 3 categorias do sistema existem na empresa.
 * Retorna os IDs (cria se não existir).
 */
export async function ensureSystemCategoriesForPix(
  companyId: string,
): Promise<SystemCategoriesResult> {
  const [distribuicaoLucros, proLabore, transferenciaInterna] = await Promise.all([
    ensureCategory(companyId, {
      name: 'Distribuição de Lucros',
      type: 'EXPENSE',
      dreGroup: 'DISTRIBUICAO_LUCROS',
      color: COR_DISTRIBUICAO,
    }),
    ensureCategory(companyId, {
      name: 'Pró-labore',
      type: 'EXPENSE',
      dreGroup: 'DESPESAS_PESSOAL',
      color: COR_PROLABORE,
    }),
    ensureCategory(companyId, {
      name: 'Transferência entre Contas (grupo)',
      type: 'TRANSFER',
      dreGroup: 'TRANSFERENCIA',
      color: COR_TRANSFERENCIA,
    }),
  ])

  return {
    distribuicaoLucrosId: distribuicaoLucros.id,
    proLaboreId: proLabore.id,
    transferenciaInternaId: transferenciaInterna.id,
  }
}

interface CategoryShape {
  name: string
  type: string
  dreGroup: string
  color: string
}

async function ensureCategory(companyId: string, shape: CategoryShape) {
  const existing = await prisma.category.findFirst({
    where: {
      companyId,
      name: shape.name,
      dreGroup: shape.dreGroup,
    },
  })
  if (existing) return existing

  return prisma.category.create({
    data: {
      companyId,
      name: shape.name,
      type: shape.type,
      dreGroup: shape.dreGroup,
      color: shape.color,
      icon: null,
      isActive: true,
    },
  })
}

/**
 * Resolve categoryId pra cada tipo de detecção Pix.
 */
export function resolveSystemCategoryId(
  dreGroupSugerido: string,
  categories: SystemCategoriesResult,
): string {
  switch (dreGroupSugerido) {
    case 'DISTRIBUICAO_LUCROS':
      return categories.distribuicaoLucrosId
    case 'PRO_LABORE':
    case 'DESPESAS_PESSOAL':
      return categories.proLaboreId
    case 'TRANSFERENCIA':
      return categories.transferenciaInternaId
    default:
      return categories.transferenciaInternaId // safe fallback
  }
}
