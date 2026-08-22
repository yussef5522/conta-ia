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

// PRODUCAO_CONSUMO NÃO é evento de prateleira — é transferência interna da produção (o
// insumo já saiu da prateleira no SEPARACAO_SAIDA). Contá-lo no saldo duplicaria a baixa.
// SEPARACAO_SAIDA(−)/DEVOLUCAO_PRODUCAO(+) mexem na prateleira; PRODUCAO_GERACAO(+) é o
// produto entrando. Excluir só o CONSUMO mantém saldo/cache/E1/posição coerentes (fonte única).
const NAO_PRATELEIRA = { tipo: { not: 'PRODUCAO_CONSUMO' } } as const

/** Saldo derivado de UM item (Σ movimentos de prateleira). */
export async function saldoItem(db: Db, companyId: string, itemId: string): Promise<SaldoItem> {
  const agg = await db.stockMovement.aggregate({ where: { companyId, itemId, ...NAO_PRATELEIRA }, _sum: { quantidade: true, custoTotal: true } })
  return montar(itemId, agg._sum.quantidade ?? 0, agg._sum.custoTotal ?? 0)
}

/** Saldo de TODOS os itens da empresa (só os que têm movimento de prateleira). */
export async function saldosDaEmpresa(db: Db, companyId: string): Promise<SaldoItem[]> {
  const grupos = await db.stockMovement.groupBy({ by: ['itemId'], where: { companyId, ...NAO_PRATELEIRA }, _sum: { quantidade: true, custoTotal: true } })
  return grupos.map((g) => montar(g.itemId, g._sum.quantidade ?? 0, g._sum.custoTotal ?? 0))
}

/** Custo médio DERIVADO por item (mesma fonte da Posição — fonte ÚNICA, REGRA 4/5).
 *  Item com ENTRADA_NF → custo real; item que nunca teve nota → não aparece (null no caller). */
export async function custoMedioPorItem(db: Db, companyId: string): Promise<Map<string, number | null>> {
  const saldos = await saldosDaEmpresa(db, companyId)
  return new Map(saldos.map((s) => [s.itemId, s.custoMedio]))
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
