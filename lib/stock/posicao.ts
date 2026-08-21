// ESTOQUE FASE 1 item 2 — POSIÇÃO de estoque. Saldo DERIVADO (Σ movimentos) por item,
// com custo médio e valor. Nasce vazia; enche a cada conferência confirmada. Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldosDaEmpresa } from './saldo'

type Db = PrismaClient | Prisma.TransactionClient

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno' }
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface PosicaoItem {
  itemId: string
  nome: string
  categoria: string
  categoriaLabel: string
  unidadeControle: string
  saldo: number
  custoMedio: number | null
  valor: number
  negativo: boolean
}
export interface PosicaoData {
  itens: PosicaoItem[]
  valorTotal: number
  porCategoria: { categoria: string; label: string; valor: number; itens: number }[]
}

export async function listPosicao(companyId: string, db: Db = defaultPrisma): Promise<PosicaoData> {
  const saldos = await saldosDaEmpresa(db, companyId)
  const itemIds = saldos.map((s) => s.itemId)
  const items = itemIds.length ? await db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, categoria: true, unidadeControle: true } }) : []
  const byId = new Map(items.map((i) => [i.id, i]))

  const itens: PosicaoItem[] = saldos.map((s) => {
    const it = byId.get(s.itemId)
    return {
      itemId: s.itemId,
      nome: it?.nome ?? '(item removido)',
      categoria: it?.categoria ?? 'USO_INTERNO',
      categoriaLabel: CAT_LABEL[it?.categoria ?? 'USO_INTERNO'] ?? it?.categoria ?? '—',
      unidadeControle: it?.unidadeControle ?? '—',
      saldo: s.saldo,
      custoMedio: s.custoMedio,
      valor: s.valor,
      negativo: s.saldo < 0,
    }
  }).sort((a, b) => b.valor - a.valor)

  const catMap = new Map<string, { valor: number; itens: number }>()
  for (const i of itens) {
    const c = catMap.get(i.categoria) ?? { valor: 0, itens: 0 }
    c.valor = round2(c.valor + i.valor); c.itens++
    catMap.set(i.categoria, c)
  }

  return {
    itens,
    valorTotal: round2(itens.reduce((s, i) => s + i.valor, 0)),
    porCategoria: [...catMap.entries()].map(([categoria, v]) => ({ categoria, label: CAT_LABEL[categoria] ?? categoria, valor: v.valor, itens: v.itens })).sort((a, b) => b.valor - a.valor),
  }
}
