// Sprint 5.0.2.f — Roteamento CNAE/ramo → margem de presunção.
//
// Deriva a `AtividadePresumido` correta a partir do CNAE (via
// `deriveActivityFromCNAE` — Sprint 5.0.2.c.2) e devolve a margem
// IRPJ/CSLL da tabela legal (Lei 9.249/95 art. 15 + Lei 9.430/96 art. 20).
//
// NÃO duplica a tabela MARGENS_PRESUNCAO_2026 — apenas consolida o caminho
// "CNAE → margem" para o comparison engine não precisar de inputs manuais.

import { deriveActivityFromCNAE, type AtividadePresumido } from './derive-activity-from-cnae'
import {
  findMargemPresuncao,
  type PresuncaoMargem,
} from './lucro-presumido-tables'

export interface PresumidoMargemDerivada extends PresuncaoMargem {
  source: 'cnae-expertise' | 'cnae-heuristic' | 'fallback'
}

/**
 * Devolve a margem de presunção a partir do CNAE (catálogo expertise ou
 * heurística por prefixo CNAE 2.3). Fallback conservador: SERVICOS (32/32).
 */
export function getPresumidoMargem(cnaeCode?: string | null): PresumidoMargemDerivada {
  const derived = deriveActivityFromCNAE(cnaeCode)
  const margem = findMargemPresuncao(derived.presumidoAtividade)

  if (!margem) {
    // Não deve acontecer (todas as 8 atividades estão na tabela), mas defensivo:
    const fallback = findMargemPresuncao('SERVICOS')!
    return { ...fallback, source: 'fallback' }
  }

  return {
    ...margem,
    source: derived.source === 'expertise' ? 'cnae-expertise' : derived.source === 'prefix-heuristic' ? 'cnae-heuristic' : 'fallback',
  }
}

/**
 * Helper pra UI: mostra "Atividade derivada: COMERCIO (8% IRPJ, 12% CSLL)".
 */
export function describePresumidoMargem(cnaeCode?: string | null): string {
  const m = getPresumidoMargem(cnaeCode)
  return `${m.atividade} (IRPJ ${m.margemIRPJ}% · CSLL ${m.margemCSLL}%)`
}

export type { AtividadePresumido }
