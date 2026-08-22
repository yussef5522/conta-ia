// ESTOQUE PARTE B — LANÇAMENTO MANUAL de vendas (tipo PDV, pros dias sem o arquivo do
// Suitable ou complementar). O dono escolhe o vendável (PRODUTO_FINAL|REVENDA — mesmo guard
// 3 níveis) + quantidade → MESMO fluxo preview/confirmar/recibo do import. Convive com o
// import do dia (mescla as linhas por nome) e o reprocessar cobre os dois. Só stock_.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { montarPlanoDeLinhas, reprocessarDia, type PlanoVenda, type ReciboVenda, type LinhaVenda } from './baixa-venda'
import { upsertVendaMap } from './venda-map'

export interface EntradaManual { alvoTipo: 'FICHA' | 'REVENDA'; alvoId: string; quantidade: number }

/** Vendáveis pro PDV manual: fichas PRODUTO_FINAL + itens REVENDA (o guard dos 3 níveis). */
export async function listVendaveis(companyId: string, db: PrismaClient = defaultPrisma) {
  const [fichas, itens] = await Promise.all([
    db.stockFicha.findMany({ where: { companyId, ativo: true, tipoProduto: 'PRODUTO_FINAL' }, select: { id: true, itemProduzidoId: true } }),
    db.stockItem.findMany({ where: { companyId, ativo: true, categoria: 'REVENDA' }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ])
  const produzidoIds = fichas.map((f) => f.itemProduzidoId)
  const nomes = new Map((produzidoIds.length ? await db.stockItem.findMany({ where: { companyId, id: { in: produzidoIds } }, select: { id: true, nome: true } }) : []).map((i) => [i.id, i.nome]))
  return {
    fichas: fichas.map((f) => ({ alvoTipo: 'FICHA' as const, alvoId: f.id, nome: nomes.get(f.itemProduzidoId) ?? '(produto)' })).sort((a, b) => a.nome.localeCompare(b.nome)),
    itens: itens.map((i) => ({ alvoTipo: 'REVENDA' as const, alvoId: i.id, nome: i.nome })),
  }
}

// resolve entradas → nome de exibição do alvo, garante o mapa (nome→alvo) pra o reprocesso cobrir
async function resolverEntradas(companyId: string, entradas: EntradaManual[], userId: string | undefined, db: PrismaClient): Promise<Map<string, number>> {
  const vend = await listVendaveis(companyId, db)
  const nomePorAlvo = new Map<string, string>()
  for (const v of [...vend.fichas, ...vend.itens]) nomePorAlvo.set(`${v.alvoTipo}:${v.alvoId}`, v.nome)
  const porNome = new Map<string, number>()
  for (const e of entradas) {
    if (!(e.quantidade > 0)) continue
    const nome = nomePorAlvo.get(`${e.alvoTipo}:${e.alvoId}`)
    if (!nome) continue
    await upsertVendaMap(companyId, nome, e.alvoTipo === 'FICHA' ? { tipo: 'FICHA', fichaId: e.alvoId } : { tipo: 'REVENDA', itemId: e.alvoId }, userId, db)
    porNome.set(nome, (porNome.get(nome) ?? 0) + e.quantidade)
  }
  return porNome
}

// mescla as entradas manuais com as linhas JÁ gravadas do dia (por nome) — convive com o import
async function linhasMescladas(companyId: string, data: string, manuais: Map<string, number>, db: PrismaClient): Promise<LinhaVenda[]> {
  const dataDate = new Date(`${data}T12:00:00`)
  const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: dataDate } }, select: { id: true } })
  const existentes = imp ? await db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } }) : []
  const porNome = new Map<string, LinhaVenda>()
  for (const l of existentes) porNome.set(l.nomeSuitable, { produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal })
  for (const [nome, qtd] of manuais) porNome.set(nome, { produto: nome, quantidade: qtd, valorTotal: 0 }) // manual REPÕE por nome
  return [...porNome.values()]
}

export async function previewLancamentoManual(companyId: string, data: string, entradas: EntradaManual[], userId: string | undefined, db: PrismaClient = defaultPrisma): Promise<PlanoVenda> {
  const manuais = await resolverEntradas(companyId, entradas, userId, db)
  const linhas = await linhasMescladas(companyId, data, manuais, db)
  return montarPlanoDeLinhas(companyId, data, linhas, null, db)
}

export async function confirmarLancamentoManual(companyId: string, data: string, entradas: EntradaManual[], userId: string | undefined, db: PrismaClient = defaultPrisma): Promise<ReciboVenda> {
  // garante o mapa (nome→alvo) e monta as linhas mescladas (Suitable do dia + manual por nome)
  const manuais = await resolverEntradas(companyId, entradas, userId, db)
  const linhas = await linhasMescladas(companyId, data, manuais, db)
  const dataDate = new Date(`${data}T12:00:00`)
  const imp = await db.stockVendaImport.upsert({ where: { companyId_data: { companyId, data: dataDate } }, create: { companyId, data: dataDate, totalLinhas: linhas.length, totalUnidades: linhas.reduce((s, l) => s + l.quantidade, 0), status: 'CONFIRMADO', criadoPorId: userId ?? null }, update: {}, select: { id: true } })
  await db.stockVendaLinha.deleteMany({ where: { companyId, importId: imp.id } })
  const mapaNomes = new Set((await db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } })).map((m) => m.nomeSuitable))
  await db.stockVendaLinha.createMany({ data: linhas.map((l) => ({ companyId, importId: imp.id, data: dataDate, nomeSuitable: l.produto, quantidade: l.quantidade, valorTotal: l.valorTotal, mapeadoNoImport: mapaNomes.has(l.produto) })) })
  return reprocessarDia(companyId, data, userId, db)
}
