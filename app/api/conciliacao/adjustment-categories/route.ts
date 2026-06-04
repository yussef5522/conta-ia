// Sprint A-effected Fase B.4.1 — GET /api/conciliacao/adjustment-categories
//
// Retorna o status das 4 categorias-template de ajuste pra empresa.
// Pra cada uma: existe? Se sim, qual id. Se não, qual template usar.
//
// Match RIGOROSO (smoke B.4.1 mostrou que match por dreGroup era frouxo
// demais — pegava "Taxa Cartão" como Juros): SÓ nome exato
// (case-insensitive) + mesmo type. Sem match → cria nova categoria.

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

    // Match RIGOROSO: nome exato (case-insensitive) + mesmo type.
    // Sem match → cria nova. Evita confundir "Taxa Cartão" com "Juros".
    const status = ADJUSTMENT_CATEGORY_TEMPLATES.map((tpl) => {
      const nomeNormalizado = tpl.name.toLowerCase().trim()
      const existing = categorias.find(
        (c) =>
          c.type === tpl.type &&
          c.name.toLowerCase().trim() === nomeNormalizado,
      )

      return {
        key: tpl.key,
        template: tpl,
        exists: !!existing,
        existingId: existing?.id ?? null,
        existingName: existing?.name ?? null,
        matchType: existing ? 'exact_name' : null,
      }
    })

    return NextResponse.json({ status })
  } catch (error) {
    return handleApiError(error)
  }
}
