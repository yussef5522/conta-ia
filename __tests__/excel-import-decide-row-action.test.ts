// Sprint 5.0.2.3 — Tests pra decideRowAction + isUniqueConstraintError.
// Cobre todos os caminhos de skip do /confirm pra garantir que mudanças
// futuras não regridem comportamento de "skip vs proceed".

import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  decideRowAction,
  isUniqueConstraintError,
  decideStagedUserDecision,
  type RowLike,
} from '@/lib/excel-import/decide-row-action'

function row(over: Partial<RowLike> = {}): RowLike {
  return {
    rawFavorecido: 'Fornecedor X',
    userDecision: 'INCLUDE',
    ...over,
  }
}

describe('decideRowAction — sem override', () => {
  it('userDecision=INCLUDE + favorecido válido → PROCEED', () => {
    expect(decideRowAction(row({ userDecision: 'INCLUDE' })).kind).toBe('PROCEED')
  })

  it('userDecision=EXCLUDE → SKIP_EXCLUDED', () => {
    expect(decideRowAction(row({ userDecision: 'EXCLUDE' })).kind).toBe(
      'SKIP_EXCLUDED',
    )
  })

  it('userDecision=NEEDS_REVIEW → SKIP_NEEDS_REVIEW', () => {
    expect(decideRowAction(row({ userDecision: 'NEEDS_REVIEW' })).kind).toBe(
      'SKIP_NEEDS_REVIEW',
    )
  })

  it('rawFavorecido=null → SKIP_NO_FAVORECIDO (mesmo com decision=INCLUDE)', () => {
    expect(
      decideRowAction(row({ rawFavorecido: null, userDecision: 'INCLUDE' }))
        .kind,
    ).toBe('SKIP_NO_FAVORECIDO')
  })

  it('rawFavorecido vazio "   " → SKIP_NO_FAVORECIDO', () => {
    expect(
      decideRowAction(row({ rawFavorecido: '   ', userDecision: 'INCLUDE' }))
        .kind,
    ).toBe('SKIP_NO_FAVORECIDO')
  })
})

describe('decideRowAction — com override', () => {
  it('override=EXCLUDE em row INCLUDE → SKIP_EXCLUDED', () => {
    expect(
      decideRowAction(row({ userDecision: 'INCLUDE' }), { decision: 'EXCLUDE' })
        .kind,
    ).toBe('SKIP_EXCLUDED')
  })

  it('override=INCLUDE em row NEEDS_REVIEW → PROCEED', () => {
    expect(
      decideRowAction(row({ userDecision: 'NEEDS_REVIEW' }), {
        decision: 'INCLUDE',
      }).kind,
    ).toBe('PROCEED')
  })

  it('override=INCLUDE em row EXCLUDE → PROCEED (user resgatou)', () => {
    expect(
      decideRowAction(row({ userDecision: 'EXCLUDE' }), { decision: 'INCLUDE' })
        .kind,
    ).toBe('PROCEED')
  })

  it('override INCLUDE mas favorecido nulo → SKIP_NO_FAVORECIDO (defesa)', () => {
    expect(
      decideRowAction(row({ rawFavorecido: null, userDecision: 'EXCLUDE' }), {
        decision: 'INCLUDE',
      }).kind,
    ).toBe('SKIP_NO_FAVORECIDO')
  })

  it('override sem decision (vazio) → usa userDecision', () => {
    expect(decideRowAction(row({ userDecision: 'EXCLUDE' }), {}).kind).toBe(
      'SKIP_EXCLUDED',
    )
    expect(
      decideRowAction(row({ userDecision: 'NEEDS_REVIEW' }), {}).kind,
    ).toBe('SKIP_NEEDS_REVIEW')
  })
})

describe('decideRowAction — ordem de precedência', () => {
  it('EXCLUDE > NO_FAVORECIDO: linha sem favorecido + decision=EXCLUDE → SKIP_EXCLUDED', () => {
    // EXCLUDE explícito é mais informativo que "sem favorecido"; mantém EXCLUDE
    expect(
      decideRowAction(row({ rawFavorecido: null, userDecision: 'EXCLUDE' }))
        .kind,
    ).toBe('SKIP_EXCLUDED')
  })

  it('NO_FAVORECIDO > NEEDS_REVIEW: row NEEDS_REVIEW + favorecido nulo → SKIP_NO_FAVORECIDO', () => {
    expect(
      decideRowAction(
        row({ rawFavorecido: null, userDecision: 'NEEDS_REVIEW' }),
      ).kind,
    ).toBe('SKIP_NO_FAVORECIDO')
  })
})

// Sprint 5.0.2.4 — REGRESSÃO CRÍTICA: 46 linhas perdidas porque a regra
// antiga incluía categoryConfidence < 0.7. Esses testes garantem que ESSA
// regra NUNCA volte (qualquer mudança que reintroduza vai quebrar testes).
describe('decideStagedUserDecision — Sprint 5.0.2.4 fix (perda de 46 linhas)', () => {
  it('classify.confidence ≥ 0.7 + categoryConfidence 0 → INCLUDE (categoria nova proposta)', () => {
    // Cenário do Cacula: 46 linhas com CC sem match (proposta nova confidence=0)
    // mas favorecido bem classificado (confidence > 0.7). ANTES do fix isso
    // virava NEEDS_REVIEW → skipped. DEPOIS: vira INCLUDE → cria normalmente.
    expect(decideStagedUserDecision(0.85)).toBe('INCLUDE')
    expect(decideStagedUserDecision(0.7)).toBe('INCLUDE')
    expect(decideStagedUserDecision(1.0)).toBe('INCLUDE')
  })

  it('classify.confidence < 0.7 → NEEDS_REVIEW (favorecido ambíguo)', () => {
    expect(decideStagedUserDecision(0.69)).toBe('NEEDS_REVIEW')
    expect(decideStagedUserDecision(0.5)).toBe('NEEDS_REVIEW')
    expect(decideStagedUserDecision(0)).toBe('NEEDS_REVIEW')
  })

  it('threshold customizável (pra testes/configuração futura)', () => {
    expect(decideStagedUserDecision(0.65, 0.8)).toBe('NEEDS_REVIEW')
    expect(decideStagedUserDecision(0.85, 0.8)).toBe('INCLUDE')
  })

  it('Limite exato — 0.7 inclui (não pula)', () => {
    // Defesa contra > vs >=: se confidence é EXATAMENTE 0.7, deve INCLUIR
    expect(decideStagedUserDecision(0.7)).toBe('INCLUDE')
  })

  it('REGRESSÃO: NUNCA usar categoryConfidence no critério (Sprint 5.0.2.4)', () => {
    // Não tem como testar "ausência" diretamente — mas o tipo da função só
    // aceita favorecidoConfidence, e o callsite no /detect só passa esse.
    // Se alguém adicionar categoryConfidence como parâmetro, esse teste
    // vai falhar por TypeScript (assinatura mudou).
    const result: 'NEEDS_REVIEW' | 'INCLUDE' = decideStagedUserDecision(0.9)
    expect(result).toBe('INCLUDE')
  })
})

describe('isUniqueConstraintError', () => {
  it('PrismaClientKnownRequestError com code P2002 → true', () => {
    // Constructor public na 5.x — usamos shape compatível
    const err = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`bankAccountId`,`dedupHash`)',
      { code: 'P2002', clientVersion: '5.22.0' },
    )
    expect(isUniqueConstraintError(err)).toBe(true)
  })

  it('PrismaClientKnownRequestError com outro code → false', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    })
    expect(isUniqueConstraintError(err)).toBe(false)
  })

  it('Error genérico (NÃO Prisma) → false', () => {
    expect(isUniqueConstraintError(new Error('boom'))).toBe(false)
  })

  it('null/undefined/string → false', () => {
    expect(isUniqueConstraintError(null)).toBe(false)
    expect(isUniqueConstraintError(undefined)).toBe(false)
    expect(isUniqueConstraintError('P2002')).toBe(false)
    expect(isUniqueConstraintError({ code: 'P2002' })).toBe(false)
  })
})
