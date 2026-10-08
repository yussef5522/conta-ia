/**
 * ⭐⭐ B1/B2 — O GUARD DO DONO NO JUIZ NOTURNO: ficha de TAMANHO sem massa+queijo+caixa (08/10).
 *
 * Ordem de 07/10: *"GUARD novo: ficha de TAMANHO sem massa+queijo+caixa = vermelho (molho
 * isento até o dono declarar)"*.
 *
 * ⛔⛔ POR QUE NO JUIZ E NÃO SÓ EM TESTE: o teste prova a RÉGUA; o juiz prova o ESTADO. Receita
 * é editável pela tela a qualquer momento — nada impede alguém de tirar a caixa de uma base
 * amanhã, e o efeito é **silencioso**: o custo cai, a margem sobe, a casa parece mais paga do
 * que está. Foi exatamente esse estado que viveu meses na Caçula (massa em UMA das 11 fichas).
 *
 * ⛔ **B1 é ERRO** (custo subestimado é dinheiro errado na tela) e **B2 é AVISO** (não dá pra
 * conferir porque os itens canônicos não foram resolvidos) — ⚠️ e B2 EXISTE em vez de o juiz
 * calar: *"não consegui conferir"* e *"está tudo certo"* são coisas diferentes, e silêncio
 * lido como saúde é a doença que o E10 já pagou.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { conferirBaseDeTamanho, ehBaseDeTamanho, type ComponenteDaFicha } from './bases-canonicas'
import { resolverItensDaBase } from './preview-normalizacao'

type Db = PrismaClient | Prisma.TransactionClient

export interface BaseInvariantFail {
  invariante: string
  companyId: string | null
  detalhe: string
  nivel?: 'erro' | 'aviso'
}

export async function checkBaseInvariants(db: Db): Promise<BaseInvariantFail[]> {
  const fails: BaseInvariantFail[] = []

  // ⚠️ o universo são as empresas que JÁ declararam alguma base — empresa que nunca mexeu
  //    nisso não tem base pra estar incompleta, e cobrar dela seria alarme falso no dia 1
  const declaradas = await db.stockBaseDoTamanho.findMany({ select: { companyId: true, fichaId: true } })
  const companyIds = [...new Set(declaradas.map((b) => b.companyId))]

  for (const companyId of companyIds) {
    const itensRaw = await db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true } })
    const resolvidos = resolverItensDaBase(itensRaw)
    if (!resolvidos.itens) {
      fails.push({
        invariante: 'B2',
        companyId,
        detalhe: `não consigo conferir as bases de pizza: ${resolvidos.bloqueio}`,
        nivel: 'aviso',
      })
      continue
    }
    const itens = resolvidos.itens

    /**
     * ⭐ O universo de B1 são as fichas APONTADAS como base (`stock_base_do_tamanho`) — a
     * declaração do dono de *"esta ficha é a base deste tamanho"*.
     *
     * ⚠️ NÃO varre o cardápio inteiro de propósito: ficha que ESTRUTURALMENTE parece base mas
     * ninguém apontou pode ser um produto que o dono montou de outro jeito, e cobrar dela
     * seria o juiz decidindo o que é base — justo o que a classificação PERGUNTA em vez de
     * assumir. O que entra aqui é o que ele declarou.
     */
    const bases = declaradas.filter((b) => b.companyId === companyId)
    for (const b of bases) {
      const ficha = await db.stockFicha.findFirst({ where: { id: b.fichaId, companyId } })
      if (!ficha) {
        fails.push({
          invariante: 'B1',
          companyId,
          detalhe: `a base apontada aponta pra ficha ${b.fichaId} que não existe mais — o montador soma "a declarar" sobre uma base configurada`,
        })
        continue
      }
      if (!ficha.ativo) {
        fails.push({
          invariante: 'B1',
          companyId,
          detalhe: `a base de um tamanho aponta pra ficha ${b.fichaId} DESATIVADA — a bancada simula com uma receita aposentada`,
        })
        continue
      }
      const v = await db.stockFichaVersao.findFirst({
        where: { companyId, fichaId: ficha.id, versao: ficha.versaoAtual },
        select: { id: true },
      })
      const comps = v
        ? await db.stockFichaComponente.findMany({
            where: { companyId, versaoId: v.id },
            select: { itemId: true, qtdPlanejada: true },
          })
        : []
      const atual: ComponenteDaFicha[] = comps.map((c) => ({
        itemId: c.itemId,
        qtdPlanejada: c.qtdPlanejada,
        unidade: 'UN',
      }))
      const nome = (await db.stockItem.findFirst({ where: { id: ficha.itemProduzidoId }, select: { nome: true } }))?.nome ?? b.fichaId

      // ⚠️ base apontada que nem tem a FORMA de base é outro defeito, e ele é dito à parte:
      //    cobrar "falta a massa" de um combo mandaria o dono consertar a coisa errada
      if (!ehBaseDeTamanho(atual, itens)) {
        fails.push({
          invariante: 'B1',
          companyId,
          detalhe: `«${nome}» está apontada como base de pizza mas a composição dela não tem a forma de uma base (sabor embutido, caixa de dois tamanhos, ou massa que não bate com o queijo) — confira se a base aponta pra ficha certa`,
        })
        continue
      }

      const { completa, faltando } = conferirBaseDeTamanho(atual, itens)
      if (!completa) {
        fails.push({
          invariante: 'B1',
          companyId,
          detalhe: `a base «${nome}» está sem ${faltando.join(' + ')} — o custo da pizza sai subestimado e a margem vem inflada. Normalize a composição (massa + queijo + caixa).`,
        })
      }
    }
  }
  return fails
}
