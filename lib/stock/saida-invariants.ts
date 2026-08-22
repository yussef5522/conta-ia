// ESTOQUE PARTE C — invariantes do juiz pras SAÍDAS (perda/uso interno).
// C1: todo movimento PERDA|USO_INTERNO tem uma linha stock_saida (com motivo). "Perda sem
//     motivo" é impossível por construção (registrarSaida atômico); C1 é o backstop.
// C2 (AVISO): perda do item no mês > 30% do consumo (venda+produção) — desperdício alto.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from './stock-invariants'

type Db = PrismaClient | Prisma.TransactionClient
const C2_PCT = 0.30

export async function checkSaidaInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []

  // C1 — movimento de saída SEM stock_saida (motivo)
  const movsSaida = await db.stockMovement.findMany({ where: { tipo: { in: ['PERDA', 'USO_INTERNO'] } }, select: { id: true, companyId: true, itemId: true } })
  if (movsSaida.length) {
    const comSaida = new Set((await db.stockSaida.findMany({ where: { movementId: { in: movsSaida.map((m) => m.id) } }, select: { movementId: true } })).map((s) => s.movementId))
    for (const m of movsSaida) if (!comSaida.has(m.id)) fails.push({ invariante: 'C1', companyId: m.companyId, detalhe: `movimento de saída ${m.id} (item ${m.itemId}) SEM motivo registrado (stock_saida) — toda perda/uso precisa de motivo.` })
  }

  // C2 — perda > 30% do consumo do item no mês (aviso)
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
  const movsMes = await db.stockMovement.findMany({ where: { tipo: { in: ['PERDA', 'BAIXA_VENDA', 'PRODUCAO_CONSUMO'] }, dataMovimento: { gte: inicioMes } }, select: { companyId: true, itemId: true, tipo: true, custoTotal: true } })
  const agg = new Map<string, { companyId: string; itemId: string; perda: number; consumo: number }>()
  for (const m of movsMes) {
    const k = `${m.companyId}|${m.itemId}`
    const cur = agg.get(k) ?? { companyId: m.companyId, itemId: m.itemId, perda: 0, consumo: 0 }
    if (m.tipo === 'PERDA') cur.perda += Math.abs(m.custoTotal)
    else cur.consumo += Math.abs(m.custoTotal)
    agg.set(k, cur)
  }
  for (const v of agg.values()) {
    if (v.consumo > 0 && v.perda / v.consumo > C2_PCT) {
      fails.push({ invariante: 'C2', companyId: v.companyId, nivel: 'aviso', detalhe: `item ${v.itemId}: perda no mês (R$ ${v.perda.toFixed(2)}) passou de ${Math.round(C2_PCT * 100)}% do consumo (R$ ${v.consumo.toFixed(2)}) — desperdício alto, confira.` })
    }
  }
  return fails
}
