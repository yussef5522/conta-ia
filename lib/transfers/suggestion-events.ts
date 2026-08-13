// Sprint TransferSuggestionEvent (13/08/2026) — registro sugestão→desfecho.
//
// Resolve 2 coisas: (1) MEDIR se o motor acerta (taxa de confirmação, pré-req pra
// aposentar o legado); (2) o "ignorar" que voltava a aparecer — par ignorado NÃO
// reaparece no banner (não é mais porta sem volta; dá pra reverter).
//
// Chave por PAR (debitTxId, creditTxId). engine='unified' = o MOTOR sugeriu;
// 'manual' = o usuário achou sozinho (confirmou sem sugestão prévia).

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export const pairKey = (debitTxId: string, creditTxId: string) => `${debitTxId}|${creditTxId}`

export interface SuggestedPair {
  debitTxId: string
  creditTxId: string
  layer?: string | null
  confidence?: number | null
  evidences?: string[] | null
}

/**
 * Registra as sugestões do motor como SUGGESTED (idempotente — NÃO duplica a cada
 * load e NÃO sobrescreve pares já CONFIRMED/IGNORED). Roda no detect (banner).
 */
export async function recordSuggested(
  db: Db,
  companyId: string,
  pairs: SuggestedPair[],
): Promise<void> {
  for (const p of pairs) {
    await db.transferSuggestionEvent.upsert({
      where: { debitTxId_creditTxId: { debitTxId: p.debitTxId, creditTxId: p.creditTxId } },
      // existe (SUGGESTED/CONFIRMED/IGNORED) → não toca (preserva o desfecho).
      update: {},
      create: {
        companyId,
        debitTxId: p.debitTxId,
        creditTxId: p.creditTxId,
        layer: p.layer ?? null,
        confidence: p.confidence ?? null,
        evidences: p.evidences ? JSON.stringify(p.evidences) : null,
        engine: 'unified',
        outcome: 'SUGGESTED',
      },
    })
  }
}

export interface ConfirmedPair {
  debitTxId: string
  creditTxId: string
  confidence?: number | null
  layer?: string | null
}

/**
 * Marca CONFIRMED. Se havia SUGGESTED (unified) → vira CONFIRMED mantendo
 * engine='unified' (o MOTOR acertou). Se não havia → cria engine='manual' (o
 * usuário achou sozinho no /parear). É isso que distingue os dois na medição.
 */
export async function recordConfirmed(
  db: Db,
  companyId: string,
  pairs: ConfirmedPair[],
): Promise<void> {
  for (const p of pairs) {
    await db.transferSuggestionEvent.upsert({
      where: { debitTxId_creditTxId: { debitTxId: p.debitTxId, creditTxId: p.creditTxId } },
      update: { outcome: 'CONFIRMED', resolvedAt: new Date() },
      create: {
        companyId,
        debitTxId: p.debitTxId,
        creditTxId: p.creditTxId,
        layer: p.layer ?? null,
        confidence: p.confidence ?? null,
        engine: 'manual', // confirmou sem sugestão prévia → achou sozinho
        outcome: 'CONFIRMED',
        resolvedAt: new Date(),
      },
    })
  }
}

/** Marca IGNORED (upsert). Par ignorado é filtrado do banner (não reaparece). */
export async function recordIgnored(
  db: Db,
  companyId: string,
  pairs: Array<{ debitTxId: string; creditTxId: string }>,
): Promise<void> {
  for (const p of pairs) {
    await db.transferSuggestionEvent.upsert({
      where: { debitTxId_creditTxId: { debitTxId: p.debitTxId, creditTxId: p.creditTxId } },
      update: { outcome: 'IGNORED', resolvedAt: new Date() },
      create: {
        companyId,
        debitTxId: p.debitTxId,
        creditTxId: p.creditTxId,
        engine: 'unified',
        outcome: 'IGNORED',
        resolvedAt: new Date(),
      },
    })
  }
}

/** Conjunto de chaves IGNORED da empresa — pra o detect NÃO re-sugerir. */
export async function loadIgnoredKeys(db: Db, companyId: string): Promise<Set<string>> {
  const rows = await db.transferSuggestionEvent.findMany({
    where: { companyId, outcome: 'IGNORED' },
    select: { debitTxId: true, creditTxId: true },
  })
  return new Set(rows.map((r) => pairKey(r.debitTxId, r.creditTxId)))
}

/** Lista as sugestões IGNORADAS (pra tela de "voltar atrás"). */
export async function listIgnored(db: Db, companyId: string) {
  return db.transferSuggestionEvent.findMany({
    where: { companyId, outcome: 'IGNORED' },
    orderBy: { resolvedAt: 'desc' },
    select: { id: true, debitTxId: true, creditTxId: true, layer: true, confidence: true, evidences: true, resolvedAt: true },
  })
}

/** Reverte um IGNORED (apaga o evento) → o par volta a poder ser sugerido. */
export async function revertIgnored(db: Db, companyId: string, eventId: string): Promise<boolean> {
  const ev = await db.transferSuggestionEvent.findFirst({
    where: { id: eventId, companyId, outcome: 'IGNORED' },
    select: { id: true },
  })
  if (!ev) return false
  await db.transferSuggestionEvent.delete({ where: { id: ev.id } })
  return true
}
