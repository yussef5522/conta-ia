// A ação de `finalizar` na janela da cozinha. O PIN volta em toda ação: o servidor resolve
// QUEM é, nunca aceita um `colaboradorId` da tela (senão o PIN não protegeria nada).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { finalizarTarefa, minhasTarefasDeHoje, TarefaError } from '@/lib/stock/producao/minhas-tarefas'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ pin: z.string().regex(/^\d{4}$/), etapaId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, ['stock.executar', 'stock.operate'])
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  const quem = await quemEstaComOPin(companyId, parsed.data.pin, prisma)
  if (!quem) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  try {
    await finalizarTarefa({ companyId, etapaId: parsed.data.etapaId, colaboradorId: quem.colaboradorId }, prisma)
  } catch (e) {
    // ⚠️ a mensagem vai INTEIRA pra tela: "outra pessoa já está nessa tarefa" ensina o que
    // fazer; "erro ao iniciar" manda perguntar pro encarregado.
    if (e instanceof TarefaError) return NextResponse.json({ erro: e.message }, { status: 409 })
    throw e
  }
  return NextResponse.json({
    colaborador: { id: quem.colaboradorId, nome: quem.nome },
    tarefas: await minhasTarefasDeHoje(companyId, quem.colaboradorId, new Date(), prisma),
  })
}
