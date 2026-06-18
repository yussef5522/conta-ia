// POST /api/empresas/[id]/emprestimos/extrair-contrato (multipart com PDF)
//
// Faz a extração via Claude e retorna o JSON pra pré-preencher o form.
// NÃO cria nada — usuário revisa e salva depois via POST /emprestimos.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { extractContract, ContractExtractError } from '@/lib/loans/contract-extract'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.create')

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ erro: 'Arquivo PDF obrigatório' }, { status: 400 })
    }
    const bytes = new Uint8Array(await file.arrayBuffer())

    const result = await extractContract(bytes)
    return NextResponse.json({ extraction: result })
  } catch (e) {
    if (e instanceof ContractExtractError) {
      return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
    }
    return handleApiError(e)
  }
}
