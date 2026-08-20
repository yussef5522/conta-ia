// ESTOQUE FASE 0 item 5 — dados da tela RECEBIMENTOS. Fila (AGUARDANDO_MERCADORIA)
// que nasce vazia e enche sozinha; históricas num filtro à parte (visíveis, sem ação).
// Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export interface RecebimentoCard {
  id: string
  chave: string
  emitNome: string | null
  emitCnpj: string | null
  vNF: number | null
  dataEmissao: string | null
  nItens: number
  cancelada: boolean
  esperandoDias: number | null
}

export interface RecebimentosData {
  dataCorte: string | null
  ultimoDownload: string | null
  fila: RecebimentoCard[]
  historicasCount: number
  historicasPeriodo: { de: string | null; ate: string | null }
}

export async function listRecebimentos(companyId: string, db: Db = defaultPrisma, agora = new Date()): Promise<RecebimentosData> {
  const [state, ultimoLog, filaNotas, itemCounts, histAgg] = await Promise.all([
    db.stockSefazState.findUnique({ where: { companyId }, select: { dataCorte: true } }),
    db.stockSefazLog.findFirst({ where: { companyId }, orderBy: { criadoEm: 'desc' }, select: { criadoEm: true } }),
    db.stockNfe.findMany({
      where: { companyId, status: 'AGUARDANDO_MERCADORIA' },
      orderBy: { dataEmissao: 'asc' },
      select: { id: true, chave: true, emitNome: true, emitCnpj: true, vNF: true, dataEmissao: true, cSitNFe: true },
    }),
    db.stockNfeItem.groupBy({ by: ['nfeId'], where: { companyId }, _count: { _all: true } }),
    db.stockNfe.aggregate({ where: { companyId, status: 'HISTORICA' }, _count: { _all: true }, _min: { dataEmissao: true }, _max: { dataEmissao: true } }),
  ])

  const itensPorNfe = new Map(itemCounts.map((g) => [g.nfeId, g._count._all]))
  const fila: RecebimentoCard[] = filaNotas.map((n) => ({
    id: n.id,
    chave: n.chave,
    emitNome: n.emitNome,
    emitCnpj: n.emitCnpj,
    vNF: n.vNF,
    dataEmissao: n.dataEmissao?.toISOString() ?? null,
    nItens: itensPorNfe.get(n.id) ?? 0,
    cancelada: n.cSitNFe === '2',
    esperandoDias: n.dataEmissao ? Math.floor((agora.getTime() - n.dataEmissao.getTime()) / 86_400_000) : null,
  }))

  return {
    dataCorte: state?.dataCorte?.toISOString().slice(0, 10) ?? null,
    ultimoDownload: ultimoLog?.criadoEm?.toISOString() ?? null,
    fila,
    historicasCount: histAgg._count._all,
    historicasPeriodo: {
      de: histAgg._min.dataEmissao?.toISOString().slice(0, 10) ?? null,
      ate: histAgg._max.dataEmissao?.toISOString().slice(0, 10) ?? null,
    },
  }
}
