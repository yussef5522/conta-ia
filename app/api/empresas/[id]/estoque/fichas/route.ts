// ESTOQUE FASE 2 item 2.0 — fichas técnicas (GET lista, POST cria com versão + ciclo).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listFichas, criarFicha, FichaError } from '@/lib/stock/producao/fichas'
import { ReceitaHomonimaError, reativarFicha, nomeDaAntiga } from '@/lib/stock/producao/receita-ja-existe'
import { renomearEmLote } from '@/lib/stock/nomes/renomear-em-lote'

interface Params { params: Promise<{ id: string }> }


const componenteSchema = z.object({
  itemId: z.string().min(1), qtdPlanejada: z.number().positive(), unidade: z.string().min(1).max(6), posicao: z.number().int().optional() })
const criarSchema = z.object({
  nomeProduzido: z.string().min(1).max(120),
  unidadeProduzido: z.enum(['KG', 'UN', 'LT']),
  tipoProduto: z.enum(['INTERMEDIARIO', 'PRODUTO_FINAL', 'SABOR']),
  setorId: z.string().nullable().optional(),
  valorVenda: z.number().positive().nullable().optional(),
  loteBase: z.number().positive(),
  unidadeLoteBase: z.enum(['KG', 'UN', 'LT']),
  modoPreparo: z.string().max(4000).nullable().optional(),
  tempoPreparoMin: z.number().int().positive().nullable().optional(),
  validadeDias: z.number().int().positive().nullable().optional(),
  componentes: z.array(componenteSchema).min(1),
  // ⭐ etapas (06/09): lista ordenada de nomes. `[]` é significativo (apaga as anteriores).
  etapas: z.array(z.object({ nome: z.string().min(1).max(60), setorId: z.string().nullable().optional() })).max(12).optional(),
  // ⭐ o nome do PDV que esta ficha atende. Quando vem, o vínculo nome→ficha é criado na
  // MESMA transação — foi a ausência dele que deixou 3 fichas órfãs em 01/09.
  // ⭐ 1 nome ou VÁRIOS: o PDV escreve o mesmo produto de vários jeitos (apelidos)
  mapearNomeSuitable: z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(200)).max(20)]).nullable().optional(),
  // ⭐ o mesmo, no mapa dos COMPLEMENTOS (sabores). Mutuamente exclusivo com o de cima.
  // ⭐ 1 grafia ou o GRUPO inteiro confirmado pelo dono
  mapearComplemento: z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(200)).max(30)]).nullable().optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ fichas: await listFichas(companyId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da ficha inválidos.', detalhe: parsed.error.issues[0]?.message }, { status: 400 })
  try {
    const r = await criarFicha({ companyId, userId: a.user!.sub, ...parsed.data })
    // ⭐ ITEM 5 do dono: a resposta DIZ se o vínculo foi feito. "salvou mas não vinculou" é
    // infinitamente melhor que voltar em silêncio — foi o silêncio que gerou a duplicata.
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    /**
     * ⭐⭐ 409, NÃO 422 — e a diferença é de significado, não de número: isto não é "dado
     * inválido", é uma PERGUNTA com três respostas possíveis. Mesma régua do FREIO da
     * contagem e da GRANDEZA da produção.
     */
    if (e instanceof ReceitaHomonimaError) {
      return NextResponse.json({
        erro: e.message, code: 'RECEITA_HOMONIMA',
        ficha: { id: e.ficha.fichaId, nome: e.ficha.nome, lotes: e.ficha.lotes },
        saidas: e.saidas,
      }, { status: 409 })
    }
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

/**
 * ⭐ AS SAÍDAS DA RECUSA — reativar e renomear a antiga.
 *
 * ⚠️ O "criar assim mesmo" NÃO mora aqui: ele é o POST de sempre com
 * `permitirItemNovoComNomeDeEstoque`, o escape que já existia. Uma terceira porta de
 * criação seria o segundo caminho de escrita que esta casa mais paga caro.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const body = await request.json().catch(() => null) as { acao?: string; fichaId?: string } | null
  if (!body?.fichaId || !body.acao) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    if (body.acao === 'REATIVAR') {
      const r = await reativarFicha(companyId, body.fichaId)
      return NextResponse.json({ ok: true, ...r })
    }
    if (body.acao === 'RENOMEAR_A_ANTIGA') {
      const f = await prisma.stockFicha.findFirst({ where: { id: body.fichaId, companyId }, select: { itemProduzidoId: true } })
      if (!f) return NextResponse.json({ erro: 'Ficha não encontrada.' }, { status: 404 })
      const item = await prisma.stockItem.findUniqueOrThrow({ where: { id: f.itemProduzidoId }, select: { nome: true } })
      // ⚠️ pela porta ÚNICA de rename (REGRA 4) — é ela que grava o APELIDO de busca;
      // um update solto faria o nome velho parar de achar a história (a lição de 09/09).
      await renomearEmLote({ companyId, userId: a.user!.sub, pedidos: [{ itemId: f.itemProduzidoId, nomeNovo: nomeDaAntiga(item.nome) }] })
      return NextResponse.json({ ok: true, nome: nomeDaAntiga(item.nome) })
    }
    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 })
  } catch (e) {
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
