// ⭐⭐ APOSENTAR A FICHA GÊMEA (17/11/2026) — duas receitas IDÊNTICAS pro mesmo prato viram UMA.
//
// ⛔ O CASO: "PIZZA GRANDE 35CM" × "Pizza Grande (35cm)" (e a Família, e o XIS COMPLETO × "XIS -
// COMPLETO"): mesmo nome sob a régua, mesmos ingredientes, mesmas quantidades, mesmo custo — dois canais
// do PDV (delivery × salão) que nasceram cada um com a sua ficha. Ficha duplicada idêntica é divergência
// esperando acontecer: o dono corrige uma e a outra segue baixando a receita velha.
//
// ⭐ O GESTO (nesta ordem):
//   1. PROVA que são gêmeas: mesmo nome sob `reguaDoNome`, canônica ATIVA, e a versão atual das duas com
//      os MESMOS componentes por unidade produzida (item · qtd/loteBase · unidade). Diferente → RECUSA:
//      unir receitas que diferem é decisão do dono, nunca da máquina.
//   2. REAPONTA os vínculos de venda (produto, complemento, grafia agrupada) da morta pra canônica —
//      daqui pra frente a grafia velha cai na canônica. ⛔ O passado NÃO se reprocessa.
//   3. a grafia da morta vira APELIDO do item da canônica (`registrarApelido`).
//   4. EXCLUI a morta pela régua da casa (R24, `excluirFicha`): sem lote → de vez; com lote → some das
//      telas e a história fica.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { reguaDoNome } from '@/lib/nomes/regua-do-nome'
import { registrarApelido } from '../itens/porta-do-nome'
import { excluirFicha, preverExclusaoDaFicha, type ResultadoDaExclusao } from './excluir-ficha'

export class FichaGemeaError extends Error { constructor(m: string) { super(m); this.name = 'FichaGemeaError' } }

/** a receita por UNIDADE produzida, como chave comparável (ordem não importa) */
async function receitaPorUnidade(db: PrismaClient, companyId: string, fichaId: string, versaoAtual: number): Promise<string> {
  const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId, versao: versaoAtual }, select: { id: true, loteBase: true } })
  if (!v || !(v.loteBase > 0)) throw new FichaGemeaError('Receita sem versão atual válida.')
  const cs = await db.stockFichaComponente.findMany({ where: { versaoId: v.id }, select: { itemId: true, qtdPlanejada: true, unidade: true } })
  return cs.map((c) => `${c.itemId}|${Number((c.qtdPlanejada / v.loteBase).toFixed(6))}|${c.unidade}`).sort().join('\n')
}

export interface ResultadoDaGemea {
  morta: string
  canonica: string
  reapontados: { produto: string[]; complemento: string[]; grafia: string[] }
  exclusao: ResultadoDaExclusao
}

export async function aposentarFichaGemea(
  input: { companyId: string; mortaFichaId: string; canonicaFichaId: string; userId: string | null },
  db: PrismaClient = defaultPrisma,
): Promise<ResultadoDaGemea> {
  const { companyId, mortaFichaId, canonicaFichaId } = input
  if (mortaFichaId === canonicaFichaId) throw new FichaGemeaError('Escolha duas receitas diferentes.')
  const fichas = await db.stockFicha.findMany({
    where: { companyId, id: { in: [mortaFichaId, canonicaFichaId] } },
    select: { id: true, ativo: true, itemProduzidoId: true, versaoAtual: true },
  })
  const morta = fichas.find((f) => f.id === mortaFichaId)
  const canon = fichas.find((f) => f.id === canonicaFichaId)
  if (!morta || !canon) throw new FichaGemeaError('Receita não encontrada nesta empresa.')
  if (!canon.ativo) throw new FichaGemeaError('A receita que fica precisa estar ativa.')
  const itens = new Map((await db.stockItem.findMany({
    where: { companyId, id: { in: [morta.itemProduzidoId, canon.itemProduzidoId] } }, select: { id: true, nome: true },
  })).map((i) => [i.id, i.nome]))
  const nomeMorta = itens.get(morta.itemProduzidoId) ?? ''
  const nomeCanon = itens.get(canon.itemProduzidoId) ?? ''
  // ⛔ 1 · a prova de gêmeas — a máquina só une o que é IGUAL
  if (!nomeMorta || reguaDoNome(nomeMorta) !== reguaDoNome(nomeCanon)) {
    throw new FichaGemeaError(`"${nomeMorta}" e "${nomeCanon}" não são o mesmo nome — unir é decisão do dono.`)
  }
  const [rm, rc] = await Promise.all([
    receitaPorUnidade(db, companyId, morta.id, morta.versaoAtual),
    receitaPorUnidade(db, companyId, canon.id, canon.versaoAtual),
  ])
  if (rm !== rc) throw new FichaGemeaError(`As receitas de "${nomeMorta}" e "${nomeCanon}" diferem — unir é decisão do dono.`)
  const previa = await preverExclusaoDaFicha(companyId, morta.id, db)
  if (previa.usadaEmFichas.length) throw new FichaGemeaError(`"${nomeMorta}" é ingrediente de ${previa.usadaEmFichas.join(', ')} — troque lá antes.`)

  // ⭐ 2 + 3 · reaponta e grava o apelido, juntos
  const reapontados = await db.$transaction(async (tx) => {
    const w = { companyId, fichaId: morta.id }
    const [p, c, g] = await Promise.all([
      tx.stockVendaProdutoMap.findMany({ where: w, select: { nomeSuitable: true } }),
      tx.stockVendaComplementoMap.findMany({ where: w, select: { nomeSuitable: true } }),
      tx.stockVendaGrafiaAgrupada.findMany({ where: w, select: { nomeSuitable: true } }),
    ])
    await tx.stockVendaProdutoMap.updateMany({ where: w, data: { fichaId: canon.id } })
    await tx.stockVendaComplementoMap.updateMany({ where: w, data: { fichaId: canon.id } })
    await tx.stockVendaGrafiaAgrupada.updateMany({ where: w, data: { fichaId: canon.id } })
    await registrarApelido(tx, companyId, canon.itemProduzidoId, nomeMorta, input.userId)
    return { produto: p.map((x) => x.nomeSuitable), complemento: c.map((x) => x.nomeSuitable), grafia: g.map((x) => x.nomeSuitable) }
  })

  // ⭐ 4 · a régua da casa decide entre apagar e sumir das telas
  const exclusao = await excluirFicha(companyId, morta.id, db, input.userId ?? undefined)
  return { morta: nomeMorta, canonica: nomeCanon, reapontados, exclusao }
}
