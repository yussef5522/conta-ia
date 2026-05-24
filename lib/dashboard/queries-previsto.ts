// Sprint 4.0.3 — query server-side pra Fluxo Previsto + Alertas.
// Carrega todas PAYABLE/RECEIVABLE PENDING da empresa + saldo total das contas,
// passa pras funções puras computeFluxoPrevisto + classifyAlertas.

import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { computeFluxoPrevisto, type FluxoPrevistoResult, type PendenteTx } from './fluxo-previsto'
import { classifyAlertas, type AlertasResult, type VencimentoTx } from './alertas'

const CACHE_TTL_SECONDS = 300 // 5min

export interface PrevistoSnapshot {
  fluxoPrevisto: FluxoPrevistoResult
  alertas: AlertasResult
}

export async function getFluxoPrevistoSnapshot(
  companyId: string,
): Promise<PrevistoSnapshot> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  const cached = unstable_cache(
    async () => loadFluxoPrevisto(companyId),
    [`dashboard:fluxo-previsto:${companyId}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  const raw = await cached()
  // Rehydrata Date (unstable_cache serializa pra string)
  return {
    fluxoPrevisto: {
      ...raw.fluxoPrevisto,
    },
    alertas: raw.alertas,
  }
}

async function loadFluxoPrevisto(companyId: string): Promise<PrevistoSnapshot> {
  // Multi-tenant via OR (PAYABLE/RECEIVABLE podem não ter bankAccount)
  const tenantOR = {
    OR: [
      { bankAccount: { companyId } },
      { supplier: { companyId } },
      { customer: { companyId } },
      { category: { companyId } },
    ],
  }

  const [pendentesRaw, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        ...tenantOR,
        lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
        status: 'PENDING',
        reconciledWithId: null,
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        lifecycle: true,
      },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { balance: true },
    }),
  ])

  const pendentes: PendenteTx[] = pendentesRaw.map((t) => ({
    id: t.id,
    amount: t.amount,
    dueDate: t.dueDate,
    lifecycle: t.lifecycle as 'PAYABLE' | 'RECEIVABLE',
  }))

  const vencimentoTxs: VencimentoTx[] = pendentes.map((p) => ({
    id: p.id,
    amount: p.amount,
    dueDate: p.dueDate,
  }))

  const saldoAtual = accounts.reduce((s, a) => s + a.balance, 0)

  return {
    fluxoPrevisto: computeFluxoPrevisto(pendentes, saldoAtual),
    alertas: classifyAlertas(vencimentoTxs),
  }
}
