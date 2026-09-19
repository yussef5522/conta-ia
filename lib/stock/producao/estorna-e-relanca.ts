// ⭐⭐⭐ ESTORNA E RELANÇA UM LOTE (19/09/2026) — a correção de conclusão com número torto.
//
// **A ordem do dono:** *"estorna as 2 gerações podres (14/09 CUBA e 16/09 MAIONESE) e
// relança com 22,864 — preview → meu OK → aplica."*
//
// ⛔⛔ **NÃO É CONTAGEM, e a diferença é o ponto.** Um ajuste de contagem diria *"hoje tem
// 22,864"* e deixaria no ledger um `AJUSTE_CONTAGEM` de −22.841 kg — um buraco gigante com
// cara de perda física, que envenenaria o Real vs Teórico para sempre. O que houve não foi
// perda: **foi um número digitado errado**, e a correção honesta é desfazer o lançamento e
// refazer com o número certo.
//
// ⭐ **O LEDGER CONTINUA IMUTÁVEL:** correção = **ESTORNO + NOVO**, nunca UPDATE — a mesma
// disciplina da reunitização do pão (27/08) e da cirurgia do ovo (30/08).
//
// ⚠️ **O CUSTO DO LOTE NÃO MUDA — e é ele que prova que a correção é de GRANDEZA.** O que
// foi consumido de insumo é o que foi; o custo total do lote (R$ 248,56) está certo. O que
// estava errado é em quantas unidades ele foi dividido:
//
// ```
//   antes:  22864 kg × R$ 0,010871 = R$ 248,56     ⛔ custo unitário de brinquedo
//   depois: 22,864 kg × R$ 10,8711 = R$ 248,56     ⭐ bate com os lotes vizinhos (10,95 / 10,84)
// ```
//
// ⛔ E o custo unitário vai em **PRECISÃO CHEIA**: `248,56 / 22,864` não cabe em 2 casas, e
// o CHECK do ledger recusa a linha se `|custoTotal − qtd × custoUnit| > 0,01`.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento, estornarMovimento } from '../movement'
import { recomputeSaldoCache, saldosDaEmpresa } from '../saldo'
import { TIPO_GERACAO, OrdemError } from './ordens'
import { marcarConclusaoEstornada } from './conclusao-estornada'

const round4 = (n: number) => Math.round(n * 10000) / 10000

export interface PreviewDoRelancamento {
  conclusaoId: string
  ordemId: string
  produto: string
  unidade: string
  antes: { qtdGerada: number; custoUnitario: number; rendimento: number }
  depois: { qtdGerada: number; custoUnitario: number; rendimento: number }
  custoDoLote: number
  /** ⭐ a prova de que é grandeza: o custo do lote NÃO muda */
  custoInvariante: boolean
  movimentoGeracaoId: string
  /** o saldo do item antes e depois — o que o dono confere na Posição */
  saldoAntes: number
  saldoDepois: number
}

/** ⭐ LEITURA PURA — nada é gravado. O dono confere e só então autoriza. */
export async function preverRelancamento(
  companyId: string, conclusaoId: string, qtdCerta: number, db: PrismaClient = defaultPrisma,
): Promise<PreviewDoRelancamento> {
  if (!(qtdCerta > 0)) throw new OrdemError('A quantidade certa precisa ser maior que zero.')
  const c = await db.stockProducaoConclusao.findFirst({ where: { id: conclusaoId, companyId } })
  if (!c) throw new OrdemError('Conclusão não encontrada.')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: c.ordemId, companyId }, select: { itemProduzidoId: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  const item = await db.stockItem.findUnique({ where: { id: ordem.itemProduzidoId }, select: { nome: true, unidadeControle: true } })

  // ⚠️ o movimento de geração é resolvido pela ORDEM + tipo + quantidade da conclusão —
  // numa ordem com produção PARCIAL há várias gerações, e pegar "a primeira" corrigiria o
  // lote errado. A quantidade é o que amarra esta conclusão ao movimento dela.
  const ger = await db.stockMovement.findFirst({
    where: { companyId, itemId: ordem.itemProduzidoId, tipo: TIPO_GERACAO, receiptId: c.ordemId, quantidade: c.qtdGerada },
    orderBy: { dataMovimento: 'desc' },
  })
  if (!ger) throw new OrdemError('Não achei o movimento de geração desta conclusão — ele pode já ter sido estornado.')

  /**
   * ⚠️⚠️ O SALDO VEM DA MESMA FONTE DA POSIÇÃO (19/09) — e isto foi bug meu, pego antes do
   * OK do dono. A 1ª versão somava TODOS os movimentos (`aggregate` cru) e mostrava
   * **3,12 KG** onde a Posição mostra **36,494**: `PRODUCAO_CONSUMO` é transferência
   * interna e não conta na prateleira (`saldo.ts`), então a soma bruta é outra pergunta.
   *
   * ⛔ *A prévia fala a MESMA língua da tela que ela prevê* (a régua de 29/08) — senão o
   * dono confere o número no preview, vai na Posição e vê outro.
   */
  const saldos = await saldosDaEmpresa(db, companyId)
  const saldoAntes = saldos.find((x) => x.itemId === ordem.itemProduzidoId)?.saldo ?? 0

  return {
    conclusaoId, ordemId: c.ordemId,
    produto: item?.nome ?? '(produto)', unidade: item?.unidadeControle ?? '',
    antes: { qtdGerada: c.qtdGerada, custoUnitario: ger.custoUnitario, rendimento: c.rendimento },
    depois: {
      qtdGerada: qtdCerta,
      custoUnitario: ger.custoTotal / qtdCerta,
      rendimento: round4(qtdCerta / (c.escalaConsumida || 1)),
    },
    custoDoLote: ger.custoTotal,
    custoInvariante: true,
    movimentoGeracaoId: ger.id,
    saldoAntes,
    saldoDepois: Math.round((saldoAntes - c.qtdGerada + qtdCerta) * 1000) / 1000,
  }
}

/**
 * ⭐⭐ APLICA — estorno + movimento novo + conclusão nova, **numa transação só**.
 *
 * ⛔ Em duas transações, uma falha no meio deixaria o lote estornado e **nada no lugar** —
 * o produto sumiria do estoque.
 */
export async function estornarERelancar(
  input: { companyId: string; conclusaoId: string; qtdCerta: number; motivo: string; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ preview: PreviewDoRelancamento; movimentoNovoId: string; conclusaoNovaId: string }> {
  if (!input.motivo?.trim()) throw new OrdemError('Diga o motivo do estorno — correção sem porquê vira mistério em três meses.')
  const preview = await preverRelancamento(input.companyId, input.conclusaoId, input.qtdCerta, db)
  const c = await db.stockProducaoConclusao.findFirstOrThrow({ where: { id: input.conclusaoId, companyId: input.companyId } })

  const r = await db.$transaction(async (tx) => {
    const estorno = await estornarMovimento(tx as unknown as PrismaClient, preview.movimentoGeracaoId, { criadoPorId: input.userId ?? null })
    const novo = await criarMovimento(tx as unknown as PrismaClient, {
      companyId: input.companyId,
      itemId: (await tx.stockProductionOrder.findFirstOrThrow({ where: { id: c.ordemId }, select: { itemProduzidoId: true } })).itemProduzidoId,
      tipo: TIPO_GERACAO,
      quantidade: input.qtdCerta,
      // ⛔ precisão cheia: o CHECK do ledger recusa qtd × custoUnit fora de ±0,01 do total
      custoUnitario: preview.custoDoLote / input.qtdCerta,
      custoTotal: preview.custoDoLote,
      receiptId: c.ordemId,
      origem: 'MANUAL',
      criadoPorId: input.userId ?? null,
    })
    // ⭐ a conclusão VELHA fica (é o registro do que foi feito) e sai das médias;
    //   a NOVA é a que passa a valer.
    const nova = await tx.stockProducaoConclusao.create({
      data: {
        companyId: input.companyId, ordemId: c.ordemId, qtdGerada: input.qtdCerta,
        colaboradorId: c.colaboradorId, escalaConsumida: c.escalaConsumida,
        custoLoteReal: preview.custoDoLote,
        custoUnitarioReal: Math.round((preview.custoDoLote / input.qtdCerta) * 100) / 100,
        rendimento: preview.depois.rendimento, validadeAte: c.validadeAte,
        parcial: c.parcial, criadoPorId: input.userId ?? null,
      },
    })
    await marcarConclusaoEstornada({
      companyId: input.companyId, conclusaoId: input.conclusaoId, motivo: input.motivo.trim(),
      estornoMovimentoId: estorno.id, relancamentoMovimentoId: novo.id, userId: input.userId,
    }, tx)
    return { movimentoNovoId: novo.id, conclusaoNovaId: nova.id }
  })

  await recomputeSaldoCache(db, input.companyId)
  return { preview, ...r }
}
