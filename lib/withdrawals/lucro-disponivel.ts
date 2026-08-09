// Sprint Fechar-Ponte (08/08/2026) — cálculo do "lucro disponível" da empresa,
// mesma fonte da verdade do relatório DRE (reusa computeDreResult, com reinjeção
// de encargo de empréstimo etc). Período = desde a 1ª transação da empresa.
//
// A.8: cálculo pode ser pesado (varre tudo desde a fundação) → cache curto
// em memória por empresa. A tela da ponte não pode demorar pra abrir.

import { prisma } from '@/lib/db'
import { computeDreResult } from '@/app/api/empresas/[id]/dre/route'
import { computeDisponivelStatus } from './lucro-context'
import { WITHDRAWAL_DRE_GROUPS } from './is-orphan'

export interface LucroDisponivel {
  /** 'YYYY-MM' da 1ª transação — mostrado na tela ("desde 05/2026"). */
  desde: string
  startDate: string
  endDate: string
  lucroApurado: number
  distribuido: number
  disponivel: number
  /** true = distribuiu além do apurado (adiantamento). NÃO é erro. */
  negativo: boolean
  naoClassificado: { count: number; valor: number }
}

const cache = new Map<string, { at: number; data: LucroDisponivel | null }>()
const TTL_MS = 30_000

export function invalidateLucroCache(companyId: string) {
  cache.delete(companyId)
}

export async function computeLucroDisponivel(
  companyId: string,
  opts?: { skipCache?: boolean },
): Promise<LucroDisponivel | null> {
  const hit = cache.get(companyId)
  if (!opts?.skipCache && hit && Date.now() - hit.at < TTL_MS) return hit.data

  // Marco do período: 1ª transação da empresa
  const first = await prisma.transaction.findFirst({
    where: { bankAccount: { companyId } },
    orderBy: { date: 'asc' },
    select: { date: true },
  })
  if (!first) {
    cache.set(companyId, { at: Date.now(), data: null })
    return null
  }

  const startDate = first.date
  const endDate = new Date()

  // DRE real do período (regime caixa, realizado) — MESMA lógica do relatório
  const dre = await computeDreResult(companyId, {
    startDate,
    endDate,
    regime: 'cash',
    view: 'realizado',
    searchRange: { start: startDate, end: endDate },
    comparison: undefined,
  })
  const lucroApurado = Math.round((dre.totals.lucroLiquido ?? 0) * 100) / 100

  // Já distribuído = SOMA das pontes kind=DISTRIBUICAO (dado gravado na ponte,
  // não nome de categoria — decisão do Yussef, e é o que já estava funcionando).
  const dist = await prisma.pJtoPFBridge.aggregate({
    where: { companyId, kind: 'DISTRIBUICAO' },
    _sum: { amount: true },
  })
  const distribuido = Math.round((dist._sum.amount ?? 0) * 100) / 100

  // Não classificado = retiradas órfãs (mesma definição de is-orphan.ts)
  const orfWhere = {
    bankAccount: { companyId },
    type: 'DEBIT' as const,
    lifecycle: 'EFFECTED' as const,
    isInternalTransfer: false,
    transferGroupId: null,
    bridge: { is: null },
    category: { dreGroup: { in: Array.from(WITHDRAWAL_DRE_GROUPS) } },
  }
  const [orfCount, orfAgg] = await Promise.all([
    prisma.transaction.count({ where: orfWhere }),
    prisma.transaction.aggregate({ where: orfWhere, _sum: { amount: true } }),
  ])

  const { disponivel, negativo } = computeDisponivelStatus(lucroApurado, distribuido)

  const data: LucroDisponivel = {
    desde: startDate.toISOString().slice(0, 7),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    lucroApurado,
    distribuido,
    disponivel,
    negativo,
    naoClassificado: {
      count: orfCount,
      valor: Math.round((orfAgg._sum.amount ?? 0) * 100) / 100,
    },
  }
  cache.set(companyId, { at: Date.now(), data })
  return data
}
