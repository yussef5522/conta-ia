/**
 * ⭐⭐ O GESTO DA CONVERSÃO — e ele é ORQUESTRADOR, não um 2º gravador de ficha (04/10/2026).
 *
 * **Ordem do dono:** *"eu confirmo → vira versão nova da ficha (versionada, nunca sobrescreve).
 * Ficha continua sendo MINHA decisão: nada converte sozinho."*
 *
 * ⭐⭐ **GRAVA PELO `atualizarFicha`, a porta única da ficha** — que já versiona quando
 * `loteBase`/`unidadeLoteBase`/`componentes` mudam, já recusa ciclo e já herda etapas/preparo.
 * Escrever `stockFichaVersao.create` aqui seria a **segunda porta de gravação de receita**, e ela
 * divergiria na primeira regra nova (foi assim que o `PAGAMENTO_EMPRESTIMO` do import gravou sem
 * split, 11/09). ⛔ **E por isso não há tabela nova:** o rastro da conversão **É a versão** — a
 * anterior fica no histórico, com autor e data, pra sempre.
 *
 * ⚠️ **RE-AVALIA DENTRO DO GESTO**, nunca confia no preview que o dono viu: entre ele abrir a
 * tela e clicar, outra aba (ou a marcyelle) pode ter convertido a mesma ficha. Converter de novo
 * dividiria as doses **duas vezes** — e aí a receita sai com 1/N do material, que é o estrago
 * que esta casa mais paga. É a régua do `concluirDoTablet` e dos gestos do gerente (07/09).
 */

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { atualizarFicha, FichaError } from './fichas'
import { converterLote } from './converter-lote'
import { loteEhComparavel } from './lote-comparavel'

type Db = PrismaClient

export class ConversaoError extends Error {}

export interface ResultadoDaConversao {
  versao: number
  loteBaseNovo: number
  unidadeLoteBaseNova: string
  /** `true` quando nenhuma dose se moveu — a conversão foi só de rótulo */
  soRotulo: boolean
  /** quantos componentes tiveram a dose alterada */
  dosesAlteradas: number
}

/**
 * Converte o lote de UMA ficha: `loteBase` passa a 1 na unidade do produto e as doses são
 * divididas por `unidadesPorReceita`.
 *
 * @param unidadesPorReceita quantas unidades do produto 1 execução da receita produz HOJE —
 *   o número que **o dono** digitou ou confirmou. Nunca lido da medição aqui dentro.
 */
export async function aplicarConversaoDeLote(
  companyId: string,
  fichaId: string,
  unidadesPorReceita: number,
  userId: string | null,
  db: Db = defaultPrisma,
): Promise<ResultadoDaConversao> {
  if (!(unidadesPorReceita > 0)) {
    throw new ConversaoError('Diga quantas unidades 1 receita produz — o número tem que ser maior que zero.')
  }

  const ficha = await db.stockFicha.findFirst({
    where: { id: fichaId, companyId },
    select: { id: true, versaoAtual: true, itemProduzidoId: true, ativo: true },
  })
  if (!ficha) throw new ConversaoError('Ficha não encontrada.')
  if (!ficha.ativo) throw new ConversaoError('Esta ficha está arquivada — reative antes de converter.')

  const [versao, produto] = await Promise.all([
    db.stockFichaVersao.findFirst({
      where: { companyId, fichaId, versao: ficha.versaoAtual },
      select: { id: true, loteBase: true, unidadeLoteBase: true },
    }),
    db.stockItem.findFirst({
      where: { id: ficha.itemProduzidoId, companyId },
      select: { nome: true, unidadeControle: true },
    }),
  ])
  if (!versao || !produto) throw new ConversaoError('Não achei a versão atual da ficha ou o item produzido.')

  /**
   * ⛔ A RE-AVALIAÇÃO QUE IMPEDE A DOSE DIVIDIDA DUAS VEZES. E ela responde pela MESMA régua do
   * juiz M5 e da lista de pendentes — se respondesse por outra, a lista ofereceria uma ficha que
   * o gesto recusa (ou pior: o contrário).
   */
  if (loteEhComparavel(versao.unidadeLoteBase, produto.unidadeControle)) {
    throw new ConversaoError(
      `A ficha de «${produto.nome}» já declara o lote em ${produto.unidadeControle} — ela foi convertida ` +
        `enquanto você decidia (outra aba, ou outra pessoa). Nada foi alterado: converter de novo ` +
        `dividiria as doses duas vezes.`,
    )
  }

  const comps = await db.stockFichaComponente.findMany({
    where: { companyId, versaoId: versao.id },
    orderBy: { posicao: 'asc' },
    select: { itemId: true, qtdPlanejada: true, unidade: true, posicao: true },
  })
  if (!comps.length) throw new ConversaoError('Esta ficha não tem componente nenhum pra converter.')

  const conv = converterLote(
    {
      loteBase: versao.loteBase,
      unidadeLoteBase: versao.unidadeLoteBase,
      unidadeProduto: produto.unidadeControle,
      componentes: comps.map((c) => ({ itemId: c.itemId, nome: '', unidade: c.unidade, qtdPlanejada: c.qtdPlanejada })),
    },
    unidadesPorReceita,
  )
  if (!conv) throw new ConversaoError('Não consegui converter: a ficha não tem lote declarado.')

  try {
    const { versao: novaVersao } = await atualizarFicha(
      companyId,
      fichaId,
      {
        loteBase: conv.loteBaseNovo,
        unidadeLoteBase: conv.unidadeLoteBaseNova,
        componentes: conv.componentes.map((c, i) => ({
          itemId: c.itemId,
          qtdPlanejada: c.qtdNova,
          unidade: c.unidade,
          posicao: comps[i]?.posicao ?? i,
        })),
        userId: userId ?? undefined,
      },
      db,
    )
    return {
      versao: novaVersao,
      loteBaseNovo: conv.loteBaseNovo,
      unidadeLoteBaseNova: conv.unidadeLoteBaseNova,
      soRotulo: conv.soRotulo,
      dosesAlteradas: conv.componentes.filter((c) => !c.intacta).length,
    }
  } catch (e) {
    // ⚠️ a recusa da porta da ficha (ciclo, componente vazio) chega ao dono com a frase DELA,
    // não com um "erro interno" — a régua do tradutor 422 do estoque (16/09).
    if (e instanceof FichaError) throw new ConversaoError(e.message)
    throw e
  }
}
