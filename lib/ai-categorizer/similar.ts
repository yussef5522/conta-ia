// Busca de transações similares pra bulk apply — Fase 3 Etapa 1.
// Função PURA — sem Prisma.
//
// Caso de uso: user classifica 1 "FABIO UECKER - Pix | Maquininha" como Vendas.
// Queremos achar TODAS as outras pendentes com padrão equivalente (276 outras
// pessoas, mesma raiz "pix | maquininha") pra oferecer bulk apply.

import { normalizeDescription, normalizeExact } from './normalize'
import type { TipoMatch, TxSnapshot } from './types'

export interface SimilarSearchInput {
  // Descrição da transação base (a que o user acabou de classificar)
  baseDescription: string
  // Qual tipo de match usar (decidido por buildNewRule):
  //   EXACT       → casa só descrição literal igual
  //   NORMALIZED  → casa descrição após strip prefixo/data
  tipoMatch: TipoMatch
  // Pool de transações candidatas (já filtradas por companyId+PENDING pelo caller)
  candidatas: TxSnapshot[]
}

// Retorna apenas as transações que casam o padrão, excluindo a própria base.
// Pré-condição: caller já filtrou multi-tenant + PENDING + sem categoria.
export function findSimilarTransactions(
  input: SimilarSearchInput,
  baseTxId?: string,
): TxSnapshot[] {
  const { baseDescription, tipoMatch, candidatas } = input
  if (!baseDescription) return []

  const targetPattern =
    tipoMatch === 'EXACT'
      ? normalizeExact(baseDescription)
      : normalizeDescription(baseDescription)

  return candidatas.filter((tx) => {
    // Exclui a própria base (caller pode passar ela na lista)
    if (baseTxId && tx.id === baseTxId) return false
    // Defesa: só pendente/sem categoria
    if (tx.categoryId !== null) return false
    const txPattern =
      tipoMatch === 'EXACT'
        ? normalizeExact(tx.description)
        : normalizeDescription(tx.description)
    return txPattern === targetPattern
  })
}

// Para o header "Top padrões mais frequentes pendentes" (visibilidade futura).
// Retorna lista ordenada por frequência desc.
export interface PatternFrequency {
  padrao: string
  count: number
  totalAmount: number
  sampleDescriptions: string[]
}

export function topPendingPatterns(
  candidatas: TxSnapshot[],
  limit = 10,
): PatternFrequency[] {
  const map = new Map<
    string,
    { count: number; totalAmount: number; samples: Set<string> }
  >()

  for (const tx of candidatas) {
    if (tx.categoryId !== null) continue
    const padrao = normalizeDescription(tx.description)
    if (!padrao) continue
    const entry = map.get(padrao) ?? {
      count: 0,
      totalAmount: 0,
      samples: new Set<string>(),
    }
    entry.count += 1
    entry.totalAmount += Math.abs(tx.amount)
    if (entry.samples.size < 3) entry.samples.add(tx.description)
    map.set(padrao, entry)
  }

  return Array.from(map.entries())
    .map(([padrao, v]) => ({
      padrao,
      count: v.count,
      totalAmount: Math.round(v.totalAmount * 100) / 100,
      sampleDescriptions: Array.from(v.samples),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
