// Recusar / reabrir uma nota da fila.
//
// ⚠️ `stock.manage`: dizer que uma nota não é da empresa é decisão de DONO — a mesma fronteira
// de papel do boleto. A operadora confere o que chegou; contestar documento fiscal, não.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { recusarNota, reabrirNota, previewDaRecusa, MOTIVOS_RECUSA, RecusaError } from '@/lib/stock/recusa-nota'

interface Params { params: Promise<{ id: string; nfeId: string }> }

/** o PREVIEW: o que a recusa vai desfazer (nada de meia-recusa) */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  try {
    return NextResponse.json({ preview: await previewDaRecusa(companyId, nfeId, prisma) })
  } catch (e) {
    if (e instanceof RecusaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const schema = z.union([
  z.object({
    acao: z.literal('RECUSAR'),
    motivo: z.enum(MOTIVOS_RECUSA),
    observacao: z.string().max(500).optional(),
  }),
  z.object({ acao: z.literal('REABRIR'), motivo: z.string().max(500).optional() }),
])

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha o motivo da recusa.' }, { status: 400 })
  try {
    if (parsed.data.acao === 'REABRIR') {
      return NextResponse.json(await reabrirNota(companyId, nfeId, parsed.data.motivo, a.user!.sub, prisma))
    }
    return NextResponse.json(await recusarNota({
      companyId, nfeId, motivo: parsed.data.motivo, observacao: parsed.data.observacao, userId: a.user!.sub,
    }, prisma))
  } catch (e) {
    // ⛔ bloqueio da conta já enviada ao financeiro vem por aqui, com a saída na mensagem
    if (e instanceof RecusaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
