// ⭐⭐⭐ O QUE O SELETOR OFERECE — FONTE ÚNICA (14/09/2026).
//
// **O dono, preso na revisão de complementos:** *"o 'definir ficha' me EXPULSA da tela. A
// referência é a NOSSA tela de PRODUTOS, que está certa: clico no destino → seletor abre
// ALI (lista das fichas do cardápio com busca) → escolho → sigo na mesma tela."*
//
// ⛔ **ESTA FUNÇÃO DECIDE O QUE A TELA OFERECE, NUNCA O QUE O MAPA ACEITA.** O guard de
// verdade continua na FONTE de cada mapa (`venda-map` recusa INTERMEDIARIO, `complemento-map`
// ACEITA) — eles são opostos de propósito desde 02/09 e unificá-los quebra um dos dois.
// Se um dia a oferta e o guard divergirem, quem ganha é o guard: a tela mostra um destino a
// mais e o servidor recusa com a frase certa. O contrário — oferta mais larga que o guard,
// **sem** guard — é que seria o buraco.
//
// ⚠️ E a lista é a MESMA pros dois lados do seletor (a tela de produtos e a revisão), senão
// o dono veria opções diferentes pra mesma pergunta em duas telas do mesmo módulo.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export type RelatorioDeVenda = 'PRODUTOS' | 'COMPLEMENTOS'

export interface OpcaoDeDestino {
  /** `FICHA` = receita que já existe · `REVENDA` = item do estoque (vira ficha ×1) */
  tipo: 'FICHA' | 'REVENDA'
  id: string
  nome: string
  /** o que ela baixa, em uma linha — "vinculado" sem isso é cego (a régua de 14/09) */
  detalhe: string | null
}

export interface DestinosDisponiveis {
  relatorio: RelatorioDeVenda
  fichas: OpcaoDeDestino[]
  itens: OpcaoDeDestino[]
}

/**
 * ⚠️ `PRODUTO_FINAL` nos dois; `INTERMEDIARIO` **só** em complementos — sabor é
 * intermediário por natureza (consumido pela pizza, nunca vendido solto), e recusá-lo ali
 * tornaria o módulo de complementos impossível.
 */
const TIPOS_OFERECIDOS: Record<RelatorioDeVenda, readonly string[]> = {
  PRODUTOS: ['PRODUTO_FINAL'],
  COMPLEMENTOS: ['PRODUTO_FINAL', 'INTERMEDIARIO'],
}

export async function destinosPossiveis(
  companyId: string,
  relatorio: RelatorioDeVenda,
  db: PrismaClient = defaultPrisma,
): Promise<DestinosDisponiveis> {
  const [fichas, itens] = await Promise.all([
    db.stockFicha.findMany({
      where: { companyId, ativo: true, tipoProduto: { in: [...TIPOS_OFERECIDOS[relatorio]] } },
      select: { id: true, itemProduzidoId: true, tipoProduto: true, versaoAtual: true },
    }),
    // ⛔ só REVENDA: matéria-prima nunca é destino de venda, nem como atalho
    db.stockItem.findMany({
      where: { companyId, ativo: true, categoria: 'REVENDA' },
      select: { id: true, nome: true, unidadeControle: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const nomes = new Map(
    (await db.stockItem.findMany({
      where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } },
      select: { id: true, nome: true },
    })).map((i) => [i.id, i.nome]),
  )

  /**
   * ⭐ O DETALHE ("o que ela baixa") sai da versão vigente da ficha — é o que deixa o dono
   * escolher com os olhos em vez de adivinhar pelo nome. Sem ele, duas fichas parecidas
   * viram uma aposta, e aposta em destino de venda é estoque errado.
   */
  const versoes = await db.stockFichaVersao.findMany({
    where: { fichaId: { in: fichas.map((f) => f.id) } },
    select: { id: true, fichaId: true, versao: true },
  })
  const vigente = new Map(fichas.map((f) => [f.id, versoes.find((v) => v.fichaId === f.id && v.versao === f.versaoAtual)?.id]))
  const comps = await db.stockFichaComponente.findMany({
    where: { versaoId: { in: [...vigente.values()].filter(Boolean) as string[] } },
    select: { versaoId: true, itemId: true, qtdPlanejada: true },
  })
  const nomeDeItem = new Map(
    (await db.stockItem.findMany({
      where: { companyId, id: { in: [...new Set(comps.map((c) => c.itemId))] } },
      select: { id: true, nome: true },
    })).map((i) => [i.id, i.nome]),
  )

  return {
    relatorio,
    fichas: fichas
      .map((f) => {
        const vid = vigente.get(f.id)
        const meus = comps.filter((c) => c.versaoId === vid)
        const detalhe = meus.length === 0
          ? 'receita sem componente'
          : meus.slice(0, 3).map((c) => `${nomeDeItem.get(c.itemId) ?? '?'} ×${c.qtdPlanejada}`).join(' + ')
            + (meus.length > 3 ? ` +${meus.length - 3}` : '')
        return { tipo: 'FICHA' as const, id: f.id, nome: nomes.get(f.itemProduzidoId) ?? '(produto)', detalhe }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    itens: itens.map((i) => ({ tipo: 'REVENDA' as const, id: i.id, nome: i.nome, detalhe: `item do estoque (${i.unidadeControle})` })),
  }
}
