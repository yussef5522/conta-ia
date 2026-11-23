// ⭐⭐ R43 — AS ZONAS SÃO DO DONO (23/11/2026, docs/contagem-referencia.html).
//
// Criar, renomear e EXCLUIR de verdade. ⛔⛔ EXCLUIR ZONA NUNCA APAGA ITEM (R23/R24 da casa): só
// as linhas de `stock_contagem_zona_item` dela somem — os itens ficam "sem zona" e aparecem pra
// realocar; a confirmação diz QUANTOS. O dono escolhe QUAIS itens moram na zona (um item mora
// numa zona só — adicionar em outra MUDA de casa) e a ORDEM (o caminho que a equipe anda).
// Grupo A/B/C e ritmo por grupo também são cliques do dono — nada nasce sozinho.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { CATEGORIAS_SEM_PRATELEIRA } from '@/lib/stock/tipos-ficha'
import { DirecaoError } from './direcao-dados'
import { GRUPOS, type Grupo } from './direcao'

const NOME_MAX = 40

function nomeLimpo(nome: string): string {
  const n = (nome ?? '').trim().replace(/\s+/g, ' ')
  if (!n) throw new DirecaoError('Dê um nome pra zona.')
  if (n.length > NOME_MAX) throw new DirecaoError(`Nome de zona tem no máximo ${NOME_MAX} letras.`)
  return n
}

async function zonaDaEmpresa(companyId: string, zonaId: string, db: PrismaClient) {
  const z = await db.stockContagemZona.findFirst({ where: { id: zonaId, companyId } })
  if (!z) throw new DirecaoError('Essa zona não existe mais — recarregue a tela.', 'NAO_EXISTE', 404)
  return z
}

async function itemDaEmpresa(companyId: string, itemId: string, db: PrismaClient) {
  const i = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, nome: true } })
  if (!i) throw new DirecaoError('Esse item não existe nesta empresa.', 'NAO_EXISTE', 404)
  return i
}

async function nomeLivre(companyId: string, nome: string, exceto: string | null, db: PrismaClient) {
  const outras = await db.stockContagemZona.findMany({ where: { companyId }, select: { id: true, nome: true } })
  if (outras.some((z) => z.id !== exceto && z.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) {
    throw new DirecaoError(`Já existe uma zona chamada “${nome}”.`, 'NOME_REPETIDO', 409)
  }
}

export async function criarZona(companyId: string, nome: string, userId: string, db: PrismaClient = defaultPrisma) {
  const n = nomeLimpo(nome)
  await nomeLivre(companyId, n, null, db)
  return db.stockContagemZona.create({ data: { companyId, nome: n, criadoPorId: userId } })
}

export async function renomearZona(companyId: string, zonaId: string, nome: string, db: PrismaClient = defaultPrisma) {
  await zonaDaEmpresa(companyId, zonaId, db)
  const n = nomeLimpo(nome)
  await nomeLivre(companyId, n, zonaId, db)
  return db.stockContagemZona.update({ where: { id: zonaId }, data: { nome: n } })
}

/** quantos itens ficariam "sem zona" — a frase da confirmação */
export async function itensDaZona(companyId: string, zonaId: string, db: PrismaClient = defaultPrisma): Promise<number> {
  return db.stockContagemZonaItem.count({ where: { companyId, zonaId } })
}

/**
 * ⛔⛔ EXCLUIR: some a zona e os VÍNCULOS dela; o `stock_item` não é tocado.
 * Devolve quantos itens ficaram sem zona.
 */
export async function excluirZona(companyId: string, zonaId: string, db: PrismaClient = defaultPrisma): Promise<{ itensSemZona: number }> {
  await zonaDaEmpresa(companyId, zonaId, db)
  const [soltos] = await db.$transaction([
    db.stockContagemZonaItem.deleteMany({ where: { companyId, zonaId } }),
    db.stockContagemZona.delete({ where: { id: zonaId } }),
  ])
  return { itensSemZona: soltos.count }
}

/** adicionar item à zona — ele vai pro FIM do caminho; se morava noutra zona, muda de casa */
export async function adicionarItemNaZona(companyId: string, zonaId: string, itemId: string, userId: string, db: PrismaClient = defaultPrisma) {
  await zonaDaEmpresa(companyId, zonaId, db)
  await itemDaEmpresa(companyId, itemId, db)
  const ult = await db.stockContagemZonaItem.findFirst({ where: { companyId, zonaId }, orderBy: { ordem: 'desc' }, select: { ordem: true } })
  const ordem = (ult?.ordem ?? 0) + 1
  return db.stockContagemZonaItem.upsert({
    where: { companyId_itemId: { companyId, itemId } },
    create: { companyId, zonaId, itemId, ordem, definidoPorId: userId },
    update: { zonaId, ordem, definidoPorId: userId },
  })
}

/** remover na linha: o item volta a ser "sem zona" (nunca some da contagem) */
export async function removerItemDaZona(companyId: string, itemId: string, db: PrismaClient = defaultPrisma) {
  await db.stockContagemZonaItem.deleteMany({ where: { companyId, itemId } })
}

/** o arrastar: a ordem inteira da zona, renumerada 1..N */
export async function ordenarZona(companyId: string, zonaId: string, itemIds: string[], userId: string, db: PrismaClient = defaultPrisma) {
  await zonaDaEmpresa(companyId, zonaId, db)
  const daZona = await db.stockContagemZonaItem.findMany({ where: { companyId, zonaId }, select: { itemId: true } })
  const set = new Set(daZona.map((z) => z.itemId))
  if (itemIds.length !== set.size || itemIds.some((i) => !set.has(i))) {
    throw new DirecaoError('A lista mudou enquanto você arrastava — recarregue a tela.', 'LISTA_MUDOU', 409)
  }
  await db.$transaction(itemIds.map((itemId, k) =>
    db.stockContagemZonaItem.update({ where: { companyId_itemId: { companyId, itemId } }, data: { ordem: k + 1, definidoPorId: userId } })))
}

/** R36 — o grupo do item. `grupo: null` = ignorar o candidato (sai da fila de candidatos). */
export async function definirGrupo(companyId: string, itemId: string, grupo: Grupo | null, userId: string, db: PrismaClient = defaultPrisma) {
  if (grupo != null && !GRUPOS.includes(grupo)) throw new DirecaoError('Grupo é A, B ou C.')
  await itemDaEmpresa(companyId, itemId, db)
  const data = { grupo, ignorado: grupo == null, definidoPorId: userId }
  return db.stockItemGrupo.upsert({ where: { companyId_itemId: { companyId, itemId } }, create: { companyId, itemId, ...data }, update: data })
}

export async function definirRitmo(companyId: string, r: { A: number; B: number; C: number }, userId: string, db: PrismaClient = defaultPrisma) {
  for (const g of GRUPOS) {
    if (!Number.isInteger(r[g]) || r[g] < 1 || r[g] > 366) throw new DirecaoError(`O ritmo do grupo ${g} é de 1 a 366 dias.`)
  }
  const data = { diasA: r.A, diasB: r.B, diasC: r.C, definidoPorId: userId }
  return db.stockContagemRitmo.upsert({ where: { companyId }, create: { companyId, ...data }, update: data })
}

export interface ZonasDoDono {
  zonas: { id: string; nome: string; itens: { itemId: string; nome: string; grupo: Grupo | null }[] }[]
  semZona: { itemId: string; nome: string; grupo: Grupo | null }[]
  itens: { itemId: string; nome: string; zonaId: string | null }[]
}

/** a tela "gerenciar zonas": cada zona com os itens NA ORDEM, e o "sem zona" no fim */
export async function zonasDoDono(companyId: string, db: PrismaClient = defaultPrisma): Promise<ZonasDoDono> {
  const [zonas, vinculos, itens, grupos] = await Promise.all([
    db.stockContagemZona.findMany({ where: { companyId }, orderBy: [{ criadoEm: 'asc' }, { nome: 'asc' }] }),
    db.stockContagemZonaItem.findMany({ where: { companyId }, orderBy: { ordem: 'asc' } }),
    db.stockItem.findMany({
      where: { companyId, ativo: true, categoria: { notIn: [...CATEGORIAS_SEM_PRATELEIRA] } },
      select: { id: true, nome: true }, orderBy: { nome: 'asc' },
    }),
    db.stockItemGrupo.findMany({ where: { companyId }, select: { itemId: true, grupo: true } }),
  ])
  const nome = new Map(itens.map((i) => [i.id, i.nome]))
  const grupo = new Map(grupos.map((g) => [g.itemId, (g.grupo as Grupo | null) ?? null]))
  const zonaDe = new Map<string, string>()
  const out: ZonasDoDono['zonas'] = zonas.map((z) => ({ id: z.id, nome: z.nome, itens: [] }))
  const porZona = new Map(out.map((z) => [z.id, z]))
  for (const v of vinculos) {
    const z = porZona.get(v.zonaId)
    if (!z || !nome.has(v.itemId)) continue
    zonaDe.set(v.itemId, v.zonaId)
    z.itens.push({ itemId: v.itemId, nome: nome.get(v.itemId)!, grupo: grupo.get(v.itemId) ?? null })
  }
  return {
    zonas: out,
    semZona: itens.filter((i) => !zonaDe.has(i.id)).map((i) => ({ itemId: i.id, nome: i.nome, grupo: grupo.get(i.id) ?? null })),
    itens: itens.map((i) => ({ itemId: i.id, nome: i.nome, zonaId: zonaDe.get(i.id) ?? null })),
  }
}
