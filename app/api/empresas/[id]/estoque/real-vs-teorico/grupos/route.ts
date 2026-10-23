/**
 * ⭐⭐⭐ OS GESTOS DOS GRUPOS DO RADAR — RT2 + RT3 (22/10/2026)
 *
 * **CASCA FINA sobre a porta única** (`lib/stock/radar/grupos.ts`). Quatro gestos, e os
 * quatro delegam: criar · renomear (✎) · definir agenda (chips) · adicionar item.
 *
 * ⛔⛔ **O "adicionar item" NÃO escreve em tabela nova** — ele chama o `porNaLista` da
 * membership que existe desde 20-21/09 (`stock_radar_item`). É isso que faz a lei RT2 valer:
 * *"mexeu aqui, valeu no Radar e no Consumo & Compras"*. Uma 2ª tabela de vínculo daria DUAS
 * verdades pra *"quais itens o dono acompanha"*.
 *
 * ⛔⛔ **O SLUG NÃO VEM DO CLIENTE — ele é RESOLVIDO POR EXISTÊNCIA** no grupo daquela
 * empresa. ⚠️ Repetir um `z.enum` aqui é a cicatriz de 25/09, em que a lista de ações da
 * rota divergiu da lib e **dois gestos ficaram mortos por dias**: grupo que o dono acabou de
 * criar tem slug gerado (`G…`), que nenhum enum escrito à mão conhece. Resolver por
 * existência é o único jeito de o gesto novo funcionar **no dia em que o grupo nasce**.
 *
 * ⚠️ **REGRA 8:** todo alvo resolve por **id escopado pela empresa** — sem o `companyId` no
 * `where`, um id de outra empresa renomearia o grupo do vizinho.
 *
 * ⚠️ **`stock.manage`, não `operate`:** decidir *o que eu acompanho* é organizar a casa do
 * dono — a mesma fronteira do mín/máx, da ficha e do mapa do PDV. Quem opera conta e produz.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'
import { criarGrupo, renomearGrupo, definirAgendaDoGrupo, GrupoError } from '@/lib/stock/radar/grupos'
import { porNaLista } from '@/lib/stock/radar/watchlist'

interface Params { params: Promise<{ id: string }> }

/**
 * ⭐ O dia é `0..6` **SEG-first** (o vocabulário da casa, `DIAS_SEG_FIRST`), nunca o
 * `getDay()` do JS (que é DOM-first). A conversão mora num lugar só, na régua pura.
 *
 * ⚠️ `.strict()` em todo ramo: campo a mais é **400 que diz o nome**, nunca recortado em
 * silêncio — a cicatriz de 25/09.
 */
const CORPO = z.discriminatedUnion('gesto', [
  z.object({
    gesto: z.literal('criar'),
    nome: z.string().min(1),
    emoji: z.string().min(1).optional(),
  }).strict(),
  z.object({
    gesto: z.literal('renomear'),
    grupoId: z.string().min(1),
    nome: z.string().min(1),
    emoji: z.string().min(1).optional(),
  }).strict(),
  z.object({
    gesto: z.literal('agenda'),
    grupoId: z.string().min(1),
    todoDia: z.boolean(),
    dias: z.array(z.number().int().min(0).max(6)),
  }).strict(),
  z.object({
    gesto: z.literal('adicionarItem'),
    grupoId: z.string().min(1),
    itemId: z.string().min(1),
  }).strict(),
])

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res

  const bruto = await request.json().catch(() => null)
  const parsed = CORPO.safeParse(bruto)
  if (!parsed.success) {
    // ⛔ a recusa DIZ o que está errado — "corpo inválido" manda o dono adivinhar
    return NextResponse.json(
      { erro: 'Não entendi o gesto.', code: 'CORPO_INVALIDO', detalhe: parsed.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`) },
      { status: 400 },
    )
  }
  const corpo = parsed.data

  try {
    if (corpo.gesto === 'criar') {
      const grupo = await criarGrupo({ companyId, nome: corpo.nome, emoji: corpo.emoji, quem: auth.userId }, prisma)
      return NextResponse.json({ ok: true, grupo })
    }

    if (corpo.gesto === 'renomear') {
      const grupo = await renomearGrupo(
        { companyId, grupoId: corpo.grupoId, nome: corpo.nome, emoji: corpo.emoji, quem: auth.userId },
        prisma,
      )
      return NextResponse.json({ ok: true, grupo })
    }

    if (corpo.gesto === 'agenda') {
      const grupo = await definirAgendaDoGrupo(
        { companyId, grupoId: corpo.grupoId, todoDia: corpo.todoDia, dias: corpo.dias, quem: auth.userId },
        prisma,
      )
      return NextResponse.json({ ok: true, grupo })
    }

    /**
     * ⭐⭐ ADICIONAR ITEM — o slug sai do GRUPO, o item passa pela porta da membership.
     *
     * ⚠️ O item é conferido **nesta empresa** antes de entrar na lista (REGRA 8): sem isso,
     * um `itemId` de outra empresa viraria vínculo órfão que a mesa leria como item sem nome.
     */
    const grupo = await prisma.stockGrupoVigiado.findFirst({
      where: { id: corpo.grupoId, companyId },
      select: { slug: true, nome: true },
    })
    if (!grupo) throw new GrupoError('Não achei este grupo nesta empresa.')

    const item = await prisma.stockItem.findFirst({
      where: { id: corpo.itemId, companyId },
      select: { id: true, nome: true },
    })
    if (!item) throw new GrupoError('Não achei este item nesta empresa.')

    // ⛔ a porta ÚNICA da membership (idempotente pelo único do banco: dois toques no celular
    //    não criam dois vínculos)
    await porNaLista({ companyId, lista: grupo.slug, itemId: item.id, quem: auth.userId }, prisma)

    return NextResponse.json({
      ok: true,
      efeito: `"${item.nome}" entrou em ${grupo.nome} — vale aqui, no Radar e no Consumo & Compras`,
    })
  } catch (e) {
    // ⛔ o tradutor único: erro de domínio vira 422 com a FRASE; o imprevisto segue 500
    //    (ali o genérico é honesto) — a cicatriz dos 52 `throw e` mudos de 16/09
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) {
      const { status, ...corpoErro } = r
      return NextResponse.json(corpoErro, { status })
    }
    throw e
  }
}
