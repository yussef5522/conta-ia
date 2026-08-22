// ESTOQUE — o juiz noturno do estoque. Roda os invariantes (E1/E2/E3/E12/E15) contra o
// banco INTEIRO e persiste em stock_judge_report (tabela PRÓPRIA, isolada). O selo/e-mail/
// /juiz agregam lendo essa tabela — falha de estoque nunca mascara nem é mascarada.

import type { PrismaClient, Prisma } from '@prisma/client'
import { checkStockInvariants, type StockInvariantFail } from './stock-invariants'

type Db = PrismaClient | Prisma.TransactionClient

export interface StockJudgeReport {
  passed: boolean
  stockIssues: number
  fails: StockInvariantFail[]
  durationMs: number
}

/** Roda os invariantes (não persiste). */
export async function runStockJudge(db: Db, now: Date = new Date()): Promise<StockJudgeReport> {
  const t0 = Date.now()
  const fails = await checkStockInvariants(db, now)
  // 'aviso' (ex: V1 venda sem mapa) aparece no relatório mas NÃO conta como issue do selo.
  const stockIssues = fails.filter((f) => f.nivel !== 'aviso').length
  return { passed: stockIssues === 0, stockIssues, fails, durationMs: Date.now() - t0 }
}

/** Roda + persiste a linha em stock_judge_report. Retorna o relatório. */
export async function runAndPersistStockJudge(db: Db, now: Date = new Date()): Promise<StockJudgeReport> {
  const rep = await runStockJudge(db, now)
  await db.stockJudgeReport.create({
    data: { passed: rep.passed, stockIssues: rep.stockIssues, detail: JSON.stringify({ fails: rep.fails }), durationMs: rep.durationMs },
  })
  return rep
}
