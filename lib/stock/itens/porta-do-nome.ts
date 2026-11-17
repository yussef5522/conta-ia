// ⭐⭐ A PORTA DO NOME DE ITEM (16/11/2026) — gêmeo igual-sob-a-régua NÃO NASCE MAIS.
//
// ⛔ O CASO: 13 grupos de gêmeos no estoque da Caçula ("tomate" × "TOMATE", "ACUCAR " × "acucar",
// "COCA-COLA  2L" × "COCA COLA 2L"…) espalhando histórico e envenenando réguas. Cada caminho de criação
// tinha a sua régua (nome exato, `trim().toLowerCase()`, `normalizarBusca` com pontuação) — e cada uma
// deixava passar um tipo de gêmeo.
//
// ⭐ A REGRA: antes de criar, todo caminho pergunta AQUI. Caminho AUTOMÁTICO (nota fiscal, revenda nascida
// do nome do PDV) USA o existente — e grava a grafia nova como APELIDO (`stock_item_nome_anterior`), pra a
// próxima chegar sozinha. Caminho HUMANO pergunta "já existe X — usar o existente ou criar mesmo assim?".
//
// ⚠️ "Comparável" não é só o nome: é a MESMA PRATELEIRA (mesma categoria, ou as duas físicas). A receita
// de venda (PRODUTO_FINAL/SABOR) que tem o MESMO nome da garrafa que ela baixa é desenho da casa (a ficha
// de passagem), não gêmeo — e fundir as duas faria a ficha consumir o próprio produto.
import type { PrismaClient, Prisma } from '@prisma/client'
import { reguaDoNome } from '@/lib/nomes/regua-do-nome'
import { seContaFisicamente } from '../tipos-ficha'

type Db = PrismaClient | Prisma.TransactionClient

/** as duas categorias moram na mesma prateleira? (só aí nome igual é gêmeo) */
export function mesmaPrateleira(a: string, b: string): boolean {
  return a === b || (seContaFisicamente(a) && seContaFisicamente(b))
}

export interface ItemDoNome { id: string; nome: string; categoria: string; unidadeControle: string; via: 'NOME' | 'APELIDO' }

/**
 * ⭐ O item ATIVO que já tem este nome sob a régua (pelo nome ou por um APELIDO), na mesma prateleira
 * da categoria pedida. `null` = pode criar.
 */
export async function itemComMesmoNome(
  db: Db, companyId: string, nome: string, categoria: string, opts: { excetoId?: string } = {},
): Promise<ItemDoNome | null> {
  const alvo = reguaDoNome(nome)
  if (!alvo) return null
  const ativos = await db.stockItem.findMany({
    where: { companyId, ativo: true, ...(opts.excetoId ? { id: { not: opts.excetoId } } : {}) },
    select: { id: true, nome: true, categoria: true, unidadeControle: true },
  })
  const comparaveis = ativos.filter((i) => mesmaPrateleira(i.categoria, categoria))
  const porNome = comparaveis.find((i) => reguaDoNome(i.nome) === alvo)
  if (porNome) return { ...porNome, via: 'NOME' }
  const ids = new Map(comparaveis.map((i) => [i.id, i]))
  const apelidos = await db.stockItemNomeAnterior.findMany({ where: { companyId }, select: { itemId: true, nomeAnterior: true } })
  const ap = apelidos.find((a) => ids.has(a.itemId) && reguaDoNome(a.nomeAnterior) === alvo)
  return ap ? { ...ids.get(ap.itemId)!, via: 'APELIDO' } : null
}

/** grava a grafia como APELIDO do item (idempotente; não grava a própria grafia do item) */
export async function registrarApelido(db: Db, companyId: string, itemId: string, grafia: string, userId: string | null): Promise<void> {
  const g = grafia.trim()
  if (!g) return
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { nome: true } })
  if (!item || item.nome.trim() === g) return
  await db.stockItemNomeAnterior.upsert({
    where: { companyId_itemId_nomeAnterior: { companyId, itemId, nomeAnterior: g } },
    create: { companyId, itemId, nomeAnterior: g, renomeadoPorId: userId },
    update: {},
  })
}

/** a pergunta do caminho humano, com o nome de quem já existe */
export const perguntaJaExiste = (i: ItemDoNome) => `Já existe “${i.nome}” — usar o existente ou criar mesmo assim?`
