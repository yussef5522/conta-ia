// ESTOQUE FASE 1 item 2 — o EXTRATO do estoque (lê o ledger). Filtros item/tipo/período,
// referência clicável (nota/conferência), estorno destacado, quem lançou. Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

const nNFdaChave = (chave: string | null) => (chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null)

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
}

export interface MovimentosFiltro { itemId?: string; tipo?: string; de?: string; ate?: string; limite?: number }

export async function listMovimentos(companyId: string, filtro: MovimentosFiltro = {}, db: Db = defaultPrisma): Promise<MovimentoLinha[]> {
  const where: Prisma.StockMovementWhereInput = { companyId }
  if (filtro.itemId) where.itemId = filtro.itemId
  if (filtro.tipo) where.tipo = filtro.tipo
  if (filtro.de || filtro.ate) where.dataMovimento = { ...(filtro.de ? { gte: new Date(`${filtro.de}T00:00:00`) } : {}), ...(filtro.ate ? { lte: new Date(`${filtro.ate}T23:59:59`) } : {}) }

  const movs = await db.stockMovement.findMany({ where, orderBy: { dataMovimento: 'desc' }, take: filtro.limite ?? 500 })

  // resolve item, nota (por chave) e quem (por criadoPorId)
  const itemIds = [...new Set(movs.map((m) => m.itemId))]
  const chaves = [...new Set(movs.map((m) => m.nfeChave).filter((c): c is string => !!c))]
  const userIds = [...new Set(movs.map((m) => m.criadoPorId).filter((u): u is string => !!u))]
  const [items, notas, users] = await Promise.all([
    itemIds.length ? db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true } }) : Promise.resolve([]),
    chaves.length ? db.stockNfe.findMany({ where: { companyId, chave: { in: chaves } }, select: { id: true, chave: true, emitNome: true } }) : Promise.resolve([]),
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ])
  const itemNome = new Map(items.map((i) => [i.id, i.nome]))
  const notaByChave = new Map(notas.map((n) => [n.chave, n]))
  const userNome = new Map((users as { id: string; name: string | null }[]).map((u) => [u.id, u.name]))

  return movs.map((m) => {
    const nota = m.nfeChave ? notaByChave.get(m.nfeChave) : undefined
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
      referencia: nota
        ? { tipo: 'nota', label: nota.emitNome ? `${nota.emitNome}${nNFdaChave(m.nfeChave) ? ` · nº ${nNFdaChave(m.nfeChave)}` : ''}` : `nota nº ${nNFdaChave(m.nfeChave) ?? '—'}`, nfeId: nota.id }
        : m.receiptId
        ? { tipo: 'conferencia', label: 'conferência', nfeId: null }
        : { tipo: null, label: '—', nfeId: null },
      quem: (m.criadoPorId && userNome.get(m.criadoPorId)) || m.origem,
    }
  })
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
