// Sprint TransferSuggestionEvent (13/08) — GET sugestões IGNORADAS (pra "voltar
// atrás"). Read-only. Junta os detalhes das tx pra exibir (data/valor/descrição).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { listIgnored } from '@/lib/transfers/suggestion-events'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const eventos = await listIgnored(prisma, companyId)
    const txIds = [...new Set(eventos.flatMap((e) => [e.debitTxId, e.creditTxId]))]
    const txs = await prisma.transaction.findMany({
      where: { id: { in: txIds } },
      select: { id: true, date: true, amount: true, type: true, description: true, bankAccount: { select: { name: true } } },
    })
    const byId = new Map(txs.map((t) => [t.id, t]))
    const view = (id: string) => {
      const t = byId.get(id)
      return t ? { date: t.date.toISOString().slice(0, 10), amount: t.amount, type: t.type, description: t.description, account: t.bankAccount?.name ?? null } : null
    }
    return NextResponse.json({
      itens: eventos.map((e) => ({
        id: e.id,
        layer: e.layer,
        confidence: e.confidence,
        evidences: e.evidences ? JSON.parse(e.evidences) : [],
        ignoradoEm: e.resolvedAt?.toISOString() ?? null,
        debito: view(e.debitTxId),
        credito: view(e.creditTxId),
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
