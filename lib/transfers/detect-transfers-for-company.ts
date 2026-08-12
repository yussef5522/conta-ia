// Sprint Motor-Único-Transferência — FASE 4. FONTE ÚNICA server-side: carrega as
// tx órfãs + refs + valores comuns e roda o motor único (3 camadas). TODAS as
// telas migradas chamam ISTO — é o que garante que não discordem entre si.

import { prisma } from '@/lib/db'
import { loadOwnEntityRefs } from './load-own-entity-refs'
import {
  detectTransfers,
  type UnifiedTx,
  type UnifiedDetectResult,
} from './unified-transfer-engine'

const MS_DAY = 86400000

export async function detectTransfersForCompany(
  companyId: string,
  opts: { sinceDays?: number; cap?: number; matchOwnerName?: boolean } = {},
): Promise<UnifiedDetectResult> {
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
  const orfas = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      type: { in: ['CREDIT', 'DEBIT'] },
      lifecycle: 'EFFECTED',
      transferGroupId: null,
      transferDismissedAt: null,
      isInternalTransfer: false,
      date: { gte: since },
    },
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
    take: opts.cap ?? 3000,
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

  return detectTransfers(txs, { refs, valorComum, matchOwnerName: opts.matchOwnerName })
}
