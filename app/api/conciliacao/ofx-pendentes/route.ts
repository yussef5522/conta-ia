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
        origin: 'OFX',
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        reconciledFrom: { none: {} }, // crítico: sem reverso
        isInternalTransfer: false,
        // Sprint A-effected Fase B — exclui ações terminais:
        ignoredAt: null, // não ignorada manualmente
        cashCoded: false, // não categorizada via CRIAR
        // Sprint Sync-Pendentes-Conciliacao: OFX já categorizada (via Pendentes
        // em lote, regra IA no import, etc) sai da Conciliação. Padrão Xero/
        // QuickBooks: tx do extrato resolvida UMA vez. Reversível: descategorizar
        // faz voltar. Não esconde pendente pura (categoryId NULL continua).
        categoryId: null,
        // Sprint Fix A2 (08/06/2026): transferência entre contas próprias já
        // pareada (transferGroupId NOT NULL ou type='TRANSFER') NÃO entra na
        // Conciliação. Não é despesa nem receita — só dinheiro mudando de conta.
        // Mesma lógica do Fix A em /api/transacoes?semCategoria=true.
        transferGroupId: null,
        type: { not: 'TRANSFER' },
        // Sprint Cartao PJ R6.1 (25/06/2026): pagamento de cartao casado
        // (isCardPayment=true + cartao vinculado) eh TRANSFERENCIA logica
        // banco->cartao — ja resolvido via casamento, NAO precisa categoria.
        // Yussef desfaz pelo header verde do dashboard do cartao se quiser.
        isCardPayment: false,
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
