// Sprint Wiring-do-Juiz (14/08) — a cola DB-aware do choke-point.
//
// O preview e o confirm chamam ESTA função (a mesma), então não têm como divergir
// (se a tela mostra uma coisa e grava outra é pior que não ter juiz). Ela carrega
// os blobs dos imports anteriores, reconstrói o canônico de cada um e roda a
// decisão única (`classifyCanonicalForImport`). PURO por dentro (o classify não
// toca DB); só a leitura dos blobs é I/O.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { OFXParseResult } from '@/lib/ofx/parser'
import { toCanonical, toCanonicalFromParsed, contentKey } from '@/lib/canonical/to-canonical'
import {
  classifyCanonicalForImport,
  type ClassifyResult,
  type PriorCanonical,
} from '@/lib/canonical/classify-for-import'
import { resolveBankProfile } from '@/lib/bank-profiles/registry'

type Db = PrismaClient | Prisma.TransactionClient

export interface ResolvedImportStatuses {
  classify: ClassifyResult
  /** contentKey(fitid,date,signed,memo) → IMPORTA? (pro PREVIEW, que só tem as novas). */
  importableByKey: Map<string, boolean>
}

/**
 * Resolve o status DEFINITIVO de cada linha do extrato (importa/não importa) pelo
 * juiz, encadeando os extratos anteriores. `classify.importable[i]` alinha 1:1 com
 * `parsed.transactions[i]` (o confirm usa por índice; o preview usa o mapa por
 * conteúdo). `classify.blocked` = NÃO gravar (mostra na tela).
 */
export async function resolveImportStatuses(
  db: Db,
  input: {
    bankAccountId: string
    parsed: OFXParseResult
    rawOfx: string
    /** download-time (createdAt do import). Só desempata prior do MESMO asOf. */
    dtServer: Date
    /** exclui o próprio registro (quando já criado cedo) dos anteriores. */
    currentImportId?: string | null
  },
): Promise<ResolvedImportStatuses> {
  const current = toCanonicalFromParsed(input.parsed, input.rawOfx)
  const profile = resolveBankProfile(input.parsed.bankId)
  const ledgerBalReliable = profile?.ledgerBalReliable ?? true

  const priorRows = await db.ofxImport.findMany({
    where: {
      bankAccountId: input.bankAccountId,
      rawOfxBlob: { not: null },
      ...(input.currentImportId ? { id: { not: input.currentImportId } } : {}),
    },
    select: { rawOfxBlob: true, createdAt: true },
  })
  const priors: PriorCanonical[] = []
  for (const r of priorRows) {
    try {
      const canon = toCanonical(r.rawOfxBlob as string)
      if (canon.ledger.asOf) priors.push({ canonical: canon, dtServer: r.createdAt })
    } catch {
      // blob ilegível (ex: PDF de fatura salvo na mesma tabela) — ignora.
    }
  }

  const classify = classifyCanonicalForImport({
    current,
    currentDtServer: input.dtServer,
    priors,
    ledgerBalReliable,
  })

  const importableByKey = new Map<string, boolean>()
  input.parsed.transactions.forEach((t, i) => {
    const signed = t.type === 'CREDIT' ? t.amount : -t.amount
    importableByKey.set(contentKey(t.fitid, t.datePosted, signed, t.memo), classify.importable[i])
  })

  return { classify, importableByKey }
}
