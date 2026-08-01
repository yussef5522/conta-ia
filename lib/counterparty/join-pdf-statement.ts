// Sprint Contraparte PIX (31/07/2026) — FASE 5: JOIN puro entre as linhas do PDF
// (com NOME) e as transações JÁ EXISTENTES do OFX. NÃO grava nada, NÃO cria, NÃO
// altera valor/data/categoria. Só decide QUAL nome atribuir a QUAL transação.
//
// Chave: (DOCUMENTO == externalId/FITID, valor absoluto). Classificação:
//  - EXACT: a chave tem UM único nome no PDF → atribui (a 1+ tx daquela chave).
//  - AMBIGUOUS: a chave tem 2+ nomes DIVERGENTES (caso do documento '000000'
//    compartilhado) → NÃO adivinha, marca pra escolha manual.
//  - NO_MATCH: nenhuma linha do PDF com nome pra aquela chave.
//
// Conservador de propósito: NÃO desempata por dia nesta rodada, garantindo que
// nenhuma chave ambígua receba nome automático (princípio: erro visível > perda
// silenciosa). Nome definido MANUALMENTE nunca é proposto pra sobrescrita.

import { normalizeCounterparty } from './normalize'
import type { BankStatementLine } from '@/lib/bank-statement-pdf/types'

export interface JoinTxInput {
  id: string
  externalId: string | null // FITID == DOCUMENTO do PDF
  amount: number // absoluto
  description: string
  counterpartySource: string | null // se 'MANUAL', protegido
}

export interface CounterpartyAssignment {
  txId: string
  counterpartyName: string
  documento: string
  amount: number
  confidence: 'EXACT'
}
export interface AmbiguousKey {
  documento: string
  amount: number
  candidateNames: string[]
  txIds: string[]
}
export interface JoinResult {
  exact: CounterpartyAssignment[]
  ambiguous: AmbiguousKey[]
  noMatchTxIds: string[]
  stats: {
    txTotal: number
    exactCount: number
    ambiguousKeys: number
    ambiguousTxCount: number
    noMatchCount: number
    manualProtected: number
  }
}

const keyOf = (documento: string, amount: number) =>
  `${documento.toUpperCase()}|${amount.toFixed(2)}`

export function joinPdfStatement(
  pdfLines: BankStatementLine[],
  txs: JoinTxInput[],
): JoinResult {
  // PDF: chave → nomes distintos (display + normalizado) das linhas COM nome.
  const pdfNamesByKey = new Map<string, Map<string, string>>() // key → (normalizado → display)
  for (const l of pdfLines) {
    if (!l.counterpartyName) continue
    const k = keyOf(l.documento, l.amount)
    const norm = normalizeCounterparty(l.counterpartyName)
    if (!norm) continue
    if (!pdfNamesByKey.has(k)) pdfNamesByKey.set(k, new Map())
    if (!pdfNamesByKey.get(k)!.has(norm)) pdfNamesByKey.get(k)!.set(norm, l.counterpartyName.trim())
  }

  // Transações agrupadas por chave.
  const txByKey = new Map<string, JoinTxInput[]>()
  for (const t of txs) {
    if (!t.externalId) continue
    const k = keyOf(t.externalId, Math.abs(t.amount))
    if (!txByKey.has(k)) txByKey.set(k, [])
    txByKey.get(k)!.push(t)
  }

  const exact: CounterpartyAssignment[] = []
  const ambiguous: AmbiguousKey[] = []
  const noMatchTxIds: string[] = []
  let manualProtected = 0

  for (const [k, group] of txByKey) {
    const names = pdfNamesByKey.get(k)
    // separa as manuais (protegidas) das candidatas a receber nome
    const candidatos = group.filter((t) => {
      if (t.counterpartySource === 'MANUAL') {
        manualProtected++
        return false
      }
      return true
    })

    if (!names || names.size === 0) {
      for (const t of candidatos) noMatchTxIds.push(t.id)
      continue
    }

    if (names.size === 1) {
      const display = [...names.values()][0]
      const [documento, amountStr] = k.split('|')
      for (const t of candidatos) {
        exact.push({
          txId: t.id,
          counterpartyName: display,
          documento,
          amount: parseFloat(amountStr),
          confidence: 'EXACT',
        })
      }
    } else {
      // 2+ nomes divergentes pra mesma chave → AMBÍGUO (documento '000000' etc.)
      const [documento, amountStr] = k.split('|')
      ambiguous.push({
        documento,
        amount: parseFloat(amountStr),
        candidateNames: [...names.values()],
        txIds: candidatos.map((t) => t.id),
      })
    }
  }

  return {
    exact,
    ambiguous,
    noMatchTxIds,
    stats: {
      txTotal: txs.length,
      exactCount: exact.length,
      ambiguousKeys: ambiguous.length,
      ambiguousTxCount: ambiguous.reduce((s, a) => s + a.txIds.length, 0),
      noMatchCount: noMatchTxIds.length,
      manualProtected,
    },
  }
}
