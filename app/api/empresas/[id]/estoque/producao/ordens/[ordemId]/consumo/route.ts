/**
 * ⭐⭐ "O QUE SAIU DO ESTOQUE PRA ESTA ORDEM" — o bloco que a linha do relatório abre (04/10/2026).
 *
 * **Pedido do dono (item 2):** *"tabelinha Produto · Quantidade · Custo médio · Total, com
 * rodapé 'N produtos · R$ X ✓' onde a soma DEVE bater com o 'Saiu do estoque' da linha-mãe
 * (mesma fonte de dados — NUNCA recalcular por fora; REGRA 11: fonte paralela = vermelho)."*
 *
 * ⭐⭐ **E A FONTE QUE FAZ ISSO BATER É O LEDGER, não o custo médio de hoje** — medido em prod
 * antes de escrever (ver `consumoDaOrdem`): `qtd × custoMedio_hoje` diverge do `custoLoteReal`
 * em **até R$ 40,96** (5 de 12 ordens), porque a média andou com as compras posteriores. O
 * `custoTotal` do movimento foi congelado com o MESMO `custoMap` que gerou o `custoLoteReal`.
 *
 * ⛔ Carregado **sob demanda** (a linha que o dono abriu), nunca junto das 364: 364 ordens ×
 * componentes numa tela só é como o badge virou 1,3 s (11/09).
 *
 * ⛔ `stock.manage`: é o detalhe de uma tela de gestão — mesma trava do relatório que o abre.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { consumoDaOrdem } from '@/lib/stock/producao/ordens'

interface Params { params: Promise<{ id: string; ordemId: string }> }

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  /** ⚠️ REGRA 8: a ordem é resolvida por ID **com o companyId** — nunca por nome, nunca solta */
  const ordem = await prisma.stockProductionOrder.findFirst({
    where: { id: ordemId, companyId },
    select: { id: true, itemProduzidoId: true },
  })
  if (!ordem) return NextResponse.json({ erro: 'Ordem não encontrada.' }, { status: 404 })

  const consumo = await consumoDaOrdem(companyId, ordemId, prisma)
  const ids = [...consumo.keys()]
  const itens = ids.length
    ? await prisma.stockItem.findMany({
        where: { companyId, id: { in: ids } },
        select: { id: true, nome: true, unidadeControle: true },
      })
    : []
  const meta = new Map(itens.map((i) => [i.id, i]))

  const linhas = ids
    .map((itemId) => {
      const c = consumo.get(itemId)!
      const it = meta.get(itemId)
      return {
        itemId,
        // ⚠️ item removido do catálogo não some da lista: ele consumiu dinheiro de verdade
        nome: it?.nome ?? '(item removido do catálogo)',
        unidade: it?.unidadeControle ?? '',
        quantidade: c.qtd,
        custoUnitario: c.custoUnitario,
        custoTotal: c.custoTotal,
      }
    })
    .sort((x, y) => y.custoTotal - x.custoTotal) // ⭐ pelo DINHEIRO: onde o lote mais gastou

  /**
   * ⭐ O total do rodapé é a Σ do que a tabelinha DESENHA — se saísse de outro lugar, o
   * rodapé poderia dizer um número que as linhas acima não somam (a doença do cabeçalho que
   * afirmava "69 duplicatas" com a aba dizendo 0).
   */
  const total = r2(linhas.reduce((s, l) => s + l.custoTotal, 0))

  /**
   * ⭐⭐ E a conferência contra a linha-mãe vai NO PAYLOAD, resolvida no servidor: a tela não
   * tem como "achar que bate". ⚠️ A tolerância é 1 centavo POR COMPONENTE, porque
   * `custoLoteReal` é `round2(Σ qtd×custo)` e o ledger guarda `Σ round2(qtd×custo)` — medido
   * em prod: maior diferença R$ 0,01 em 12 ordens.
   */
  const conclusoes = await prisma.stockProducaoConclusao.findMany({
    where: { companyId, ordemId }, select: { custoLoteReal: true },
  })
  const custoLoteReal = conclusoes.length ? r2(conclusoes.reduce((s, c) => s + c.custoLoteReal, 0)) : null
  const tolerancia = Math.max(0.01, linhas.length * 0.01)
  const bate = custoLoteReal == null ? null : Math.abs(total - custoLoteReal) <= tolerancia

  return NextResponse.json({
    ordemId,
    linhas,
    total,
    /** o que a linha-mãe mostra em "Saiu do estoque" — pra tela poder DIZER que confere */
    custoLoteReal,
    bate,
    /** ⚠️ ordem sem consumo lançado não é "R$ 0,00": é ordem que ainda não consumiu nada */
    vazio: linhas.length === 0,
  })
}
