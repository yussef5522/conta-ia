// ESTOQUE FASE 0 (19/08) — a REGRA de status por DATA DE CORTE, função ÚNICA (REGRA 4).
// O download (na criação) E o ajuste de corte usam a MESMA decisão — nunca duas cópias.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export type NfeStatus = 'HISTORICA' | 'AGUARDANDO_MERCADORIA'

/**
 * Nota emitida ANTES do corte = HISTÓRICA (mercadoria já recebida/consumida, sem ação).
 * `>= corte` = AGUARDANDO_MERCADORIA (fila; nada acontece até conferir na Fase 1).
 * Sem data (raro; resumo sempre tem dhEmi) → conservador: entra na fila (visível).
 */
export function statusForNfe(dataEmissao: Date | null, corte: Date): NfeStatus {
  if (!dataEmissao) return 'AGUARDANDO_MERCADORIA'
  return dataEmissao < corte ? 'HISTORICA' : 'AGUARDANDO_MERCADORIA'
}

/** Muda a data de corte da empresa e RECLASSIFICA todas as notas por ela (idempotente). */
export async function setDataCorte(companyId: string, corte: Date, db: Db): Promise<{ historicas: number; novas: number; total: number }> {
  await db.stockSefazState.update({ where: { companyId }, data: { dataCorte: corte } })
  const notas = await db.stockNfe.findMany({ where: { companyId }, select: { id: true, dataEmissao: true, status: true } })
  let historicas = 0
  let novas = 0
  for (const n of notas) {
    const novo = statusForNfe(n.dataEmissao, corte)
    if (novo === 'HISTORICA') historicas++
    else novas++
    if (novo !== n.status) await db.stockNfe.update({ where: { id: n.id }, data: { status: novo } })
  }
  return { historicas, novas, total: notas.length }
}
