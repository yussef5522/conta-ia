/**
 * ⭐⭐⭐ A ROTA DA MESA DE OPERAÇÕES (15/10/2026) — SÓ LEITURA, e isso é estrutural.
 *
 * ⛔⛔⛔ **ZERO ESCRITA: esta rota não tem POST, PATCH nem DELETE.** Dashboard que escreve é
 * dashboard que muda o dado só por ser aberto — e aqui a ordem do dono foi explícita (*"ZERO
 * escrita em tudo — o dashboard só lê"*). A ausência do handler é a trava: não há caminho de
 * gravação pra alguém esquecer de proteger.
 *
 * ⚠️ `transaction.view` é a chave certa: a mesa mostra **saldo, contas a pagar e o placar da
 * casa**. Quem só opera estoque não vê este painel — a mesma fronteira de papel que tira o
 * financeiro do menu do operador (30/08).
 *
 * ⭐ E o RELÓGIO entra aqui, uma vez: `new Date()` é desta rota, e o orquestrador resolve o dia
 * do BRASIL a partir dele. ⛔ Nenhuma lib da mesa olha relógio — senão, na virada do dia, elas
 * discordariam entre si sobre que dia é hoje.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { lerMesaDeOperacoes } from '@/lib/balance/mesa-de-operacoes'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const mesa = await lerMesaDeOperacoes(empresaId, new Date())
    return NextResponse.json(mesa)
  } catch (e) {
    return handleApiError(e)
  }
}
