// VENDAS — GET detalhe de UM dia (ou bloco de fim de semana): os lançamentos que
// compõem cada meio. Só leitura; o rastro já existe em venda_diaria_transacao.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { getDetalheDia } from '@/lib/vendas/detalhe-dia'

interface Params { params: Promise<{ id: string }> }
const DIA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view') // é dado de extrato — mesma chave das transações

    const sp = request.nextUrl.searchParams
    const de = sp.get('de') ?? ''
    const ate = sp.get('ate') || de
    if (!DIA.test(de) || !DIA.test(ate)) {
      return NextResponse.json({ erro: 'Informe ?de=YYYY-MM-DD (e ?ate= pro bloco de fim de semana).' }, { status: 400 })
    }
    return NextResponse.json({ detalhe: await getDetalheDia({ companyId, de, ate }, prisma) })
  } catch (error) {
    return handleApiError(error)
  }
}
