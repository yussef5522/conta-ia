// Converte o resultado do parser OFX existente (lib/ofx/parser.ts) em StatementLine[]
// canônicas pro motor de conciliação.
//
// Regra de sinal: OFX traz signed em TRNAMT (positivo CREDIT, negativo DEBIT).
// O parser do projeto JÁ separa em type=CREDIT|DEBIT + amount positivo.
// Reconstruímos o signed AQUI pra alimentar reconcileStatement.

import type { OFXParseResult } from '@/lib/ofx/parser'
import type { StatementLine } from './types'

export function parseStatementFromOFX(parsed: OFXParseResult): {
  lines: StatementLine[]
  dtAsOf: Date | null
  ledgerBalance: number | null
} {
  const lines: StatementLine[] = parsed.transactions.map((t) => ({
    datePosted: t.datePosted,
    signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
    memo: t.memo,
    fitid: t.fitid,
  }))
  return {
    lines,
    dtAsOf: parsed.ledgerBalance?.asOfDate ?? null,
    ledgerBalance: parsed.ledgerBalance?.amount ?? null,
  }
}
