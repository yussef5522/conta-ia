// Sprint A-effected Fase 2-fix — GET /api/conciliacao/ofx-pendentes
//
// Lista OFX EFFECTED da empresa que ainda NÃO foram conciliadas em nenhum
// dos 2 sentidos do link:
//   - reconciledWithId IS NULL (não aponta pra ninguém)
//   - reconciledFrom NONE (nenhuma Excel/Manual aponta PRA ela)
//
// Substitui /api/transacoes na UI de conciliação. Antes, a UI pegava
// /api/transacoes?origin=OFX e filtrava client-side, mas /api/transacoes
// não tem como filtrar reconciledFrom reverso → OFX já-conciliada-mas-com-
// campo-NULL aparecia na lista (caso Lamana).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { getTipoFilter, parseTipoParam } from '@/lib/conciliacao/tipo-filter'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  inicio: z.string().optional(),
  fim: z.string().optional(),
  // Sprint A-effected Fase A — filtro por tipo (apenas-pagamentos|recebimentos|todos)
  tipo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const dateFilter: Record<string, Date> = {}
    if (data.inicio) dateFilter.gte = new Date(data.inicio)
    if (data.fim) dateFilter.lte = new Date(data.fim)

    const tipo = parseTipoParam(data.tipo)
    const tipoFilter = getTipoFilter(tipo)

    const transacoes = await prisma.transaction.findMany({
      where: {
        // Sprint Fundação Status (28/06/2026): FONTE DE VERDADE ÚNICA.
        // Antes este bloco repetia 8+ guards inline. Agora delega pra lib.
        ...NEEDS_REVIEW_WHERE_PRISMA,
        // Filtros específicos da fila /conciliacao (= subset de "pra revisar"
        // só pra OFX/EFFECTED, com guard cashCoded extra):
        origin: 'OFX',
        lifecycle: 'EFFECTED',
        // cashCoded=false: tx categorizada via CRIAR (Sprint A-effected Fase B)
        // sai. Isso NÃO está em NEEDS_REVIEW porque é específico desta fila.
        cashCoded: false,
        bankAccount: { companyId: data.empresaId },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        ...tipoFilter,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        origin: true,
        // Sprint Conciliação-Visual: FITID exibido no footer do card (auditoria/tooltip)
        externalId: true,
        bankAccount: { select: { name: true, bankName: true } },
      },
      orderBy: { date: 'desc' },
      take: data.limit,
    })

    return NextResponse.json({ transacoes })
  } catch (error) {
    return handleApiError(error)
  }
}
