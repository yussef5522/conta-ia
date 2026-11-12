// ⭐ CANCELAR TAREFA — pelo escritório, como nas ordens (lei v7 M2). ⛔ Nunca apaga.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { cancelarTarefa, TarefaTipoError } from '@/lib/stock/producao/tarefa'

interface Params { params: Promise<{ id: string; tarefaId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, tarefaId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  try {
    await cancelarTarefa({ companyId, tarefaId, userId: a.user.sub }, prisma)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TarefaTipoError) return NextResponse.json({ erro: e.message }, { status: 409 })
    console.error('[producao/tarefas/cancelar] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui cancelar agora. Nada foi gravado — dá pra tentar de novo.' }, { status: 500 })
  }
}
