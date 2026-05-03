// Router de templates de plano de contas profissional.
// Cada companyType roteia para um template específico (Fase B Plano de Contas).
//
// Mapping:
//   service     → academia (template padrão pra serviços)
//   restaurant  → restaurante
//   clinica     → clinica (companyType novo)
//   salao       → salao   (companyType novo)
//   retail      → loja
//   industry, mixed, other → academia (fallback genérico de serviços)

import type { Prisma, PrismaClient } from '@prisma/client'
import { regimesToJson } from '@/lib/categories/regimes'
import { academiaTemplate } from '@/lib/categories/templates/academia'
import { restauranteTemplate } from '@/lib/categories/templates/restaurante'
import { clinicaTemplate } from '@/lib/categories/templates/clinica'
import { salaoTemplate } from '@/lib/categories/templates/salao'
import { lojaTemplate } from '@/lib/categories/templates/loja'
import type { CategoryTemplateNode } from '@/lib/categories/templates/_common'

// Compat: shape antigo usado por chamadores legados de `getDefaultCategories`.
// Hoje só o seed do dev usa essa shape — produção e o POST de empresa passam
// pelo aplicarTemplate (que entende hierarquia).
export interface DefaultCategory {
  name: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  color: string
  icon?: string
}

export function getTemplate(companyType: string | null | undefined): CategoryTemplateNode[] {
  // Normaliza pra lowercase: empresas históricas têm type em UPPERCASE
  // (RESTAURANT, SERVICE) — sem normalizar caem no fallback.
  const t = (companyType ?? '').toLowerCase().trim()
  switch (t) {
    case 'restaurant':
      return restauranteTemplate
    case 'clinica':
      return clinicaTemplate
    case 'salao':
      return salaoTemplate
    case 'retail':
      return lojaTemplate
    case 'service':
    case 'industry':
    case 'mixed':
    case 'other':
    default:
      return academiaTemplate
  }
}

// Compat shim: retorna lista achatada no shape antigo.
// Usado pelo seed (`prisma/seed.ts`). NOVO callers devem usar aplicarTemplate.
export function getDefaultCategories(companyType: string): DefaultCategory[] {
  return getTemplate(companyType).map((node) => ({
    name: node.name,
    type: node.type,
    color: node.color,
    icon: node.icon ?? undefined,
  }))
}

// Aplica o template completo (com hierarquia) numa empresa recém-criada.
// Resolve parentId em runtime (template usa parentCode → mapeia pra ID criado).
// Insere em ordem topológica: raízes primeiro, depois nível 2, depois nível 3.
export async function aplicarTemplate(
  tx: Prisma.TransactionClient | PrismaClient,
  companyId: string,
  companyType: string,
): Promise<{ inseridas: number }> {
  const template = getTemplate(companyType)

  // Ordena por profundidade (parents antes dos filhos) e depois por order.
  const profundidade = (code: string) => code.split('.').length
  const ordenado = [...template].sort((a, b) => {
    const dA = profundidade(a.code)
    const dB = profundidade(b.code)
    if (dA !== dB) return dA - dB
    return a.order - b.order
  })

  const codeToId = new Map<string, string>()
  let inseridas = 0

  for (const node of ordenado) {
    // Idempotência: pula se já existe categoria com mesmo (companyId, parentId, name).
    const parentId = node.parentCode ? codeToId.get(node.parentCode) ?? null : null
    const existente = await tx.category.findFirst({
      where: { companyId, parentId, name: node.name },
      select: { id: true },
    })
    if (existente) {
      codeToId.set(node.code, existente.id)
      continue
    }

    const cat = await tx.category.create({
      data: {
        companyId,
        name: node.name,
        type: node.type,
        color: node.color,
        icon: node.icon ?? null,
        parentId,
        dreGroup: node.dreGroup,
        code: node.code,
        description: node.description,
        isSystemDefault: node.isSystemDefault ?? true,
        isActive: node.isActive ?? true,
        order: node.order,
        visibleInRegimes: regimesToJson(node.visibleInRegimes),
      },
      select: { id: true },
    })
    codeToId.set(node.code, cat.id)
    inseridas++
  }

  return { inseridas }
}
