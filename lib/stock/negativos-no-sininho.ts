// ⭐⭐ OS ITENS NEGATIVOS NO SININHO (19/11/2026) — a seção da guarda diária, todo dia até zerar.
//
// ⛔ O CASO (laudo de 18/11): 9 itens com saldo negativo somando R$ 4,3 mil de dívida, 5 há mais de 30 dias
// (PAPEL ACOPLADO −1.188 UN, anéis de cebola há 48 dias, feijão há 60) — e ninguém via, porque negativo só
// aparecia na Posição pra quem abrisse. Negativo é compra que entrou sem nota ou consumo sem dono.
//
// ⭐ A REGRA: a guarda diária (`guardarBaixaDoDia`) chama `avisarNegativos` todo dia. UM aviso por empresa
// (origem ESTOQUE_NEGATIVO, alvo 'estoque'): renovado com a lista do dia — item · saldo · há quantos dias ·
// custo da dívida —, resolvido quando não sobra nenhum. ⛔ NUNCA bloqueia venda nem mexe em saldo: só avisa.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { registrarAviso, resolverAviso } from '@/lib/avisos/central'
import { saldosDaEmpresa, idsDeEstornoInterno, TIPOS_FORA_DA_PRATELEIRA } from './saldo'
import { seContaFisicamente } from './tipos-ficha'

export const ORIGEM_NEGATIVO = 'ESTOQUE_NEGATIVO'
const ALVO = 'estoque'
/** abaixo disto é poeira de arredondamento (KG com 3 casas) */
const POEIRA = 0.0005

export interface ItemNegativo {
  itemId: string
  nome: string
  unidade: string
  saldo: number
  /** dia (BR) em que o saldo cruzou pra baixo de zero pela última vez — null se não deu pra datar */
  desde: string | null
  dias: number | null
  /** −saldo × custo médio (o último custo conhecido); null = sem custo ("a definir", nunca R$ 0) */
  divida: number | null
}

const diaBr = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

/** ⭐ a lista, só leitura — itens ATIVOS e físicos com saldo de prateleira negativo */
export async function itensNegativos(companyId: string, db: PrismaClient = defaultPrisma, agora = new Date()): Promise<ItemNegativo[]> {
  const saldos = (await saldosDaEmpresa(db, companyId)).filter((s) => s.saldo < -POEIRA)
  if (!saldos.length) return []
  const itens = new Map((await db.stockItem.findMany({
    where: { companyId, id: { in: saldos.map((s) => s.itemId) }, ativo: true },
    select: { id: true, nome: true, categoria: true, unidadeControle: true },
  })).filter((i) => seContaFisicamente(i.categoria)).map((i) => [i.id, i]))
  const internos = new Set(await idsDeEstornoInterno(db, companyId))
  const out: ItemNegativo[] = []
  for (const s of saldos) {
    const i = itens.get(s.itemId)
    if (!i) continue
    // a MESMA prateleira do saldo: sem consumo de produção e sem estorno interno
    const ms = await db.stockMovement.findMany({
      where: { companyId, itemId: s.itemId, tipo: { notIn: TIPOS_FORA_DA_PRATELEIRA } },
      orderBy: [{ dataMovimento: 'asc' }, { criadoEm: 'asc' }], select: { id: true, quantidade: true, dataMovimento: true },
    })
    let acc = 0
    let quando: Date | null = null
    for (const m of ms) {
      if (internos.has(m.id)) continue
      const antes = acc
      acc += m.quantidade
      if (antes >= -POEIRA && acc < -POEIRA) quando = m.dataMovimento
      if (acc >= -POEIRA) quando = null
    }
    const desde = quando ? diaBr(quando) : null
    const dias = desde ? Math.max(0, Math.round((Date.parse(diaBr(agora)) - Date.parse(desde)) / 86_400_000)) : null
    out.push({
      itemId: s.itemId, nome: i.nome, unidade: i.unidadeControle, saldo: Math.round(s.saldo * 1000) / 1000, desde, dias,
      divida: s.custoMedio == null ? null : Math.round(-s.saldo * s.custoMedio * 100) / 100,
    })
  }
  return out.sort((a, b) => (b.divida ?? 0) - (a.divida ?? 0) || (b.dias ?? 0) - (a.dias ?? 0))
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** a linha do sininho: item · saldo · há quantos dias · custo da dívida */
export function linhaDoNegativo(n: ItemNegativo): string {
  const ha = n.dias == null ? 'há tempo não datado' : n.dias === 0 ? 'desde hoje' : `há ${n.dias} ${n.dias === 1 ? 'dia' : 'dias'}`
  return `${n.nome} · ${num(n.saldo)} ${n.unidade} · ${ha} · ${n.divida == null ? 'sem custo' : brl(n.divida)}`
}

/** ⭐ o aviso: renova todo dia com a lista; some quando não sobra negativo. Devolve a lista. */
export async function avisarNegativos(companyId: string, db: PrismaClient = defaultPrisma, agora = new Date()): Promise<ItemNegativo[]> {
  const ns = await itensNegativos(companyId, db, agora)
  if (!ns.length) { await resolverAviso(companyId, ORIGEM_NEGATIVO, ALVO, db); return ns }
  const total = ns.reduce((s, n) => s + (n.divida ?? 0), 0)
  const semCusto = ns.some((n) => n.divida == null)
  await registrarAviso({
    companyId, setor: 'estoque', severidade: 'ambar', origem: ORIGEM_NEGATIVO, alvo: ALVO,
    titulo: `Acerte ${ns.length} ${ns.length === 1 ? 'item' : 'itens'} com saldo negativo — ${semCusto ? 'pelo menos ' : ''}${brl(total)} de dívida`,
    corpo: `Saldo negativo é mercadoria que saiu sem ter entrado no sistema. ${ns.slice(0, 12).map(linhaDoNegativo).join('; ')}${ns.length > 12 ? `; e mais ${ns.length - 12}` : ''}.`,
    oQueFazer: 'Lance a compra que entrou sem nota (entrada manual) ou conte o item. O aviso some sozinho quando nenhum item ficar negativo.',
    acaoRotulo: 'Lançar entrada', acaoHref: `/empresas/${companyId}/estoque/entrada-manual`,
  }, db)
  return ns
}
