// ⭐⭐ O ESCRITOR ÚNICO do agrupamento por grafia (08/09/2026).
//
// Três portas chamam a MESMA função — import, nascimento de ficha e retroativo:
//
//   *"E deixa PLANTADO: quando uma ficha nova nascer, as grafias pendentes de canônico
//   igual entram juntas na hora (4 Queijos entra sozinho no dia em que 4 QUEIJOS ganhar
//   ficha) — **senão a regra só vale pro passado**."* — o dono.
//
// ⛔ É a família do "N caminhos, 1 esquecido": se cada porta tivesse a sua cópia, a que
// alguém esquecer de atualizar vira a que deixa o trabalho parado. Aqui a regra tem um dono.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { agrupamentoAutomatico, type AgrupamentoAutomatico } from './grafia-canonica'

type Db = PrismaClient | Prisma.TransactionClient

export type OrigemDoAgrupamento = 'IMPORT' | 'FICHA_NOVA' | 'RETROATIVO'

/**
 * Lê o estado atual e devolve o PLANO — sem gravar nada.
 *
 * ⚠️ Os pendentes saem do CATÁLOGO (`stock_venda_complemento_nome`), não das linhas do dia:
 * o catálogo é a prateleira permanente, e é dela que a tela reclama. Um nome que apareceu
 * uma vez em agosto e nunca mais continua sendo trabalho parado.
 */
export async function planoDeAgrupamento(
  companyId: string, db: Db = defaultPrisma,
): Promise<AgrupamentoAutomatico[]> {
  const [catalogo, mapeados, fichas] = await Promise.all([
    db.stockVendaComplementoNome.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    db.stockVendaComplementoMap.findMany({
      where: { companyId, alvoTipo: 'FICHA', fichaId: { not: null } },
      select: { nomeSuitable: true, fichaId: true },
    }),
    db.stockFicha.findMany({
      where: { companyId, ativo: true },
      select: { id: true, itemProduzidoId: true },
    }),
  ])
  // ⚠️ o nome da ficha é o nome do ITEM produzido — o mesmo caminho que a prateleira usa
  const itens = fichas.length
    ? await db.stockItem.findMany({
      where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } },
      select: { id: true, nome: true },
    })
    : []
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeDaFicha = new Map(fichas.map((f) => [f.id, nomeItem.get(f.itemProduzidoId) ?? '(ficha)']))
  const jaMapeadas = mapeados
    // ⚠️ ficha arquivada não recruta grafia: mapear pra ela seria mandar trabalho pro lixo
    .filter((m) => m.fichaId && nomeDaFicha.has(m.fichaId))
    .map((m) => ({ nomeSuitable: m.nomeSuitable, fichaId: m.fichaId!, nomeFicha: nomeDaFicha.get(m.fichaId!)! }))

  const jaResolvidos = new Set((await db.stockVendaComplementoMap.findMany({
    where: { companyId }, select: { nomeSuitable: true },
  })).map((m) => m.nomeSuitable))
  const pendentes = catalogo
    .filter((c) => !jaResolvidos.has(c.nomeSuitable))
    .map((c) => ({ nomeSuitable: c.nomeSuitable, ocorrencias: 0 }))

  return agrupamentoAutomatico(pendentes, jaMapeadas)
}

/**
 * Aplica o plano: grava o vínculo E o rastro, na mesma transação de quem chamou.
 *
 * ⛔ NÃO abre transação própria de propósito — o nascimento da ficha precisa que o vínculo
 * entre junto com ela ("ou grava tudo, ou nada grava", a regra que consertou as 3 fichas
 * órfãs). Quem chama de fora passa o `db` da sua transação.
 */
export async function aplicarAgrupamento(
  companyId: string,
  plano: readonly AgrupamentoAutomatico[],
  origem: OrigemDoAgrupamento,
  userId?: string,
  db: Db = defaultPrisma,
): Promise<number> {
  let gravados = 0
  for (const a of plano) {
    await db.stockVendaComplementoMap.upsert({
      where: { companyId_nomeSuitable: { companyId, nomeSuitable: a.nomeSuitable } },
      create: {
        companyId, nomeSuitable: a.nomeSuitable, alvoTipo: 'FICHA',
        fichaId: a.fichaId, criadoPorId: userId ?? null,
      },
      // ⚠️ se alguém já resolveu esta grafia enquanto isto rodava, NÃO sobrescreve o destino:
      // a decisão humana ganha da regra automática, sempre.
      update: {},
    })
    // ⭐ o rastro: "entrou sem clique, via esta irmã, por esta porta"
    await db.stockVendaGrafiaAgrupada.upsert({
      where: { companyId_nomeSuitable: { companyId, nomeSuitable: a.nomeSuitable } },
      create: {
        companyId, nomeSuitable: a.nomeSuitable, fichaId: a.fichaId,
        viaGrafia: a.viaGrafia, origem,
      },
      update: {},
    })
    gravados++
  }
  return gravados
}

/**
 * O gesto completo, pras portas que não precisam de transação própria (import, retroativo).
 *
 * ⚠️ FAIL-SOFT no import: agrupar é um bônus, não a razão do gesto. Se explodir, o import
 * não pode cair junto — mesma disciplina do "commit + ponte" da baixa.
 */
export async function agruparGrafiasPendentes(
  companyId: string, origem: OrigemDoAgrupamento, userId?: string, db: PrismaClient = defaultPrisma,
): Promise<{ agrupadas: AgrupamentoAutomatico[]; erro: string | null }> {
  try {
    const plano = await planoDeAgrupamento(companyId, db)
    if (!plano.length) return { agrupadas: [], erro: null }
    await aplicarAgrupamento(companyId, plano, origem, userId, db)
    return { agrupadas: plano, erro: null }
  } catch (e) {
    return { agrupadas: [], erro: (e as Error).message }
  }
}
