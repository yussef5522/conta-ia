// ESTOQUE FASE 0 — invariantes do juiz do estoque (tabela PRÓPRIA stock_judge_report).
// Isolado: falha de estoque nunca mascara nem é mascarada por empréstimo/cartão/venda.
//
// FASE 0 entrega E12 (certificado) + o SNAPSHOT DE ISOLAMENTO. E10/E13/E14 (SEFAZ)
// entram com o item 2; E11 (multi-tenant) quando houver dado stock_ com companyId.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export interface StockInvariantFail {
  invariante: string
  companyId: string | null
  detalhe: string
}

const E12_DIAS = 30

/** Roda os invariantes de estoque disponíveis na FASE 0. */
export async function checkStockInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []

  // E12 — certificado ativo vence em < 30 dias (ou já venceu). O dono precisa renovar
  // ANTES, senão o download da SEFAZ para. Alerta, nunca falha em silêncio.
  const certs = await db.stockCertificate.findMany({
    where: { status: 'ATIVO' },
    select: { companyId: true, cnpj: true, validadeAte: true },
  })
  for (const c of certs) {
    const dias = Math.floor((c.validadeAte.getTime() - now.getTime()) / 86_400_000)
    if (dias < 0) {
      fails.push({ invariante: 'E12', companyId: c.companyId, detalhe: `certificado ${c.cnpj} VENCIDO há ${-dias} dia(s) — o download da SEFAZ está parado. Renove.` })
    } else if (dias < E12_DIAS) {
      fails.push({ invariante: 'E12', companyId: c.companyId, detalhe: `certificado ${c.cnpj} vence em ${dias} dia(s) — renove antes de vencer.` })
    }
  }

  return fails
}

// ---------------------------------------------------------------------------
// SNAPSHOT DE ISOLAMENTO — a prova de que operação de estoque NÃO altera nenhum
// módulo fechado. Contagem por tabela (soma quando faz sentido). O teste tira o
// snapshot ANTES e DEPOIS de uma operação de estoque; tem que ser IDÊNTICO.
// ---------------------------------------------------------------------------

const TABELAS_FECHADAS = [
  'transaction', 'category', 'accountsPayable', 'vendaDiaria', 'loan',
  'businessCreditCard', 'bankAccount', 'aiLearningRule', 'supplier',
] as const

export interface IsolationSnapshot {
  [tabela: string]: number // contagem de linhas
}

/** Conta as linhas de cada tabela dos módulos fechados. Usado no teste de isolamento
 *  (antes/depois) e no juiz (delta do dia). Só LÊ. */
export async function snapshotClosedModules(db: Db): Promise<IsolationSnapshot> {
  const snap: IsolationSnapshot = {}
  for (const t of TABELAS_FECHADAS) {
    // @ts-expect-error — acesso dinâmico ao delegate do Prisma (nomes conferidos acima)
    const delegate = db[t]
    if (delegate?.count) snap[t] = await delegate.count()
  }
  return snap
}

/** true se os dois snapshots são idênticos (nenhuma tabela fechada mudou). */
export function isolationHeld(antes: IsolationSnapshot, depois: IsolationSnapshot): boolean {
  const keys = new Set([...Object.keys(antes), ...Object.keys(depois)])
  for (const k of keys) if (antes[k] !== depois[k]) return false
  return true
}
