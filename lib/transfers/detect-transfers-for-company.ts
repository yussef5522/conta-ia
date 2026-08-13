// Sprint Motor-Único-Transferência — FASE 4. FONTE ÚNICA server-side: carrega as
// tx órfãs + refs + valores comuns e roda o motor único (3 camadas). TODAS as
// telas migradas chamam ISTO — é o que garante que não discordem entre si.

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { loadOwnEntityRefs } from './load-own-entity-refs'
import { loadIgnoredKeys } from './suggestion-events'
import {
  detectTransfers,
  type UnifiedTx,
  type UnifiedDetectResult,
} from './unified-transfer-engine'

const MS_DAY = 86400000

// Teto de carga. Com a JANELA POR VALOR no motor (detectTransfers), casar 6.5k
// órfãs é ~1ms — o teto de 3.000 ficou obsoleto (descartava os mais ANTIGOS em
// silêncio). Subido pra 20.000: cobre folgado qualquer empresa real e ainda
// protege memória/query de conta patológica. Se BATER, o aviso é proporcional.
const DEFAULT_CAP = 20000

/** Cobertura da análise — pra AVISAR quando o teto corta (nunca silencioso). */
export interface DetectCoverage {
  /** órfãs efetivamente analisadas (o que entrou no motor). */
  analyzed: number
  /** total de órfãs no escopo (pode ser > analyzed se bateu o teto). */
  total: number
  /** o teto cortou? (total > analyzed). */
  truncated: boolean
  /** teto aplicado. */
  cap: number
}

export type DetectForCompanyResult = UnifiedDetectResult & { coverage: DetectCoverage }

export async function detectTransfersForCompany(
  companyId: string,
  opts: { sinceDays?: number; cap?: number; matchOwnerName?: boolean } = {},
): Promise<DetectForCompanyResult> {
  const since = new Date(Date.now() - (opts.sinceDays ?? 365) * MS_DAY)

  const refs = await loadOwnEntityRefs(prisma, companyId)

  // valores que aparecem 3+ vezes em 60d (penalidade anti-coincidência).
  const vc = await prisma.transaction.groupBy({
    by: ['amount'],
    where: { bankAccount: { companyId }, date: { gte: new Date(Date.now() - 60 * MS_DAY) } },
    _count: { _all: true },
  })
  const valorComum = new Set(
    vc.filter((v) => v._count._all >= 3).map((v) => Math.round(v.amount * 100) / 100),
  )

  // Órfãs EFFECTED (realizadas), sem grupo, não-internas — NÃO exige PENDING
  // (a regra "2× PENDING" do motor B saiu). Ambos os tipos.
  const orfaWhere: Prisma.TransactionWhereInput = {
    bankAccount: { companyId },
    type: { in: ['CREDIT', 'DEBIT'] },
    lifecycle: 'EFFECTED',
    transferGroupId: null,
    transferDismissedAt: null,
    isInternalTransfer: false,
    date: { gte: since },
  }
  const cap = opts.cap ?? DEFAULT_CAP
  // count pro AVISO: quantas órfãs existem no total (pra dizer "X de N").
  const total = await prisma.transaction.count({ where: orfaWhere })
  const orfas = await prisma.transaction.findMany({
    where: orfaWhere,
    select: {
      id: true,
      bankAccountId: true,
      date: true,
      type: true,
      amount: true,
      description: true,
      status: true,
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: cap,
  })

  const txs: UnifiedTx[] = orfas
    .filter((t) => t.bankAccountId)
    .map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId!,
      bankAccountName: t.bankAccount?.name ?? undefined,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      status: t.status,
    }))

  // Pares IGNORADOS pelo usuário — o motor não os re-sugere (não voltam ao banner).
  const ignoredKeys = await loadIgnoredKeys(prisma, companyId)
  const result = detectTransfers(txs, { refs, valorComum, matchOwnerName: opts.matchOwnerName, ignoredKeys })
  return {
    ...result,
    coverage: { analyzed: txs.length, total, truncated: total > txs.length, cap },
  }
}
