/**
 * ⭐ A ROTA DO MONTADOR (07/10/2026) — a bancada de simulação.
 *
 * ⛔⛔ **GET SÓ LÊ.** Nenhum seed acontece aqui: semear canais ou regras num caminho de leitura
 * é escrita em GET, e a casa decidiu em 08/09 que *"o GET não grava nada"* — abrir a tela não
 * pode ter configurado o cardápio. Quem semeia é o gesto do dono, no POST da config.
 *
 * ⚠️ `transaction.view` e não `stock.view`: a bancada mostra **custo, preço e sobra por canal**
 * — é dinheiro, não operação de estoque (a fronteira de papel de 24/08).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { lerMontador } from '@/lib/margem/leitura-montador'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')
    return NextResponse.json(await lerMontador(companyId))
  } catch (e) {
    return handleApiError(e)
  }
}
