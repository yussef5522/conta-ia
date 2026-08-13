// Sprint Unificar-Retirada-Órfã (13/08/2026) — FONTE ÚNICA da consulta de
// "retirada órfã" (retirada de sócio sem ponte PJ→PF). Antes havia DOIS endpoints
// com lógica DIFERENTE (`retiradas-orfas` vs `retiradas-pendentes`) → banner e
// sidebar podiam DISCORDAR (o problema do motor de transferência de novo). Agora a
// decisão vive AQUI, numa função só; os endpoints são cascas finas. Mesma lição:
// quando N telas fazem a MESMA pergunta, a resposta vira UMA lib.
//
// Critério (espelha `isOrphanWithdrawal`): DEBIT + lifecycle=EFFECTED (já pago) +
// NÃO transferência interna + NÃO agrupada (evita contar transferência entre as
// próprias contas como retirada — foi o erro dos 157k de PIX pra "CACULA MIX") +
// categoria com dreGroup em WITHDRAWAL_DRE_GROUPS (hoje só DISTRIBUICAO_LUCROS —
// pró-labore fica de fora até ter dreGroup próprio) + SEM bridge.

import type { Prisma, PrismaClient } from '@prisma/client'
import { WITHDRAWAL_DRE_GROUPS } from './is-orphan'

type Db = PrismaClient | Prisma.TransactionClient

/** O WHERE canônico — a fonte única. Todos os contadores usam ISTO. */
export function orphanWithdrawalWhere(companyId: string): Prisma.TransactionWhereInput {
  return {
    bankAccount: { companyId },
    type: 'DEBIT',
    lifecycle: 'EFFECTED',
    isInternalTransfer: false,
    transferGroupId: null,
    bridge: { is: null },
    category: { dreGroup: { in: Array.from(WITHDRAWAL_DRE_GROUPS) } },
  }
}

/** Contagem de retiradas órfãs (banner, sidebar, empty state). */
export function countOrphanWithdrawals(db: Db, companyId: string): Promise<number> {
  return db.transaction.count({ where: orphanWithdrawalWhere(companyId) })
}

export interface OrphanWithdrawalRow {
  id: string
  date: string
  amount: number
  description: string
  bankAccountId: string
  bankAccountName: string
  categoryId: string | null
  categoryName: string | null
}

/** Lista das órfãs (com detalhe pra tela). Mesma fonte do count. */
export async function listOrphanWithdrawals(db: Db, companyId: string): Promise<OrphanWithdrawalRow[]> {
  const rows = await db.transaction.findMany({
    where: orphanWithdrawalWhere(companyId),
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      bankAccountId: true,
      bankAccount: { select: { name: true } },
      categoryId: true,
      category: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    amount: r.amount,
    description: r.description,
    bankAccountId: r.bankAccountId ?? '',
    bankAccountName: r.bankAccount?.name ?? '—',
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
  }))
}
