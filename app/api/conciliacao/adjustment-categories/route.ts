// Sprint A-effected Fase B.4.1 — GET /api/conciliacao/adjustment-categories
//
// Retorna o status das 4 categorias-template de ajuste pra empresa.
// Pra cada uma: existe? Se sim, qual id. Se não, qual template usar.
//
// Match flexível: já existe se nome (case-insensitive) bater + type bater.
// (Acomoda empresa que já tem "Juros e Multas" mas com nome ligeiramente
// diferente. Match exato por dreGroup desempata.)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { ADJUSTMENT_CATEGORY_TEMPLATES } from '@/lib/conciliacao/adjustment-categories'

const querySchema = z.object({
  empresaId: z.string().cuid(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('category.view')

    const categorias = await prisma.category.findMany({
      where: { companyId: data.empresaId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        dreGroup: true,
        color: true,
      },
    })

    // Pra cada template, descobrir se a empresa já tem uma categoria que
    // bate (nome case-insensitive + type), ou tem mesmo dreGroup
    const status = ADJUSTMENT_CATEGORY_TEMPLATES.map((tpl) => {
      const nomeNormalizado = tpl.name.toLowerCase().trim()
      const matchExato = categorias.find(
        (c) =>
          c.type === tpl.type &&
          c.name.toLowerCase().trim() === nomeNormalizado,
      )
      const matchDreGroup = categorias.find(
        (c) => c.type === tpl.type && c.dreGroup === tpl.dreGroup,
      )
      const existing = matchExato ?? matchDreGroup

      return {
        key: tpl.key,
        template: tpl,
        exists: !!existing,
        existingId: existing?.id ?? null,
        existingName: existing?.name ?? null,
        matchType: matchExato
          ? 'exact_name'
          : matchDreGroup
            ? 'dre_group'
            : null,
      }
    })

    return NextResponse.json({ status })
  } catch (error) {
    return handleApiError(error)
  }
}
