// Sprint Preview-Truth (29/06/2026) — contrato declarativo do confirm.
//
// A UI envia ao confirm uma lista de decisões POR LINHA (dedupHash). O
// backend respeita EXATAMENTE: o que está SKIP não vira tx; o que está
// CREATE_NEW vira. Resolve o problema-raiz "preview ≠ confirm":
//   - "consórcio 09/07" desmarcado pelo usuário não entrava → agora entra (= SKIP)
//   - "86 vira 91" → contagem do preview = contagem do confirm
//
// Defensivo: se uma linha do arquivo NÃO está na lista, default seguro =
// CREATE_NEW (não perder tx). Mas logamos pra auditoria.

import { z } from 'zod'

export const IMPORT_DECISION_ACTIONS = [
  'CREATE_NEW',
  'SKIP',
  'REPLACE_MANUAL',
  'CONCILIATE_PAYABLE',
] as const

export type ImportDecisionAction = (typeof IMPORT_DECISION_ACTIONS)[number]

export const importDecisionSchema = z.object({
  dedupHash: z.string().min(8),
  action: z.enum(IMPORT_DECISION_ACTIONS),
})

export const importDecisionsSchema = z
  .array(importDecisionSchema)
  .max(2000, 'Máximo 2000 decisões por confirm')

export type ImportDecision = z.infer<typeof importDecisionSchema>

/**
 * Filtra a lista de novas baseado nas decisões do preview.
 * Política:
 *  - `SKIP`: linha removida da lista (não vira tx).
 *  - Outras (`CREATE_NEW`, `REPLACE_MANUAL`, `CONCILIATE_PAYABLE`): mantém.
 *  - Sem decisão pra um dedupHash: default = CREATE_NEW (não perder tx),
 *    mas conta como "implicit" pra log de auditoria.
 *
 * Função pura — sem efeito colateral.
 */
export interface ApplyDecisionsResult<T extends { dedupHash: string }> {
  /** Tx que devem ser criadas (filtradas). */
  filtered: T[]
  /** Quantas linhas o usuário pediu pra pular. */
  skipped: number
  /** Quantas linhas não tinham decisão (default CREATE_NEW). */
  implicit: number
  /** dedupHashes que estavam na lista mas não aparecem no arquivo (decisão órfã). */
  orphanDecisionHashes: string[]
}

export function applyImportDecisions<T extends { dedupHash: string }>(
  novas: ReadonlyArray<T>,
  decisions: ReadonlyArray<ImportDecision> | null | undefined,
): ApplyDecisionsResult<T> {
  if (!decisions || decisions.length === 0) {
    return {
      filtered: [...novas],
      skipped: 0,
      implicit: novas.length,
      orphanDecisionHashes: [],
    }
  }
  const decisionByHash = new Map<string, ImportDecisionAction>()
  for (const d of decisions) {
    decisionByHash.set(d.dedupHash, d.action)
  }
  const filtered: T[] = []
  let skipped = 0
  let implicit = 0
  const seenInFile = new Set<string>()
  for (const t of novas) {
    seenInFile.add(t.dedupHash)
    const action = decisionByHash.get(t.dedupHash)
    if (action === 'SKIP') {
      skipped += 1
      continue
    }
    if (action === undefined) {
      implicit += 1
    }
    filtered.push(t)
  }
  const orphanDecisionHashes: string[] = []
  for (const d of decisions) {
    if (!seenInFile.has(d.dedupHash)) {
      orphanDecisionHashes.push(d.dedupHash)
    }
  }
  return { filtered, skipped, implicit, orphanDecisionHashes }
}
