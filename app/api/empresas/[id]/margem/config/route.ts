/**
 * ⭐ A ROTA DE CONFIG DA MARGEM (07/10/2026) — canais, sabores-por-tamanho e base.
 *
 * ⚠️ `stock.manage` pra ESCREVER, e não `transaction.view`: apontar a base de uma pizza é
 * decisão de RECEITA e a taxa de um canal é decisão COMERCIAL — a mesma fronteira que faz
 * enviar boleto ser `stock.manage` desde 24/08. **Ler a bancada é `transaction.view`** (é
 * dinheiro); são travas diferentes de propósito.
 *
 * ⛔ A recusa de domínio vira **422 com `code`**, nunca 500 mudo — a cicatriz de 20/09, em que
 * um erro sem corpo virou *"Não consegui carregar."* na cara do dono.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { prisma } from '@/lib/db'
import { aplicarConfigDaMargem, ConfigDaMargemError, type GestoDaConfig } from '@/lib/margem/config'

interface Params {
  params: Promise<{ id: string }>
}

// ⛔ o enum DERIVA do tipo do gesto: lista repetida à mão aqui deixou 2 gestos mortos por dias
// em 25/09 (o `z.enum` da rota de conciliação não acompanhou a lib)
const gesto = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('SEMEAR') }),
  z.object({ acao: z.literal('CANAL_TAXA'), canalId: z.string().min(1), taxaPct: z.number().nullable() }),
  z.object({ acao: z.literal('CANAL_NOVO'), nome: z.string().min(1), taxaPct: z.number().nullable() }),
  z.object({ acao: z.literal('REGRA_SABORES'), tamanho: z.string().min(1), sabores: z.number().int() }),
  z.object({ acao: z.literal('BASE_TAMANHO'), tamanho: z.string().min(1), fichaId: z.string().min(1) }),
]) satisfies z.ZodType<GestoDaConfig>

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('stock.manage')
    const g = gesto.parse(await request.json())

    const efeito = await aplicarConfigDaMargem({
      companyId,
      userId: ctx.user?.id ?? null,
      gesto: g,
      db: prisma,
    })
    return NextResponse.json(efeito)
  } catch (e) {
    if (e instanceof ConfigDaMargemError) {
      return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
    }
    return handleApiError(e)
  }
}
