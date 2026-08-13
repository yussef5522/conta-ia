// Sprint TransferSuggestionEvent (13/08) — POST reverter um IGNORED → o par volta
// a poder ser sugerido (não é porta sem volta). Apaga o evento IGNORED.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { revertIgnored } from '@/lib/transfers/suggestion-events'

interface Params { params: Promise<{ id: string; eventId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, eventId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')
    const ok = await revertIgnored(prisma, companyId, eventId)
    if (!ok) return NextResponse.json({ erro: 'Sugestão ignorada não encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
