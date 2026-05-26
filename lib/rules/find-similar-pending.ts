// Sprint 5.0.2.k — Busca transações PENDING similares a uma transação alvo.
//
// Usado pelo endpoint suggest-similar: após user categorizar 1 tx manualmente,
// busca outras pendentes com mesmo stem pra oferecer "criar regra?".

import { prisma } from '@/lib/db'
import { extractDescriptionStem } from './extract-stem'

export interface SimilarPendingResult {
  stem: string
  count: number
  totalAmount: number
  /** IDs das transações similares (sem incluir a tx-base) */
  transactionIds: string[]
  /** Sample de 3 descrições pra UI mostrar exemplos */
  sampleDescriptions: string[]
}

export interface FindSimilarInput {
  companyId: string
  /** ID da tx-base (excluída do resultado) */
  baseTransactionId: string
  /** Descrição da tx-base */
  baseDescription: string | null
  /** Tipo CREDIT/DEBIT — filtrar similares pelo mesmo tipo */
  baseType: string
  /** Limita busca a tx PENDING (sem categoryId) */
  onlyPending?: boolean
}

/**
 * Busca pendentes com mesmo stem da tx-base. Retorna stem + count + total.
 */
export async function findSimilarPendingTransactions(
  input: FindSimilarInput,
): Promise<SimilarPendingResult> {
  const stem = extractDescriptionStem(input.baseDescription)
  const empty: SimilarPendingResult = {
    stem,
    count: 0,
    totalAmount: 0,
    transactionIds: [],
    sampleDescriptions: [],
  }
  if (!stem || stem.length < 4) return empty

  const onlyPending = input.onlyPending !== false

  // Busca por SUBSTRING do stem (case-insensitive não funciona no SQLite — o
  // OFX em geral usa caixa-alta; tx criadas manualmente caem na heurística do
  // mesmo jeito porque PendentesClient guarda caixa-alta).
  // Pra Postgres prod com case-insensitive, vamos preferir mode 'default'.
  const candidates = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: input.companyId },
      type: input.baseType,
      id: { not: input.baseTransactionId },
      description: { contains: stem },
      lifecycle: 'EFFECTED',
      ...(onlyPending ? { status: 'PENDING' } : {}),
    },
    select: {
      id: true,
      amount: true,
      description: true,
    },
    take: 500, // safety cap
  })

  const totalAmount = candidates.reduce((sum, t) => sum + t.amount, 0)
  return {
    stem,
    count: candidates.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    transactionIds: candidates.map((c) => c.id),
    sampleDescriptions: candidates.slice(0, 3).map((c) => c.description ?? ''),
  }
}
