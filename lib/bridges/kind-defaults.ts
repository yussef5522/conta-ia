// Sprint PF Fatia 4 — Defaults contábeis por tipo de retirada.
//
// Mapeia kind → tratamento PJ (dreGroup sugerido pra categoria) e
// categoria PF sugerida.
//
// 🚨 IMPORTANTE: a Bridge NÃO muda a categoria/dreGroup da tx PJ existente.
// Esses defaults são SUGESTÕES exibidas na UI ao criar a ponte; serve
// pra UI também pré-selecionar categoria PJ correta quando a tx PJ
// ainda não foi categorizada.
//
// FUNÇÃO PURA — sem DB, sem rede.

import type { BridgeKind } from './types'

export interface KindContabilDefaults {
  kind: BridgeKind
  label: string
  emoji: string
  /** Grupo DRE sugerido pra categoria PJ (null = user escolhe manual). */
  suggestedPjDreGroup: string | null
  /** Categoria PF sugerida (nome — sistema acha pelo nome no plano default). */
  suggestedPfCategoryName: string
  /** Afeta o resultado da DRE da empresa? */
  affectsDre: boolean
  /** Explicação curta pra UI. */
  description: string
}

export const KIND_DEFAULTS: Record<BridgeKind, KindContabilDefaults> = {
  PRO_LABORE: {
    kind: 'PRO_LABORE',
    label: 'Pró-labore',
    emoji: '💼',
    suggestedPjDreGroup: 'DESPESAS_PESSOAL',
    suggestedPfCategoryName: 'Pró-labore/Lucros',
    affectsDre: true,
    description:
      'Despesa com remuneração do sócio. Afeta o resultado da DRE. Implica INSS/IRPF pro sócio.',
  },
  DISTRIBUICAO: {
    kind: 'DISTRIBUICAO',
    label: 'Distribuição de Lucros',
    emoji: '🏷',
    suggestedPjDreGroup: 'DISTRIBUICAO_LUCROS',
    suggestedPfCategoryName: 'Pró-labore/Lucros',
    affectsDre: false,
    description:
      'Distribuição de lucros apurados. NÃO afeta a DRE (reportado fora do resultado). Isento de IR pro sócio até limite legal.',
  },
  REEMBOLSO: {
    kind: 'REEMBOLSO',
    label: 'Reembolso de despesas',
    emoji: '🔄',
    // null = força user escolher (depende do que foi reembolsado)
    suggestedPjDreGroup: null,
    suggestedPfCategoryName: 'Outros Recebimentos',
    affectsDre: true,
    description:
      'Devolução de despesa que o sócio adiantou do bolso. A categoria PJ depende do que foi reembolsado — você escolhe.',
  },
  ADIANTAMENTO: {
    kind: 'ADIANTAMENTO',
    label: 'Adiantamento a sócios',
    emoji: '💸',
    suggestedPjDreGroup: 'DISTRIBUICAO_LUCROS',
    suggestedPfCategoryName: 'Outros Recebimentos',
    affectsDre: false,
    description:
      'Empréstimo informal da empresa pro sócio. NÃO afeta DRE. Contabilmente deveria ser conta patrimonial (Ativo); por simplicidade fica em Distribuição enquanto não temos Balanço.',
  },
  RETIRADA_SOCIOS: {
    kind: 'RETIRADA_SOCIOS',
    label: 'Retirada de sócios (genérica)',
    emoji: '📤',
    suggestedPjDreGroup: 'DISTRIBUICAO_LUCROS',
    suggestedPfCategoryName: 'Pró-labore/Lucros',
    affectsDre: false,
    description:
      'Retirada sem classificação específica. NÃO afeta DRE por default. Pode reclassificar depois com base na apuração contábil.',
  },
}

/** Retorna defaults do kind — lança se kind inválido. */
export function getKindDefaults(kind: BridgeKind): KindContabilDefaults {
  const d = KIND_DEFAULTS[kind]
  if (!d) {
    throw new Error(`Kind inválido: ${kind}`)
  }
  return d
}

/** Sugere kind baseado em SocioPF.papel (Sprint 5.0.2.h). */
export function suggestKindFromSocioPapel(papel: string): BridgeKind {
  // ADMINISTRADOR e FAMILIAR → tipicamente recebem pró-labore (regular)
  if (papel === 'ADMINISTRADOR' || papel === 'FAMILIAR') {
    return 'PRO_LABORE'
  }
  // SOCIO genérico → distribuição (lucros)
  return 'DISTRIBUICAO'
}
