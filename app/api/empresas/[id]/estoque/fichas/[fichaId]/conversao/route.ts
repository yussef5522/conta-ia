/**
 * ⭐⭐ O PREVIEW E O GESTO DA CONVERSÃO DE UMA FICHA (04/10/2026).
 *
 * **GET** = o preview (ficha antes × depois + **a separação antes × depois**). ⛔ Não grava nada:
 * é a tela que responde *"isso mexe no meu estoque?"* antes do clique.
 *
 * **POST** = o gesto. `stock.manage`, porque **a ficha é decisão do dono** (17/08) — o operador
 * de estoque produz e confere, não reescreve receita.
 *
 * ⚠️ O preview e o gesto leem a MESMA `converterLote` e a MESMA porta de separação. Se o
 * preview tivesse conta própria, ele prometeria um material que a ordem não vai separar — e o
 * dono descobriria com a carne na mão (a doença do preview × confirm do import de OFX).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'
import { sugestoesDaConversao } from '@/lib/stock/producao/converter-lote'
import { previewDaConversao, fraseDoPreview, PEDIDO_DE_EXEMPLO } from '@/lib/stock/producao/preview-da-conversao'
import { aplicarConversaoDeLote } from '@/lib/stock/producao/aplicar-conversao'
import { loteEhComparavel } from '@/lib/stock/producao/lote-comparavel'
import { rendimentoMedidoDaFicha } from '@/lib/stock/producao/conclusao'

interface Params { params: Promise<{ id: string; fichaId: string }> }

/** carrega o estado da ficha que as duas pontas (preview e gesto) precisam ler */
async function estadoDaFicha(companyId: string, fichaId: string) {
  const ficha = await prisma.stockFicha.findFirst({
    where: { id: fichaId, companyId },
    select: { id: true, versaoAtual: true, itemProduzidoId: true, ativo: true },
  })
  if (!ficha) return null
  const [versao, produto] = await Promise.all([
    prisma.stockFichaVersao.findFirst({
      where: { companyId, fichaId, versao: ficha.versaoAtual },
      select: { id: true, loteBase: true, unidadeLoteBase: true },
    }),
    prisma.stockItem.findFirst({
      where: { id: ficha.itemProduzidoId, companyId },
      select: { nome: true, unidadeControle: true },
    }),
  ])
  if (!versao || !produto) return null
  const comps = await prisma.stockFichaComponente.findMany({
    where: { companyId, versaoId: versao.id },
    orderBy: { posicao: 'asc' },
    select: { itemId: true, qtdPlanejada: true, unidade: true },
  })
  const nomes = new Map(
    (await prisma.stockItem.findMany({ where: { companyId, id: { in: comps.map((c) => c.itemId) } }, select: { id: true, nome: true } }))
      .map((i) => [i.id, i.nome]),
  )
  return {
    ficha,
    versao,
    produto,
    componentes: comps.map((c) => ({
      itemId: c.itemId,
      nome: nomes.get(c.itemId) ?? '(item removido)',
      unidade: c.unidade,
      qtdPlanejada: c.qtdPlanejada,
    })),
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const e = await estadoDaFicha(companyId, fichaId)
  if (!e) return NextResponse.json({ erro: 'Ficha não encontrada.' }, { status: 404 })

  const jaComparavel = loteEhComparavel(e.versao.unidadeLoteBase, e.produto.unidadeControle)
  const medido = await rendimentoMedidoDaFicha(companyId, fichaId)
  const dosePrincipal = e.componentes.length ? Math.max(...e.componentes.map((c) => c.qtdPlanejada)) : null

  const sugestoes = sugestoesDaConversao({
    nomeProduto: e.produto.nome,
    dosePrincipal,
    medido: medido.media,
    lotes: medido.lotes,
    loteBase: e.versao.loteBase,
  })

  /**
   * ⭐ O número do preview: o que a URL pediu, ou a RECOMENDADA, ou o `loteBase` atual.
   *
   * ⭐⭐ **E o `loteBase` como último degrau não é preguiça — é A LEI medida em 04/10:** a
   * separação é neutra **exatamente** quando o número digitado é o `loteBase` de hoje (é o caso
   * de "o número estava certo, a UNIDADE estava errada", que é o diagnóstico das 37). Abrir o
   * preview nesse número mostra de cara o desfecho que não encosta no estoque.
   */
  const pedido = Number(request.nextUrl.searchParams.get('pedido')) || PEDIDO_DE_EXEMPLO
  const pedidoNum = Number(request.nextUrl.searchParams.get('unidadesPorReceita'))
  const unidadesPorReceita =
    pedidoNum > 0 ? pedidoNum : sugestoes.recomendada?.valor ?? e.versao.loteBase

  const atual = {
    loteBase: e.versao.loteBase,
    unidadeLoteBase: e.versao.unidadeLoteBase,
    unidadeProduto: e.produto.unidadeControle,
    componentes: e.componentes,
  }
  const preview = previewDaConversao(atual, unidadesPorReceita, pedido)

  return NextResponse.json({
    ficha: {
      id: e.ficha.id,
      versaoAtual: e.ficha.versaoAtual,
      ativo: e.ficha.ativo,
      nomeProduto: e.produto.nome,
      unidadeProduto: e.produto.unidadeControle,
      loteBase: e.versao.loteBase,
      unidadeLoteBase: e.versao.unidadeLoteBase,
      componentes: e.componentes,
    },
    /** ⭐ `true` quando o lote JÁ declara a unidade do produto: nada a converter aqui */
    jaComparavel,
    medido: { media: medido.media, lotes: medido.lotes },
    sugestoes,
    unidadesPorReceita,
    preview,
    /** ⚠️ a frase sai do SERVIDOR: se a tela a montasse, teríamos duas verdades sobre o mesmo preview */
    frase: preview ? fraseDoPreview(preview, e.produto.unidadeControle) : null,
  })
}

const aplicarSchema = z.object({
  /** quantas unidades do produto 1 receita produz HOJE — o número que o DONO confirmou */
  unidadesPorReceita: z.number().positive().max(100000),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  // ⛔ `manage`: converter é mexer na RECEITA, e receita é decisão do dono (17/08)
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const parsed = aplicarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { erro: 'Diga quantas unidades 1 receita produz.', detalhe: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  try {
    const r = await aplicarConversaoDeLote(companyId, fichaId, parsed.data.unidadesPorReceita, a.user!.sub)
    return NextResponse.json({
      ok: true,
      ...r,
      /** ⭐ o recibo DIZ o que aconteceu — "gravou e não disse nada" é o sucesso disfarçado (14/09) */
      efeito: r.soRotulo
        ? `a ficha passou a declarar 1 ${r.unidadeLoteBaseNova} por receita · as doses ficaram intactas (versão ${r.versao})`
        : `a ficha passou a declarar 1 ${r.unidadeLoteBaseNova} por receita · ${r.dosesAlteradas} dose(s) convertida(s) (versão ${r.versao})`,
    })
  } catch (e) {
    // ⭐ o tradutor único: a recusa chega com a frase inteira, nunca como 500 mudo (16/09)
    const resp = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (resp) return NextResponse.json(resp, { status: resp.status })
    throw e
  }
}
