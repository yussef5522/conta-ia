// Sprint 5.0.2.c — Knowledge Base index.
//
// Agrega todo o conhecimento tributário 2026 num único ponto de import.
// Próxima sprint (5.0.2.d) vai consumir essa base via Claude analyzing
// (passa knowledge relevante no system prompt + RAG por tópico).

export { SIMPLES_NACIONAL, type SimplesNacionalKnowledge } from './01-simples-nacional'
export { LUCRO_PRESUMIDO, type LucroPresumidoKnowledge } from './02-lucro-presumido'
export { LUCRO_REAL, type LucroRealKnowledge } from './03-lucro-real'
export { REFORMA_TRIBUTARIA, type ReformaTributariaKnowledge } from './04-reforma-tributaria'
export { BENEFICIOS_FISCAIS, type BeneficiosFiscaisKnowledge } from './05-beneficios-fiscais'
export {
  SUBSTITUICAO_TRIBUTARIA,
  type SubstituicaoTributariaKnowledge,
} from './06-substituicao-tributaria'
export {
  PIS_COFINS_MONOFASICO,
  type PISCofinsMonofasicoKnowledge,
} from './07-pis-cofins-monofasico'
export {
  ESTADOS_PARTICULARIDADES,
  type EstadosParticularidadesKnowledge,
} from './08-estados-particularidades'
export { FATOR_R, type FatorRKnowledge } from './09-fator-r'
export { JURISPRUDENCIA, type JurisprudenciaKnowledge } from './10-jurisprudencia'

// Sprint 5.0.2.g — Knowledge Base PROFUNDA (10 arquivos especializados)
export { RESTAURANTES_KB } from './deep/01-restaurantes-completo'
export { ACADEMIAS_KB } from './deep/02-academias-completo'
export { COMERCIO_ROUPA_KB } from './deep/03-comercio-roupa-completo'
export { GRANDES_REDES_KB } from './deep/04-grandes-redes-benchmarks'
export { ICMS_ST_POR_ESTADO_KB } from './deep/05-icms-st-por-estado'
export { PIS_COFINS_CREDITOS_KB } from './deep/06-pis-cofins-creditos'
export { FATOR_R_KB as FATOR_R_DEEP_KB } from './deep/07-fator-r-completo'
export { PERSE_KB } from './deep/08-perse-detalhado'
export { REFORMA_TRIBUTARIA_DEEP_KB } from './deep/09-reforma-tributaria'
export { JURISPRUDENCIA_DEEP_KB } from './deep/10-jurisprudencia-recente'

import { RESTAURANTES_KB } from './deep/01-restaurantes-completo'
import { ACADEMIAS_KB } from './deep/02-academias-completo'
import { COMERCIO_ROUPA_KB } from './deep/03-comercio-roupa-completo'
import { GRANDES_REDES_KB } from './deep/04-grandes-redes-benchmarks'
import { ICMS_ST_POR_ESTADO_KB } from './deep/05-icms-st-por-estado'
import { PIS_COFINS_CREDITOS_KB } from './deep/06-pis-cofins-creditos'
import { FATOR_R_KB as FATOR_R_DEEP_KB } from './deep/07-fator-r-completo'
import { PERSE_KB } from './deep/08-perse-detalhado'
import { REFORMA_TRIBUTARIA_DEEP_KB } from './deep/09-reforma-tributaria'
import { JURISPRUDENCIA_DEEP_KB } from './deep/10-jurisprudencia-recente'

import { SIMPLES_NACIONAL } from './01-simples-nacional'
import { LUCRO_PRESUMIDO } from './02-lucro-presumido'
import { LUCRO_REAL } from './03-lucro-real'
import { REFORMA_TRIBUTARIA } from './04-reforma-tributaria'
import { BENEFICIOS_FISCAIS } from './05-beneficios-fiscais'
import { SUBSTITUICAO_TRIBUTARIA } from './06-substituicao-tributaria'
import { PIS_COFINS_MONOFASICO } from './07-pis-cofins-monofasico'
import { ESTADOS_PARTICULARIDADES } from './08-estados-particularidades'
import { FATOR_R } from './09-fator-r'
import { JURISPRUDENCIA } from './10-jurisprudencia'

export type KnowledgeTopic =
  | 'simples-nacional'
  | 'lucro-presumido'
  | 'lucro-real'
  | 'reforma-tributaria'
  | 'beneficios-fiscais'
  | 'substituicao-tributaria'
  | 'pis-cofins-monofasico'
  | 'estados-particularidades'
  | 'fator-r'
  | 'jurisprudencia'
  // Sprint 5.0.2.g — KB PROFUNDA (truques reais grandes redes)
  | 'restaurantes-deep'
  | 'academias-deep'
  | 'comercio-roupa-deep'
  | 'grandes-redes'
  | 'icms-st-estados'
  | 'pis-cofins-creditos'
  | 'fator-r-deep'
  | 'perse-deep'
  | 'reforma-tributaria-deep'
  | 'jurisprudencia-deep'

/**
 * Retorna a base de conhecimento de um tópico específico.
 * Útil pra RAG futuro (Sprint 5.0.2.d) — passar só o relevante pro Claude.
 */
export function getKnowledgeFor(topic: KnowledgeTopic) {
  switch (topic) {
    case 'simples-nacional':
      return SIMPLES_NACIONAL
    case 'lucro-presumido':
      return LUCRO_PRESUMIDO
    case 'lucro-real':
      return LUCRO_REAL
    case 'reforma-tributaria':
      return REFORMA_TRIBUTARIA
    case 'beneficios-fiscais':
      return BENEFICIOS_FISCAIS
    case 'substituicao-tributaria':
      return SUBSTITUICAO_TRIBUTARIA
    case 'pis-cofins-monofasico':
      return PIS_COFINS_MONOFASICO
    case 'estados-particularidades':
      return ESTADOS_PARTICULARIDADES
    case 'fator-r':
      return FATOR_R
    case 'jurisprudencia':
      return JURISPRUDENCIA
    // Sprint 5.0.2.g — KB profunda
    case 'restaurantes-deep':
      return RESTAURANTES_KB
    case 'academias-deep':
      return ACADEMIAS_KB
    case 'comercio-roupa-deep':
      return COMERCIO_ROUPA_KB
    case 'grandes-redes':
      return GRANDES_REDES_KB
    case 'icms-st-estados':
      return ICMS_ST_POR_ESTADO_KB
    case 'pis-cofins-creditos':
      return PIS_COFINS_CREDITOS_KB
    case 'fator-r-deep':
      return FATOR_R_DEEP_KB
    case 'perse-deep':
      return PERSE_KB
    case 'reforma-tributaria-deep':
      return REFORMA_TRIBUTARIA_DEEP_KB
    case 'jurisprudencia-deep':
      return JURISPRUDENCIA_DEEP_KB
  }
}

export const ALL_KNOWLEDGE = {
  simplesNacional: SIMPLES_NACIONAL,
  lucroPresumido: LUCRO_PRESUMIDO,
  lucroReal: LUCRO_REAL,
  reformaTributaria: REFORMA_TRIBUTARIA,
  beneficiosFiscais: BENEFICIOS_FISCAIS,
  substituicaoTributaria: SUBSTITUICAO_TRIBUTARIA,
  pisCofinsMonofasico: PIS_COFINS_MONOFASICO,
  estadosParticularidades: ESTADOS_PARTICULARIDADES,
  fatorR: FATOR_R,
  jurisprudencia: JURISPRUDENCIA,
} as const

/**
 * Helper: lista tópicos disponíveis pra UI.
 */
export const KNOWLEDGE_TOPICS: Array<{ key: KnowledgeTopic; label: string }> = [
  { key: 'simples-nacional', label: 'Simples Nacional' },
  { key: 'lucro-presumido', label: 'Lucro Presumido' },
  { key: 'lucro-real', label: 'Lucro Real' },
  { key: 'reforma-tributaria', label: 'Reforma Tributária 2026-2033' },
  { key: 'beneficios-fiscais', label: 'Benefícios Fiscais' },
  { key: 'substituicao-tributaria', label: 'Substituição Tributária' },
  { key: 'pis-cofins-monofasico', label: 'PIS/COFINS Monofásico' },
  { key: 'estados-particularidades', label: 'Particularidades por UF' },
  { key: 'fator-r', label: 'Fator R' },
  { key: 'jurisprudencia', label: 'Jurisprudência STF/STJ/CARF' },
  // Sprint 5.0.2.g — KB PROFUNDA
  { key: 'restaurantes-deep', label: 'Restaurantes (DEEP: combo Mc/BK, PERSE, LC 192/2022)' },
  { key: 'academias-deep', label: 'Academias (DEEP: Fator R, Smart Fit, holdings)' },
  { key: 'comercio-roupa-deep', label: 'Comércio Roupa (DEEP: Renner, Riachuelo, DIFAL, NCM)' },
  { key: 'grandes-redes', label: 'Benchmark grandes redes (Mc, BK, Madero, Smart Fit, Renner)' },
  { key: 'icms-st-estados', label: 'ICMS-ST por estado (Convênio 142/2018)' },
  { key: 'pis-cofins-creditos', label: 'Créditos PIS/COFINS detalhado (Lei 10.637 + 10.833)' },
  { key: 'fator-r-deep', label: 'Fator R profundo (LC 123/06 § 5º-J)' },
  { key: 'perse-deep', label: 'PERSE detalhado (Lei 14.148/2021 + 14.859/2024)' },
  { key: 'reforma-tributaria-deep', label: 'Reforma Tributária profunda (EC 132/2023 + LC 214/2025)' },
  { key: 'jurisprudencia-deep', label: 'Jurisprudência STF/STJ/CARF + Teses 574706' },
]
