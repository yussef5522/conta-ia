/**
 * ⭐ UMA TRANSAÇÃO, MESMO QUANDO O CHAMADOR JÁ ESTÁ NUMA (12/11/2026 — conserto D1/D2 da produção).
 *
 * ⛔ Prisma não aninha `$transaction` (o client transacional não tem o método). O padrão da casa
 * (confirmar-pedido.ts:200) é: se o `db` ainda é o client cheio, abre a transação; se já é um
 * client transacional, roda DENTRO dela. É isso que deixa "finalizar a etapa + concluir a ordem"
 * virar UM ATO SÓ: ou tudo grava, ou nada grava.
 * ⚠️ Timeout de 30 s: a conclusão grava N movimentos + recalcula o cache de saldo — o default de
 * 5 s do Prisma derrubaria a transação no meio num dia de muitas linhas.
 */
import type { Prisma, PrismaClient } from '@prisma/client'

export type DbOuTx = PrismaClient | Prisma.TransactionClient

export function naTransacao<T>(db: DbOuTx, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return '$transaction' in db
    ? (db as PrismaClient).$transaction(fn, { timeout: 30_000, maxWait: 10_000 })
    : fn(db)
}
