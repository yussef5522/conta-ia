// ESTOQUE FASE 1 (20/08) — SALDO DERIVADO. saldo = Σ stock_movement por (item).
// NUNCA gravado como fonte; o cache é conveniência e o juiz E1 confere cache==Σ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface SaldoItem {
  itemId: string
  saldo: number // Σ quantidade (unidade de controle)
  valor: number // Σ custoTotal
  custoMedio: number | null // valor / saldo (quando saldo > 0)
}

/** Saldo derivado de UM item (Σ movimentos). */
export async function saldoItem(db: Db, companyId: string, itemId: string): Promise<SaldoItem> {
  const agg = await db.stockMovement.aggregate({ where: { companyId, itemId }, _sum: { quantidade: true, custoTotal: true } })
  return montar(itemId, agg._sum.quantidade ?? 0, agg._sum.custoTotal ?? 0)
}

/** Saldo de TODOS os itens da empresa (só os que têm movimento). */
export async function saldosDaEmpresa(db: Db, companyId: string): Promise<SaldoItem[]> {
  const grupos = await db.stockMovement.groupBy({ by: ['itemId'], where: { companyId }, _sum: { quantidade: true, custoTotal: true } })
  return grupos.map((g) => montar(g.itemId, g._sum.quantidade ?? 0, g._sum.custoTotal ?? 0))
}

function montar(itemId: string, qtd: number, valor: number): SaldoItem {
  const saldo = round2(qtd)
  const val = round2(valor)
  return { itemId, saldo, valor: val, custoMedio: saldo > 0 ? round2(val / saldo) : null }
}

/** Recomputa o cache (upsert por item). Recomputável a qualquer momento; o cache
 *  NUNCA é fonte — sempre reconstruível daqui. */
export async function recomputeSaldoCache(db: Db, companyId: string): Promise<number> {
  const saldos = await saldosDaEmpresa(db, companyId)
  for (const s of saldos) {
    await db.stockSaldoCache.upsert({
      where: { companyId_itemId: { companyId, itemId: s.itemId } },
      create: { companyId, itemId: s.itemId, saldo: s.saldo, custoMedio: s.custoMedio },
      update: { saldo: s.saldo, custoMedio: s.custoMedio },
    })
  }
  return saldos.length
}
