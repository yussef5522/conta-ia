/**
 * ⭐⭐ A CONFIG DE COMPRA POR ITEM — POST (lei C5, 16/10/2026).
 *
 * ⚠️ **`stock.manage`, não `operate`:** declarar quando a mercadoria chega e quem é o fornecedor
 * é organizar a casa do dono — a MESMA fronteira do mín/máx, da ficha e do mapa do PDV. Quem
 * opera produz e separa; esta decisão governa quanto dinheiro sai em compra.
 *
 * ⛔ **CASCA FINA sobre a porta única** (`salvarConfigDeCompra`): um `upsert` aqui seria a 2ª
 * porta de escrita, e a coluna passaria a significar duas coisas.
 *
 * ⛔ **`.strict()` no corpo:** campo a mais é **400 que diz o nome**, nunca recortado em
 * silêncio — a cicatriz de 25/09, em que o `z.enum` repetido à mão deixou 2 gestos mortos por
 * dias. E o `z.enum` dos dias **não existe**: a lista de 0..6 é validada pela PORTA, que é quem
 * sabe o que é um dia de chegada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'
import { salvarConfigDeCompra, ConfigDeCompraError } from '@/lib/compras/config-de-compra'

interface Params { params: Promise<{ id: string }> }

const schema = z
  .object({
    itemId: z.string().min(1),
    /** SEG-first; ⚠️ o RANGE é da porta, não daqui — ela é o dono da pergunta */
    diasChegada: z.array(z.number().int()),
    antecedenciaDias: z.number().int().optional(),
    /** ⚠️ `null` explícito = "não tem fornecedor"; ausente = mantém o padrão */
    fornecedor: z.string().nullable().optional(),
    folgaPct: z.number().int().optional(),
  })
  .strict()

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res

  const body = await request.json().catch(() => null)
  const p = schema.safeParse(body)
  if (!p.success) {
    return NextResponse.json(
      { erro: 'Dados inválidos.', code: 'CORPO_INVALIDO', detalhe: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      { status: 400 },
    )
  }

  try {
    const config = await salvarConfigDeCompra(
      { companyId, ...p.data, userId: auth.userId },
      prisma,
    )
    return NextResponse.json({ ok: true, config })
  } catch (e) {
    if (e instanceof ConfigDeCompraError) {
      return NextResponse.json({ erro: e.message, code: 'CONFIG_DE_COMPRA' }, { status: 422 })
    }
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
