// ⭐⭐ RENOMEAR ITENS EM LOTE, COM REVISÃO DO DONO (09/09/2026).
//
// **O dono:** *"EU reviso: edito na linha e confirmo em lote. Nada renomeia sozinho."*
//
// ⭐⭐ **O QUE FOI CONFERIDO ANTES DO PRIMEIRO RENAME** (ele exigiu, e a resposta é boa):
// **nenhum vínculo do módulo é por NOME do item.**
//   fornecedor → produto   `stock_supplier_product` chaveado por (cnpj, cProd) → **itemId**
//   ficha                  `stock_ficha_componente.itemId`                     → **id**
//   histórico/saldo        `stock_movement.itemId`                             → **id**
//   mapa de venda          `stock_venda_produto_map.itemId/fichaId`            → **id**
//   contagem               `stock_contagem_item.itemId`                        → **id**
//
// ⚠️ **A ÚNICA busca por nome do módulo** é `confirmar-conferencia.ts:121`, e ela **não é
// vínculo**: só roda quando o operador escolhe *"criar item novo"* naquela linha da nota, pra
// não duplicar um nome que já existe. O caminho normal resolve pelo mapa (cProd → itemId).
// **CONSEQUÊNCIA REGISTRADA:** se um dia chegar um cProd NOVO e o operador digitar o nome
// ANTIGO em "criar item novo", a dedup por nome exato não casaria mais e nasceria um
// duplicado. O apelido fecha esse flanco — por isso ele não é enfeite.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarBusca } from '@/lib/busca-texto'
import { sugerirNomeLimpo, pareceNomeDeNota, type SugestaoDeNome } from './nome-limpo'
import { seContaFisicamente } from '../tipos-ficha'

export class RenomearError extends Error {}

export interface LinhaParaRevisar extends SugestaoDeNome {
  itemId: string
  nomeAtual: string
  categoria: string
  saldo: number
  /** apelidos que o item já tem (renames anteriores) */
  apelidos: string[]
}

/**
 * ⭐ A LISTA QUE O DONO REVISA. Só LÊ — abrir a tela não renomeia nada.
 *
 * ⚠️ Traz também o nome do CARDÁPIO quando o item é alvo de um mapa de venda (direto, ou por
 * ficha passa-direto de 1 componente ×1): é atalho de um clique, **não** a sugestão.
 */
export async function itensParaRevisarNome(
  companyId: string, db: PrismaClient = defaultPrisma,
): Promise<LinhaParaRevisar[]> {
  const itens = await db.stockItem.findMany({
    where: { companyId, ativo: true },
    select: { id: true, nome: true, categoria: true },
    orderBy: { nome: 'asc' },
  })
  const candidatos = itens.filter((i) => pareceNomeDeNota(i.nome))
  if (!candidatos.length) return []

  const ids = candidatos.map((i) => i.id)
  const [saldos, apelidos, nomesDeCardapio] = await Promise.all([
    db.stockMovement.groupBy({
      by: ['itemId'],
      where: { companyId, itemId: { in: ids }, tipo: { not: 'PRODUCAO_CONSUMO' } },
      _sum: { quantidade: true },
    }),
    db.stockItemNomeAnterior.findMany({ where: { companyId, itemId: { in: ids } }, select: { itemId: true, nomeAnterior: true } }),
    nomeDoCardapioPorItem(companyId, db),
  ])
  const saldo = new Map(saldos.map((s) => [s.itemId, Math.round(((s._sum.quantidade ?? 0) + 1e-9) * 100) / 100]))
  const apel = new Map<string, string[]>()
  for (const a of apelidos) apel.set(a.itemId, [...(apel.get(a.itemId) ?? []), a.nomeAnterior])

  return candidatos.map((i) => ({
    itemId: i.id,
    nomeAtual: i.nome,
    categoria: i.categoria,
    saldo: saldo.get(i.id) ?? 0,
    apelidos: apel.get(i.id) ?? [],
    ...sugerirNomeLimpo(i.nome, { doCardapio: nomesDeCardapio.get(i.id) ?? null }),
  }))
}

/** o nome do PDV que cai neste item (direto, ou via ficha de 1 componente ×1) */
async function nomeDoCardapioPorItem(companyId: string, db: PrismaClient): Promise<Map<string, string>> {
  const maps = await db.stockVendaProdutoMap.findMany({
    where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true },
  })
  const out = new Map<string, string>()
  const fichaIds = maps.map((m) => m.fichaId).filter((x): x is string => !!x)
  const fichas = fichaIds.length
    ? await db.stockFicha.findMany({ where: { companyId, id: { in: fichaIds } }, select: { id: true, versaoAtual: true } })
    : []
  const versoes = fichas.length
    ? await db.stockFichaVersao.findMany({ where: { fichaId: { in: fichas.map((f) => f.id) } }, select: { id: true, fichaId: true, versao: true } })
    : []
  const comps = versoes.length
    ? await db.stockFichaComponente.findMany({ where: { versaoId: { in: versoes.map((v) => v.id) } }, select: { versaoId: true, itemId: true, qtdPlanejada: true } })
    : []

  for (const m of maps) {
    if (m.alvoTipo === 'REVENDA' && m.itemId) { out.set(m.itemId, m.nomeSuitable); continue }
    if (!m.fichaId) continue
    const f = fichas.find((x) => x.id === m.fichaId)
    const v = versoes.find((x) => x.fichaId === m.fichaId && x.versao === f?.versaoAtual)
    if (!v) continue
    const c = comps.filter((x) => x.versaoId === v.id)
    if (c.length === 1 && c[0].qtdPlanejada === 1) out.set(c[0].itemId, m.nomeSuitable)
  }
  return out
}

export interface RenomeioPedido { itemId: string; nomeNovo: string }
export interface ResultadoRenomeio {
  aplicados: { itemId: string; de: string; para: string }[]
  pulados: { itemId: string; motivo: string }[]
}

/**
 * ⭐⭐ APLICA O LOTE — e o nome ANTIGO vira apelido de busca, com o autor no rastro.
 *
 * ⛔ Numa transação só: *"ou grava tudo, ou nada grava"*. Meia renomeação deixaria a Posição
 * com metade dos nomes novos e o dono sem saber quais.
 */
export async function renomearEmLote(
  input: { companyId: string; userId?: string | null; pedidos: RenomeioPedido[] },
  db: PrismaClient = defaultPrisma,
): Promise<ResultadoRenomeio> {
  const pedidos = input.pedidos.filter((p) => p.nomeNovo.trim())
  if (!pedidos.length) throw new RenomearError('Nenhum nome pra confirmar.')

  const itens = await db.stockItem.findMany({
    where: { companyId: input.companyId, id: { in: pedidos.map((p) => p.itemId) } },
    select: { id: true, nome: true },
  })
  const atual = new Map(itens.map((i) => [i.id, i.nome]))

  // ⛔ dois itens não podem terminar com o MESMO nome: a busca deixaria de distinguir, e o
  // guard de "já existe item com esse nome" passaria a acusar pra sempre.
  // ⚠️ SÓ ITEM DE PRATELEIRA DISPUTA O NOME (09/09). O invólucro de ficha é a linha do
  // cardápio e leva o nome do PDV de propósito — bloquear o rename da garrafa porque a
  // RECEITA já usa aquele nome seria o guard impedindo exatamente o desenho.
  const todosOsNomes = (await db.stockItem.findMany({
    where: { companyId: input.companyId, ativo: true }, select: { id: true, nome: true, categoria: true },
  })).filter((i) => seContaFisicamente(i.categoria))
  const ocupados = new Map(todosOsNomes.map((i) => [normalizarBusca(i.nome), i.id]))

  const aplicados: ResultadoRenomeio['aplicados'] = []
  const pulados: ResultadoRenomeio['pulados'] = []

  await db.$transaction(async (tx) => {
    for (const p of pedidos) {
      const de = atual.get(p.itemId)
      if (!de) { pulados.push({ itemId: p.itemId, motivo: 'item não é desta empresa' }); continue }
      const para = p.nomeNovo.trim()
      if (para === de) { pulados.push({ itemId: p.itemId, motivo: 'nome igual ao atual' }); continue }
      const dono = ocupados.get(normalizarBusca(para))
      if (dono && dono !== p.itemId) {
        pulados.push({ itemId: p.itemId, motivo: `“${para}” já é o nome de outro item` })
        continue
      }
      await tx.stockItem.update({ where: { id: p.itemId }, data: { nome: para } })
      // ⭐ o nome velho vira APELIDO — e o `upsert` deixa renomear duas vezes sem estourar
      await tx.stockItemNomeAnterior.upsert({
        where: { companyId_itemId_nomeAnterior: { companyId: input.companyId, itemId: p.itemId, nomeAnterior: de } },
        create: { companyId: input.companyId, itemId: p.itemId, nomeAnterior: de, renomeadoPorId: input.userId ?? null },
        update: {},
      })
      ocupados.set(normalizarBusca(para), p.itemId)
      ocupados.delete(normalizarBusca(de))
      aplicados.push({ itemId: p.itemId, de, para })
    }
  })
  return { aplicados, pulados }
}

/** ⭐ os apelidos por item — a busca soma isto ao nome pra "CC 600" achar a COCA COLA 600ML */
export async function apelidosPorItem(
  companyId: string, itemIds: string[], db: PrismaClient = defaultPrisma,
): Promise<Map<string, string[]>> {
  if (!itemIds.length) return new Map()
  const rows = await db.stockItemNomeAnterior.findMany({
    where: { companyId, itemId: { in: itemIds } }, select: { itemId: true, nomeAnterior: true },
  })
  const out = new Map<string, string[]>()
  for (const r of rows) out.set(r.itemId, [...(out.get(r.itemId) ?? []), r.nomeAnterior])
  return out
}
