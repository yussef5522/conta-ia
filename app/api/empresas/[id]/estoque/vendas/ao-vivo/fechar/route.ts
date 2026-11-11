// V11 · FECHAR O DIA — o dono fechou o caixa na Suit. stock.operate. Idempotente + trava do laço.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { fecharDiaNaMao, FechandoAgoraError } from '@/lib/suit/fechar-dia'
import { criarClienteSuitLeitura, SuitErro, SuitEscritaVetadaError } from '@/lib/suit/cliente-leitura'
import { DiaJaTemImportError, DiaForaDoCorteError } from '@/lib/suit/materializar'

interface Params { params: Promise<{ id: string }> }
const TRAVA = `${process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'}/suit.lock`

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  try {
    return NextResponse.json(await fecharDiaNaMao(prisma, criarClienteSuitLeitura(), companyId, new Date(), TRAVA))
  } catch (e) {
    if (e instanceof FechandoAgoraError) return NextResponse.json({ erro: e.message, code: 'FECHANDO' }, { status: 409 })
    if (e instanceof DiaJaTemImportError || e instanceof DiaForaDoCorteError) return NextResponse.json({ erro: e.message }, { status: 409 })
    if (e instanceof SuitErro || e instanceof SuitEscritaVetadaError) return NextResponse.json({ erro: `A Suit não respondeu: ${e.message}` }, { status: 502 })
    // ⛔ mensagem crua do Prisma vaza a URI do banco — só o nome
    console.error('[vendas/ao-vivo/fechar] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui fechar o dia agora. Tente de novo em 1 minuto.' }, { status: 500 })
  }
}
