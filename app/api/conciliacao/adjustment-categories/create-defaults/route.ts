// Sprint A-effected Fase B.4.1 — POST /api/conciliacao/adjustment-categories/create-defaults
//
// Cria as 4 categorias-template de ajuste que ainda NÃO existem na empresa.
// Idempotente: chama várias vezes só cria as que faltam (skipa as que já
// têm match — exato OU por dreGroup).
//
// Body:
//   - empresaId
//   - keys?: string[] (opcional — se omitido, cria todas as 4)
//
// Retorna lista com { key, status: 'created' | 'already_exists', id }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  ADJUSTMENT_CATEGORY_TEMPLATES,
  type AdjustmentCategoryKey,
} from '@/lib/conciliacao/adjustment-categories'
import { logAudit } from '@/lib/audit'

const bodySchema = z.object({
  empresaId: z.string().cuid(),
  keys: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bodySchema.parse(body)

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('category.create')

    const wantedKeys = data.keys && data.keys.length > 0
      ? new Set(data.keys as AdjustmentCategoryKey[])
      : new Set(ADJUSTMENT_CATEGORY_TEMPLATES.map((t) => t.key))

    const categoriasExistentes = await prisma.category.findMany({
      where: { companyId: data.empresaId, isActive: true },
      select: { id: true, name: true, type: true, dreGroup: true },
    })

    const result: Array<{
      key: string
      status: 'created' | 'already_exists'
      id: string
      name: string
    }> = []

    await prisma.$transaction(async (trx) => {
      for (const tpl of ADJUSTMENT_CATEGORY_TEMPLATES) {
        if (!wantedKeys.has(tpl.key)) continue

        // Já existe? Match por nome ou dreGroup
        const nomeNormalizado = tpl.name.toLowerCase().trim()
        const existing = categoriasExistentes.find(
          (c) =>
            (c.type === tpl.type &&
              c.name.toLowerCase().trim() === nomeNormalizado) ||
            (c.type === tpl.type && c.dreGroup === tpl.dreGroup),
        )

        if (existing) {
          result.push({
            key: tpl.key,
            status: 'already_exists',
            id: existing.id,
            name: existing.name,
          })
          continue
        }

        const created = await trx.category.create({
          data: {
            companyId: data.empresaId,
            name: tpl.name,
            type: tpl.type,
            dreGroup: tpl.dreGroup,
            color: tpl.color,
            icon: tpl.icon,
            description: tpl.description,
            isActive: true,
          },
        })

        await logAudit(
          ctx,
          {
            action: 'CREATE',
            entityType: 'Category',
            entityId: created.id,
            metadata: {
              source: 'adjustment-categories-defaults',
              key: tpl.key,
              name: tpl.name,
              type: tpl.type,
              dreGroup: tpl.dreGroup,
            },
          },
          trx,
        )

        result.push({
          key: tpl.key,
          status: 'created',
          id: created.id,
          name: created.name,
        })
      }
    })

    return NextResponse.json({ result })
  } catch (error) {
    return handleApiError(error)
  }
}
