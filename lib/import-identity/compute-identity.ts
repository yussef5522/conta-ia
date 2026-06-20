// Sprint Import Idempotente (18/06/2026) — cálculo da IDENTIDADE CANÔNICA.
//
// Toda transação importada (OFX, Excel, PDF, Manual) passa por aqui pra
// gerar `fitidKey` (nullable) e `contentHash` (sempre presente). Esses 2
// campos persistem em `transactions` e em `imported_identities` (seen-ledger).
//
// Função PURA — não acessa DB. Caller carrega input, recebe output.

import { createHash } from 'crypto'
import { extractDateKey, valorToCents, buildDescription } from './normalize'
import { isFitidConfiavel } from './heuristic-fitid'

export interface IdentityInput {
  /** ID da conta bancária ou perfil PF (scope da identidade) */
  accountId: string
  /** FITID do OFX, ou null/undefined em Excel/Manual */
  fitid?: string | null
  /** DTPOSTED string OFX ("20260612...") OU Date object */
  date: string | Date
  /** Valor absoluto (positivo) */
  amount: number
  /** Tipo (CREDIT / DEBIT / TRANSFER) */
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
  /**
   * Sprint ContentHash Estável (20/06/2026): direção pra TRANSFER.
   * Quando type=TRANSFER, esta direção determina o sinal:
   *   IN  -> +cents (entrada na conta — equivalente a CREDIT)
   *   OUT -> -cents (saída da conta  — equivalente a DEBIT)
   * Resultado: DEBIT incoming bate o contentHash do TRANSFER OUT no DB.
   * Ignora pra type CREDIT/DEBIT.
   */
  transferDirection?: 'IN' | 'OUT' | null
  /** NAME do OFX */
  name?: string | null
  /** MEMO do OFX (ou descrição livre Excel/Manual) */
  memo?: string | null
}

export interface IdentityOutput {
  /** sha256(accountId|FITID) — null quando FITID não confiável ou ausente */
  fitidKey: string | null
  /** sha256(accountId|yyyymmdd|valorCentavos|descNormalizada) — SEMPRE presente */
  contentHash: string
  /** Diagnóstico (debug/logs/relatório) */
  parts: {
    dateKey: string
    valorCentavos: number
    description: string
    fitidConfiavel: boolean
  }
}

export function computeIdentity(input: IdentityInput): IdentityOutput {
  const dateKey = extractDateKey(input.date)
  const valorCentavos = valorToCents(
    input.amount,
    input.type,
    input.transferDirection,
  )
  const description = buildDescription(input.name, input.memo)

  const fitidConfiavel = isFitidConfiavel(input.fitid)
  const fitidKey = fitidConfiavel
    ? sha256(`${input.accountId}|${(input.fitid || '').trim()}`)
    : null

  const contentHash = sha256(
    `${input.accountId}|${dateKey}|${valorCentavos}|${description}`,
  )

  return {
    fitidKey,
    contentHash,
    parts: { dateKey, valorCentavos, description, fitidConfiavel },
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}
