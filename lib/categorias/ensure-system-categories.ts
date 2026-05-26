// Sprint 5.0.2.i + 5.0.2.l — Garante existência das categorias do sistema.
//
// 2 funções:
//   - ensureSystemCategoriesForPix (Sprint i, 3 categorias) → Pix detection
//   - ensureAllSystemCategories (Sprint l, ~35 categorias) → Pix + padrões
//     universais BR (DAS, INSS, Celesc, Stone, Uber, etc)
//
// Idempotente — pode rodar quantas vezes quiser. Usa nome+dreGroup como chave
// natural (não há unique constraint formal mas evitamos duplicar via findFirst).

import { prisma } from '@/lib/db'
import { UNIVERSAL_PATTERN_CATEGORIES } from '@/lib/categorization/universal-patterns-br'

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
      isSystemDefault: true,
    },
  })
}

// Sprint 5.0.2.l — Garante TODAS as categorias do sistema usadas por:
//   1. Pix detection (3 categorias, Sprint i)
//   2. Padrões universais BR (~35, derivadas de UNIVERSAL_PATTERN_CATEGORIES)
//
// Idempotente: reusa categorias existentes (match por name+dreGroup) e cria
// só as faltantes. Retorna mapa { name → categoryId } pra resolução rápida.
//
// Cores: paleta padrão por dreGroup pra UX consistente.

const COR_RECEITA = '#10b981' // emerald
const COR_DEDUCAO = '#f97316' // orange
const COR_DESPESA_OPERACIONAL = '#ef4444' // red
const COR_DESPESA_FINANCEIRA = '#eab308' // yellow
const COR_DESPESA_PESSOAL = '#0ea5e9' // sky
const COR_DESPESA_ADMIN = '#6366f1' // indigo
const COR_IMPOSTO = '#dc2626' // red-600
const COR_OUTRAS = '#94a3b8' // slate-400

function colorForDreGroup(dreGroup: string): string {
  switch (dreGroup) {
    case 'RECEITA_BRUTA':
    case 'RECEITAS_FINANCEIRAS':
      return COR_RECEITA
    case 'OUTRAS_RECEITAS':
    case 'OUTRAS_DESPESAS':
      return COR_OUTRAS
    case 'DEDUCOES':
      return COR_DEDUCAO
    case 'DESPESAS_PESSOAL':
      return COR_DESPESA_PESSOAL
    case 'DESPESAS_FINANCEIRAS':
      return COR_DESPESA_FINANCEIRA
    case 'DESPESAS_ADMINISTRATIVAS':
    case 'DESPESAS_COMERCIAIS':
      return COR_DESPESA_ADMIN
    case 'CUSTO_PRODUTO_VENDIDO':
      return COR_DESPESA_OPERACIONAL
    case 'IMPOSTOS_SOBRE_LUCRO':
      return COR_IMPOSTO
    default:
      return COR_OUTRAS
  }
}

function categoryTypeForDreGroup(dreGroup: string, txType: string): string {
  // Schema usa enum INCOME | EXPENSE | TRANSFER
  if (txType === 'INCOME') return 'INCOME'
  if (txType === 'TRANSFER') return 'TRANSFER'
  return 'EXPENSE'
}

export interface AllSystemCategoriesResult extends SystemCategoriesResult {
  /** Map de nome (normalizado lower+trim) → categoryId pra lookup rápido */
  byName: Map<string, string>
  /** Map de dreGroup → array de ids (fallback quando nome não casa) */
  byDreGroup: Map<string, string[]>
  /** Snapshot resumido pra resolveUniversalCategoryId (compatível) */
  list: Array<{ id: string; name: string; dreGroup: string | null; isActive: boolean }>
}

export async function ensureAllSystemCategories(
  companyId: string,
): Promise<AllSystemCategoriesResult> {
  // 1. Garante as 3 categorias do Pix (Sprint i)
  const pix = await ensureSystemCategoriesForPix(companyId)

  // 2. Garante as ~35 categorias dos padrões universais (Sprint l)
  //    Loop sequencial pra evitar race nas tx criadas dentro do mesmo companyId.
  for (const cat of UNIVERSAL_PATTERN_CATEGORIES) {
    await ensureCategory(companyId, {
      name: cat.name,
      type: categoryTypeForDreGroup(cat.dreGroup, cat.txType),
      dreGroup: cat.dreGroup,
      color: colorForDreGroup(cat.dreGroup),
    })
  }

  // 3. Carrega todas as categorias do plano + indexa
  const all = await prisma.category.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, dreGroup: true, isActive: true },
  })
  const byName = new Map<string, string>()
  const byDreGroup = new Map<string, string[]>()
  for (const c of all) {
    byName.set(c.name.toLowerCase().trim(), c.id)
    if (c.dreGroup) {
      const list = byDreGroup.get(c.dreGroup) ?? []
      list.push(c.id)
      byDreGroup.set(c.dreGroup, list)
    }
  }

  return {
    ...pix,
    byName,
    byDreGroup,
    list: all,
  }
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
