// ⭐⭐ A FILA DE CASAMENTO ASSISTIDO (16/11/2026) — o PARECIDO vira pergunta, nunca fusão.
//
// ⛔ A máquina NUNCA funde por semelhança. Par parecido-mas-não-igual sob a régua vira sugestão no
// sininho com dois botões: "juntar" (funde pelo `mesclarItens`, com a prova de saldo) e "são diferentes"
// (grava a resposta em `stock_item_par_decidido` e o par nunca mais é sugerido).
//
// ⭐ O "PARECIDO" (régua determinística, sobre a chave de `reguaDoNome`, mesma unidade e prateleira):
//   · as palavras de um estão TODAS no outro e o menor tem 2+ palavras ("MAIONESE CASEIRA" ⊂
//     "MAIONESE CASEIRA COM ALHO") — 1 palavra só ("QUEIJO") casaria metade do catálogo;
//   · ou só o ESPAÇO difere ("COCACOLA 2L" × "COCA COLA 2L");
//   · ou UMA palavra longa (4+ letras) tem erro de digitação (≤2 letras), sem mudar dígito — "MUSSARELA" ×
//     "MUSSARELLA". ⛔ Palavra curta trocada é outro produto (SEM/COM, P/M/G/GG); 1L × 2L também.
// Receita de venda (PRODUTO_FINAL/SABOR) fica fora: ela não se funde por item (`mesclarItens` recusa).
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { reguaDoNome } from '@/lib/nomes/regua-do-nome'
import { registrarAviso, resolverAviso } from '@/lib/avisos/central'
import { mesmaPrateleira } from './porta-do-nome'
import { mesclarItens } from './mesclar'
import { saldoItem } from '../saldo'
import { escolherCanonico } from './unificar-gemeos'

export const ORIGEM_GEMEOS = 'GEMEOS_SUSPEITOS'
const RECEITA = new Set(['PRODUTO_FINAL', 'SABOR'])

export class ParError extends Error { constructor(m: string) { super(m); this.name = 'ParError' } }

/** distância de edição (Levenshtein) — chaves curtas, custo desprezível */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
const digitos = (s: string) => s.replace(/\D/g, '')

/** ⭐ A RÉGUA DO PARECIDO, pura: duas chaves (já pela régua oficial) — nunca iguais */
export function saoParecidos(ka: string, kb: string): boolean {
  if (!ka || !kb || ka === kb) return false
  const ta = ka.split(' '), tb = kb.split(' ')
  const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  if (menor.length >= 2 && menor.every((t) => maior.includes(t))) return true
  // ⭐ só ESPAÇO de diferença: "COCACOLA 2L" × "COCA COLA 2L"
  if (ka.replace(/ /g, '') === kb.replace(/ /g, '')) return true
  // ⭐ ERRO DE DIGITAÇÃO numa palavra LONGA: mesmo nº de palavras, UMA difere, as duas com 4+ letras, até 2
  // letras de diferença e sem mudar dígito. ⛔ (16/11, medido em prod: 19 pares, a maioria falsa) troca de
  // palavra CURTA é OUTRO produto — "AGUA SEM GAS" × "AGUA COM GAS", camiseta "TAM G" × "TAM GG",
  // "caixa frango P" × "M" — e alarme falso repetido é como um alarme morre.
  if (ta.length === tb.length) {
    const dif = ta.map((t, i) => [t, tb[i]] as const).filter(([x, y]) => x !== y)
    if (dif.length === 1) {
      const [x, y] = dif[0]
      if (x.length >= 4 && y.length >= 4 && digitos(x) === digitos(y) && distancia(x, y) <= 2) return true
    }
  }
  return false
}

export interface ItemDoPar { id: string; nome: string; categoria: string; unidadeControle: string }
export interface ParSuspeito { a: ItemDoPar; b: ItemDoPar }

const ordenar = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x])

/** ⭐ os pares abertos (sem decisão do dono) */
export async function paresSuspeitos(companyId: string, db: PrismaClient = defaultPrisma): Promise<ParSuspeito[]> {
  const itens = (await db.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true, categoria: true, unidadeControle: true } }))
    .filter((i) => !RECEITA.has(i.categoria))
  const decididos = new Set((await db.stockItemParDecidido.findMany({ where: { companyId }, select: { itemAId: true, itemBId: true } })).map((p) => `${p.itemAId}|${p.itemBId}`))
  const chave = new Map(itens.map((i) => [i.id, reguaDoNome(i.nome)]))
  const out: ParSuspeito[] = []
  for (let x = 0; x < itens.length; x++) for (let y = x + 1; y < itens.length; y++) {
    const a = itens[x], b = itens[y]
    if (a.unidadeControle !== b.unidadeControle || !mesmaPrateleira(a.categoria, b.categoria)) continue
    if (!saoParecidos(chave.get(a.id)!, chave.get(b.id)!)) continue
    const [ia, ib] = ordenar(a.id, b.id)
    if (decididos.has(`${ia}|${ib}`)) continue
    out.push(ia === a.id ? { a, b } : { a: b, b: a })
  }
  return out.sort((p, q) => p.a.nome.localeCompare(q.a.nome, 'pt-BR'))
}

/**
 * ⭐ A RESPOSTA DO DONO. JUNTAR funde (o canônico pela régua do dono: mais movimentos → saldo ≠ 0 → mais
 * recente) com a prova do `mesclarItens`; DIFERENTES grava e cala o par. ⛔ Só com autor (rota com sessão).
 */
export async function decidirPar(
  input: { companyId: string; itemXId: string; itemYId: string; decisao: 'JUNTAR' | 'DIFERENTES'; userId: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ decisao: 'JUNTADOS' | 'DIFERENTES'; sobreviventeId?: string; saldoAntes?: number; saldoDepois?: number }> {
  if (!input.userId) throw new ParError('Decisão sem autor não existe.')
  const [ia, ib] = ordenar(input.itemXId, input.itemYId)
  if (ia === ib) throw new ParError('Escolha dois itens diferentes.')
  const itens = await db.stockItem.findMany({ where: { companyId: input.companyId, id: { in: [ia, ib] } }, select: { id: true, ativo: true } })
  if (itens.length !== 2) throw new ParError('Item não encontrado nesta empresa.')
  if (input.decisao === 'DIFERENTES') {
    await db.stockItemParDecidido.upsert({
      where: { companyId_itemAId_itemBId: { companyId: input.companyId, itemAId: ia, itemBId: ib } },
      create: { companyId: input.companyId, itemAId: ia, itemBId: ib, decisao: 'DIFERENTES', decididoPorId: input.userId },
      update: { decisao: 'DIFERENTES', decididoPorId: input.userId, decididoEm: new Date() },
    })
    await avisarFilaDeGemeos(input.companyId, db)
    return { decisao: 'DIFERENTES' }
  }
  if (itens.some((i) => !i.ativo)) throw new ParError('Um dos dois já não está ativo — atualize a fila.')
  const ms = await Promise.all([ia, ib].map(async (id) => {
    const [s, agg] = await Promise.all([saldoItem(db, input.companyId, id), db.stockMovement.aggregate({ where: { companyId: input.companyId, itemId: id }, _count: true, _max: { dataMovimento: true } })])
    return { id, saldo: s.saldo, movimentos: agg._count, ultimo: agg._max.dataMovimento }
  }))
  const canon = escolherCanonico(ms)
  const outro = ms.find((m) => m.id !== canon.id)!
  const r = await mesclarItens({ companyId: input.companyId, sobreviventeId: canon.id, absorvidoId: outro.id, userId: input.userId }, db)
  await db.stockItemParDecidido.create({ data: { companyId: input.companyId, itemAId: ia, itemBId: ib, decisao: 'JUNTADOS', decididoPorId: input.userId } })
  await avisarFilaDeGemeos(input.companyId, db)
  return { decisao: 'JUNTADOS', sobreviventeId: canon.id, saldoAntes: r.antes.saldo, saldoDepois: r.depois.saldo }
}

/** ⭐ o sininho: UM aviso por empresa com a contagem da fila; fila vazia cala */
export async function avisarFilaDeGemeos(companyId: string, db: PrismaClient = defaultPrisma): Promise<number> {
  const pares = await paresSuspeitos(companyId, db)
  if (!pares.length) { await resolverAviso(companyId, ORIGEM_GEMEOS, 'fila', db); return 0 }
  await registrarAviso({
    companyId, setor: 'estoque', severidade: 'ambar', origem: ORIGEM_GEMEOS, alvo: 'fila',
    titulo: `Revise ${pares.length} ${pares.length === 1 ? 'par de itens parecidos' : 'pares de itens parecidos'} no estoque`,
    corpo: `Nomes quase iguais podem ser o mesmo produto cadastrado duas vezes — e aí o histórico se divide. Ex.: ${pares.slice(0, 4).map((p) => `“${p.a.nome}” × “${p.b.nome}”`).join(' · ')}${pares.length > 4 ? ` · e mais ${pares.length - 4}` : ''}.`,
    oQueFazer: 'Abra a fila e responda par a par: juntar (é o mesmo item) ou são diferentes (nunca mais pergunto).',
    acaoRotulo: 'Abrir a fila', acaoHref: `/empresas/${companyId}/estoque/itens/gemeos`,
  }, db)
  return pares.length
}
