// ⭐⭐ O TIQUE DO GRUPO DE ROTINA (R26, 13/11/2026). Como toda ação da Janela: o PIN volta no corpo e
// o SERVIDOR resolve quem é — nunca aceita `colaboradorId` da tela. ⛔ Sem PIN válido, nada grava.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { minhasTarefasDeHoje } from '@/lib/stock/producao/minhas-tarefas'
import { ticarItem, RotinaError } from '@/lib/stock/producao/rotinas-do-banco'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ pin: z.string().regex(/^\d{4}$/), etapaId: z.string().min(1), itemId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, ['stock.executar', 'stock.operate'])
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  const quem = await quemEstaComOPin(companyId, parsed.data.pin, prisma)
  if (!quem) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  let r: { concluiu: boolean; progresso: string }
  try {
    r = await ticarItem({ companyId, colaboradorId: quem.colaboradorId, etapaId: parsed.data.etapaId, itemId: parsed.data.itemId }, prisma)
  } catch (e) {
    if (e instanceof RotinaError) return NextResponse.json({ erro: e.message }, { status: 409 })
    throw e
  }
  return NextResponse.json({
    ...r,
    colaborador: { id: quem.colaboradorId, nome: quem.nome },
    tarefas: await minhasTarefasDeHoje(companyId, quem.colaboradorId, new Date(), prisma),
    agoraServidor: new Date().toISOString(),
  })
}
