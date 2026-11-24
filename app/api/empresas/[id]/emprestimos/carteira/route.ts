// ⭐⭐⭐ EMPRÉSTIMOS v1 (25/11/2026) — GET da CARTEIRA: dívida, custo do dinheiro (contratos +
// cheque especial), compromisso mês a mês, montanha, pódio e cards — numa leitura em lote.
// Lei: docs/emprestimos-referencia.html (R56–R64). Só leitura.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { lerCarteiraDeEmprestimos } from '@/lib/loans/carteira'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')
    return NextResponse.json(await lerCarteiraDeEmprestimos(empresaId, new Date(), prisma))
  } catch (error) {
    return handleApiError(error)
  }
}
