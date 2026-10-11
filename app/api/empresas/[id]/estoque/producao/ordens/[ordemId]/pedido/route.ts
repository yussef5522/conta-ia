/**
 * ⭐⭐ "QUANTAS UNIDADES PRODUZIR?" — a rota do gesto único do pedido (11/10/2026).
 *
 * **Decisão do dono:** a quantidade é perguntada **UMA vez**, DEPOIS de criar a ordem, na página
 * dela — onde dá pra ver a prateleira. Antes ela era perguntada na criação **e** num 2º campo
 * da página que **não escrevia nada**, então o número da criação seguia impresso em toda tela.
 *
 * ⚠️ **`stock.operate`, não `view`:** declarar o pedido é o gesto que faz a separação saber
 * quanto material tirar da câmara. E não é `manage`: quem opera a produção decide o tamanho do
 * lote — exigir gerência aqui esconderia o gesto de quem produz (a família da porta mais
 * restrita que a sala, que já mordeu 4 vezes nesta casa).
 *
 * ⛔ O schema é `.strict()`: campo que a rota não conhece é **400 que diz o nome**, nunca um
 * valor recortado em silêncio pelo zod — a cicatriz de 25/09.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guardStock } from '@/lib/stock/require-stock'
import { confirmarPedido } from '@/lib/stock/producao/confirmar-pedido'
import { OrdemError } from '@/lib/stock/producao/ordens'

interface Params { params: Promise<{ id: string; ordemId: string }> }

const schema = z.object({
  unidades: z.number().positive(),
  /**
   * ⚠️ `nullable` porque *"não tem"* é a resposta, e ela tem que chegar: `null` **apaga** o
   * retalho de uma declaração anterior. Mandar o campo ausente na correção deixaria o kg velho
   * valendo — e bônus de fiscal silencioso é bônus que ninguém confere (a régua de 09/10).
   *
   * ⭐ O teto de 1000 kg é o mesmo da criação: 25 kg já é muito, e o absurdo plausível é o que
   * o aviso de sanidade pergunta — este CHECK cobre o impossível.
   */
  retalhoKg: z.number().positive().max(1000).nullable().optional(),
}).strict()

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => i.path.join('.') || '(corpo)').join(', ')
    return NextResponse.json({ erro: `Pedido inválido: ${campos}.` }, { status: 400 })
  }

  try {
    const r = await confirmarPedido({
      companyId, ordemId, unidades: parsed.data.unidades,
      retalhoKg: parsed.data.retalhoKg ?? null, userId: a.user!.sub,
    })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    /** ⚠️ erro de DOMÍNIO devolve 422 com a frase que ENSINA a saída — nunca 500 mudo */
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
