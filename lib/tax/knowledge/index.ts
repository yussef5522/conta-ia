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
]
