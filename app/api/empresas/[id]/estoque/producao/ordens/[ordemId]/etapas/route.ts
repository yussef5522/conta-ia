// ETAPAS DA ORDEM — a gerência designa quem faz cada uma (06/09/2026).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { etapasDaOrdem, designarEtapa, EtapaError } from '@/lib/stock/producao/etapas'
import { pedirPraFinalizar, finalizarPeloGerente, GestoError } from '@/lib/stock/producao/gestos-do-gerente'

interface Params { params: Promise<{ id: string; ordemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}

const schema = z.object({
  etapaId: z.string().min(1),
  // ⚠️ null = tirar a designação (a etapa volta a ser "quem pegar com o PIN")
  colaboradorId: z.string().min(1).nullable(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  // ⭐ designar é OPERAR, não gerenciar: é o encarregado montando o dia, não mexendo em ficha
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    await designarEtapa({ companyId, etapaId: parsed.data.etapaId, colaboradorId: parsed.data.colaboradorId, userId: a.user.sub }, prisma)
  } catch (e) {
    if (e instanceof EtapaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}

// ⭐⭐ OS DOIS GESTOS DO GERENTE PRA ETAPA ABERTA (07/09/2026).
//
// **A ordem do dono:** *"gerente NUNCA fica preso olhando uma etapa aberta sem poder agir."*
//
// ⛔ AQUI É `stock.manage`, e a diferença pro PATCH acima é de PAPEL: designar é o encarregado
// montando o dia (operar); **fechar a tarefa de outra pessoa** é decisão de gestão — mexe no
// rastro de quem trabalhou, e é a mesma fronteira do relatório comparativo.
const gestoSchema = z.object({
  etapaId: z.string().min(1),
  acao: z.enum(['pedir-finalizar', 'finalizar-pelo-gerente']),
  observacao: z.string().max(300).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = gestoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    if (parsed.data.acao === 'pedir-finalizar') {
      await pedirPraFinalizar({ companyId, etapaId: parsed.data.etapaId, userId: a.user.sub }, prisma)
    } else {
      await finalizarPeloGerente({ companyId, etapaId: parsed.data.etapaId, userId: a.user.sub, observacao: parsed.data.observacao }, prisma)
    }
  } catch (e) {
    if (e instanceof GestoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}
