// FILA DE IMPRESSÃO — o dono vê e enfileira (30/08/2026).
//
// ⚠️ ENFILEIRAR é `stock.operate`: quem opera a cozinha imprime etiqueta (é o gesto do
// dia). CADASTRAR impressora é `stock.manage` — configuração de equipamento é do dono.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { verFila, enfileirar, cadastrarImpressora, ImpressaoError } from '@/lib/stock/impressao/fila'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ fila: await verFila(companyId, prisma) })
}

const jobSchema = z.object({
  zpl: z.string().min(1).max(200_000),
  descricao: z.string().min(1).max(200),
  copias: z.number().int().positive().max(200).optional(),
  impressoraId: z.string().nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = jobSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Faltou o conteúdo da etiqueta.' }, { status: 400 })
  try {
    const job = await enfileirar({ companyId, ...parsed.data, userId: a.user?.sub ?? null }, prisma)
    return NextResponse.json({ ok: true, jobId: job.id })
  } catch (e) {
    if (e instanceof ImpressaoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const impressoraSchema = z.object({
  nome: z.string().min(1).max(80),
  tipo: z.enum(['REDE', 'USB']),
  host: z.string().max(120).nullish(),
  porta: z.number().int().positive().max(65535).optional(),
  filaUsb: z.string().max(120).nullish(),
})

/** PUT cadastra impressora e devolve o TOKEN do agente — uma única vez. */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = impressoraSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe nome e tipo da impressora.' }, { status: 400 })
  try {
    const { impressora, token } = await cadastrarImpressora({ companyId, ...parsed.data, userId: a.user?.sub ?? null }, prisma)
    // ⚠️ o token só existe AQUI. A tela mostra uma vez e manda copiar pro agente.
    return NextResponse.json({ ok: true, impressora: { id: impressora.id, nome: impressora.nome, tipo: impressora.tipo }, token })
  } catch (e) {
    if (e instanceof ImpressaoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
