// ESTOQUE FASE 1 (20/08) — SALDO DERIVADO. saldo = Σ stock_movement por (item).
// NUNCA gravado como fonte; o cache é conveniência e o juiz E1 confere cache==Σ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { custoMedioComMemoria, custoVigenteDoItem, custoVigentePorItem } from './custo-vigente'
import { TIPOS_FORA_DA_PRATELEIRA, idsDeEstornoInterno, movePrateleira } from './prateleira'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface SaldoItem {
  itemId: string
  saldo: number // Σ quantidade (unidade de controle)
  valor: number // Σ custoTotal
  /**
   * ⭐⭐ `valor / saldo` com saldo em pé; com saldo ≤ 0, **o último custo conhecido** (a
   * MEMÓRIA do item — `lib/stock/custo-vigente.ts`, lei do dono de 13/10). `null` só quando o
   * item nunca teve entrada com valor: aí *"a definir"* é a resposta honesta.
   */
  custoMedio: number | null
}

/**
 * ⚠️ A RÉGUA DE PRATELEIRA MUDOU DE CASA (13/10/2026) — mora em `./prateleira`, porque a
 * porta do CUSTO VIGENTE precisa dela pra replayar a história do item e este arquivo precisa
 * da porta do custo: deixá-la aqui fazia **ciclo de import**. ⭐ Re-exportada pra os
 * importadores de sempre não mudarem (a pergunta continua com um dono só).
 */
export { TIPOS_FORA_DA_PRATELEIRA, movePrateleira, idsDeEstornoInterno }

const NAO_PRATELEIRA = { tipo: { notIn: TIPOS_FORA_DA_PRATELEIRA } }

/** Saldo derivado de UM item (Σ movimentos de prateleira). */
export async function saldoItem(db: Db, companyId: string, itemId: string): Promise<SaldoItem> {
  const excluir = await idsDeEstornoInterno(db, companyId, itemId)
  const agg = await db.stockMovement.aggregate({
    where: { companyId, itemId, ...NAO_PRATELEIRA, ...(excluir.length ? { id: { notIn: excluir } } : {}) },
    _sum: { quantidade: true, custoTotal: true },
  })
  const vigente = await custoVigenteDoItem(db, companyId, itemId)
  return montar(itemId, agg._sum.quantidade ?? 0, agg._sum.custoTotal ?? 0, vigente)
}

/** Saldo de TODOS os itens da empresa (só os que têm movimento de prateleira). */
export async function saldosDaEmpresa(db: Db, companyId: string): Promise<SaldoItem[]> {
  const excluir = await idsDeEstornoInterno(db, companyId)
  const grupos = await db.stockMovement.groupBy({
    by: ['itemId'],
    where: { companyId, ...NAO_PRATELEIRA, ...(excluir.length ? { id: { notIn: excluir } } : {}) },
    _sum: { quantidade: true, custoTotal: true },
  })
  // ⭐ 1 consulta pra a empresa inteira — a memória é lida junto do saldo, nunca por item
  const vigente = await custoVigentePorItem(db, companyId)
  return grupos.map((g) =>
    montar(g.itemId, g._sum.quantidade ?? 0, g._sum.custoTotal ?? 0, vigente.get(g.itemId) ?? null),
  )
}

/** Custo médio DERIVADO por item (mesma fonte da Posição — fonte ÚNICA, REGRA 4/5).
 *  Item com ENTRADA_NF → custo real; item que nunca teve nota → não aparece (null no caller). */
export async function custoMedioPorItem(db: Db, companyId: string): Promise<Map<string, number | null>> {
  const saldos = await saldosDaEmpresa(db, companyId)
  return new Map(saldos.map((s) => [s.itemId, s.custoMedio]))
}

/**
 * ⛔⛔ O CUSTO MÉDIO SAI DA LEI, NUNCA DE UMA DIVISÃO AQUI (13/10/2026).
 *
 * `valor / saldo` morreu desta função: ele era a régua que **apagava o custo quando o estoque
 * zerava** (o caso da massa de pizza). Quem responde é `custoMedioComMemoria`, e é a MESMA
 * resposta que o replay do ledger dá — é isso que faz o juiz E17 poder conferir o campo.
 */
function montar(itemId: string, qtd: number, valor: number, vigente: number | null): SaldoItem {
  const saldo = round2(qtd)
  const val = round2(valor)
  return { itemId, saldo, valor: val, custoMedio: custoMedioComMemoria(saldo, val, vigente) }
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
