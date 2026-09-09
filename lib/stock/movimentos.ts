// ESTOQUE FASE 1 item 2 — o EXTRATO do estoque (lê o ledger). Filtros item/tipo/período,
// referência clicável, estorno destacado, quem lançou. Só LÊ.
//
// ⛔⛔ **A MESMA MENTIRA DO HISTÓRICO DO ITEM VIVIA AQUI (corrigido 08/09/2026):** a
// `referencia` colapsava **tudo** que não tinha nota em `{ tipo: 'conferencia', label:
// 'conferência' }` — então movimento de produção, contagem e baixa de venda apareciam como
// "conferência" no extrato. Duas telas, a mesma pergunta, duas respostas erradas.
//
// ⭐ Agora as duas leem `movimento-explicado.ts` (REGRA 4). A `referencia` continua no
// payload **só pra não quebrar o consumidor atual**, derivada da explicação.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { explicarMovimentos, dobrarProducao, somaDasLinhas } from './movimento-explicado'

type Db = PrismaClient | Prisma.TransactionClient

export interface MovimentoLinha {
  id: string
  data: string
  tipo: string
  estorno: boolean
  estornoDeId: string | null
  itemId: string
  itemNome: string
  quantidade: number
  custoUnitario: number
  custoTotal: number
  referencia: { tipo: 'nota' | 'conferencia' | null; label: string; nfeId: string | null }
  quem: string
  /** ⭐ o TIPO real com a cara dele (chip), o de-onde-veio e o link — o dono único */
  chip: string
  detalhe: string
  href: string | null
  /** ⛔ esta linha mexeu no saldo? (a MESMA pergunta do `saldo.ts`) */
  movePrateleira: boolean
  /** a história do que saiu pra produção, dentro da linha da separação */
  dentroDaProducao: { separado: number; consumido: number; devolvido: number; emProducao: number } | null
}

export interface MovimentosFiltro { itemId?: string; tipo?: string; de?: string; ate?: string; limite?: number }

export async function listMovimentos(companyId: string, filtro: MovimentosFiltro = {}, db: Db = defaultPrisma): Promise<MovimentoLinha[]> {
  const where: Prisma.StockMovementWhereInput = { companyId }
  if (filtro.itemId) where.itemId = filtro.itemId
  if (filtro.tipo) where.tipo = filtro.tipo
  if (filtro.de || filtro.ate) where.dataMovimento = { ...(filtro.de ? { gte: new Date(`${filtro.de}T00:00:00`) } : {}), ...(filtro.ate ? { lte: new Date(`${filtro.ate}T23:59:59`) } : {}) }

  const movs = await db.stockMovement.findMany({ where, orderBy: { dataMovimento: 'desc' }, take: filtro.limite ?? 500 })

  const itemIds = [...new Set(movs.map((m) => m.itemId))]
  const chaves = [...new Set(movs.map((m) => m.nfeChave).filter((c): c is string => !!c))]
  const [items, notas, explicadas] = await Promise.all([
    itemIds.length ? db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true } }) : Promise.resolve([]),
    chaves.length ? db.stockNfe.findMany({ where: { companyId, chave: { in: chaves } }, select: { id: true, chave: true } }) : Promise.resolve([]),
    explicarMovimentos(companyId, movs, db).then(dobrarProducao),
  ])
  const itemNome = new Map(items.map((i) => [i.id, i.nome]))
  const nfeIdPorChave = new Map(notas.map((n) => [n.chave, n.id]))
  const expPorId = new Map(explicadas.map((e) => [e.movimentoId, e]))

  // ⛔⛔ A REGRA DO HISTÓRICO HONESTO vale AQUI TAMBÉM (09/09): o consumo de produção some da
  // lista (dobrado dentro da separação) porque não move o saldo. Extrato que soma o que o
  // saldo não conta mente com cara de contabilidade.
  return movs.filter((m) => expPorId.has(m.id)).map((m) => {
    const e = expPorId.get(m.id)!
    return {
      id: m.id,
      data: m.dataMovimento.toISOString(),
      tipo: m.tipo,
      estorno: m.tipo === 'ESTORNO',
      estornoDeId: m.estornoDeId,
      itemId: m.itemId,
      itemNome: itemNome.get(m.itemId) ?? '(item removido)',
      quantidade: m.quantidade,
      custoUnitario: m.custoUnitario,
      custoTotal: m.custoTotal,
      // ⚠️ compat: `referencia` sobrevive pro CSV e pro consumidor atual, mas o LABEL agora
      // vem da explicação — nunca mais "conferência" em cima de uma ordem de produção.
      referencia: {
        tipo: m.nfeChave ? 'nota' : m.receiptId ? 'conferencia' : null,
        label: e.detalhe,
        nfeId: m.nfeChave ? nfeIdPorChave.get(m.nfeChave) ?? null : null,
      },
      // ⚠️ sem autor, a origem ('SEFAZ'/'MANUAL') diz de ONDE veio em vez de inventar um nome
      quem: e.quem ?? m.origem,
      chip: e.chip,
      detalhe: e.detalhe,
      href: e.href,
      movePrateleira: e.movePrateleira,
      dentroDaProducao: e.dentroDaProducao,
    }
  })
}

/** ⭐ a soma que o extrato exibe — a mesma régua do saldo (o teste trava a igualdade) */
export function somaDoExtrato(linhas: MovimentoLinha[]): { quantidade: number; valor: number } {
  return somaDasLinhas(linhas.map((l) => ({ ...l, movimentoId: l.id }) as never))
}

/** CSV do extrato (o dono exporta pra planilha). */
export function movimentosToCsv(linhas: MovimentoLinha[]): string {
  const head = ['Data', 'Tipo', 'Item', 'Quantidade', 'Custo unit.', 'Custo total', 'Referência', 'Quem']
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const rows = linhas.map((l) => [
    l.data.slice(0, 10).split('-').reverse().join('/'), l.tipo, l.itemNome,
    String(l.quantidade).replace('.', ','), l.custoUnitario.toFixed(2).replace('.', ','), l.custoTotal.toFixed(2).replace('.', ','),
    l.referencia.label, l.quem,
  ].map(esc).join(';'))
  return [head.map(esc).join(';'), ...rows].join('\n')
}
