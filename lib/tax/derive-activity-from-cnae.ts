// Sprint 5.0.2.c.2 — Deriva atividade Lucro Presumido + hasICMS/hasISS do CNAE.
//
// Elimina o campo duplicado "Atividade (pra Lucro Presumido)" do form.
// Quando o usuário escolhe CNAE no picker, sistema infere:
//   - atividade (COMERCIO/SERVICOS/INDUSTRIA/...) para margens de presunção
//   - hasICMS (comércio/indústria geram ICMS)
//   - hasISS (serviços geram ISS)
//
// CNAEs cobertos: 19 cadastrados na Sprint 5.0.2.b. Fallback razoável pra
// CNAEs livres digitados pelo usuário.

import { findCNAE, type Ramo } from './expertise'

export type AtividadePresumido =
  | 'COMERCIO'
  | 'INDUSTRIA'
  | 'SERVICOS'
  | 'SERVICOS_HOSPITALARES'
  | 'TRANSPORTE_CARGAS'
  | 'TRANSPORTE_PASSAGEIROS'
  | 'REVENDA_COMBUSTIVEIS'
  | 'CONSTRUCAO_CIVIL'

export interface DerivedActivity {
  presumidoAtividade: AtividadePresumido
  hasICMS: boolean
  hasISS: boolean
  source: 'expertise' | 'prefix-heuristic' | 'fallback'
}

const FALLBACK: DerivedActivity = {
  presumidoAtividade: 'SERVICOS',
  hasICMS: false,
  hasISS: true,
  source: 'fallback',
}

const RAMO_MAP: Record<Ramo, Omit<DerivedActivity, 'source'>> = {
  RESTAURANTE: { presumidoAtividade: 'COMERCIO', hasICMS: true, hasISS: false },
  ACADEMIA: { presumidoAtividade: 'SERVICOS', hasICMS: false, hasISS: true },
  COMERCIO_ROUPA: { presumidoAtividade: 'COMERCIO', hasICMS: true, hasISS: false },
}

/**
 * Deriva atividade do CNAE.
 *
 * Estratégia:
 * 1. Catálogo expertise (19 CNAEs Sprint 5.0.2.b) — mapeia por ramo
 * 2. Heurística por prefixo (seções CNAE) — cobre CNAEs livres digitados
 * 3. Fallback conservador (SERVICOS + ISS)
 */
export function deriveActivityFromCNAE(cnaeCode: string | null | undefined): DerivedActivity {
  if (!cnaeCode) return FALLBACK

  // 1. Catálogo expertise (match exato)
  const cnae = findCNAE(cnaeCode)
  if (cnae) {
    return { ...RAMO_MAP[cnae.ramo], source: 'expertise' }
  }

  // 2. Heurística por prefixo (primeiros 2 dígitos = seção CNAE 2.3)
  const digits = cnaeCode.replace(/[^0-9]/g, '')
  if (digits.length < 2) return FALLBACK

  const sec2 = digits.substring(0, 2)
  const sec4 = digits.substring(0, 4)

  // Combustíveis revenda (4731-4732) — checa ANTES do comércio genérico 47
  if (sec4 === '4731' || sec4 === '4732') {
    return {
      presumidoAtividade: 'REVENDA_COMBUSTIVEIS',
      hasICMS: true,
      hasISS: false,
      source: 'prefix-heuristic',
    }
  }

  // Comércio (45-47): atacado, varejo, veículos
  if (['45', '46', '47'].includes(sec2)) {
    return { presumidoAtividade: 'COMERCIO', hasICMS: true, hasISS: false, source: 'prefix-heuristic' }
  }

  // Indústria (10-33): transformação, beneficiamento
  const sec2Int = parseInt(sec2, 10)
  if (sec2Int >= 10 && sec2Int <= 33) {
    return { presumidoAtividade: 'INDUSTRIA', hasICMS: true, hasISS: false, source: 'prefix-heuristic' }
  }

  // Construção (41-43)
  if (['41', '42', '43'].includes(sec2)) {
    return { presumidoAtividade: 'CONSTRUCAO_CIVIL', hasICMS: false, hasISS: true, source: 'prefix-heuristic' }
  }

  // Transporte (49): cargas/passageiros
  if (sec2 === '49') {
    // 4911-4912 ferroviário passageiros, 4921-4929 rodoviário
    if (['4912', '4921', '4922', '4923', '4924', '4929'].includes(sec4)) {
      return {
        presumidoAtividade: 'TRANSPORTE_PASSAGEIROS',
        hasICMS: true,
        hasISS: false,
        source: 'prefix-heuristic',
      }
    }
    return {
      presumidoAtividade: 'TRANSPORTE_CARGAS',
      hasICMS: true,
      hasISS: false,
      source: 'prefix-heuristic',
    }
  }

  // Hospitalar (86): saúde humana
  if (sec2 === '86') {
    return {
      presumidoAtividade: 'SERVICOS_HOSPITALARES',
      hasICMS: false,
      hasISS: true,
      source: 'prefix-heuristic',
    }
  }

  // Serviços (49-99 não cobertos acima)
  if (sec2Int >= 50 && sec2Int <= 99) {
    return { presumidoAtividade: 'SERVICOS', hasICMS: false, hasISS: true, source: 'prefix-heuristic' }
  }

  return FALLBACK
}
