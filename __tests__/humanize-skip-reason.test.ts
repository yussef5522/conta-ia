// Sprint Import-Transparência: helper humanizador de motivos de skip.

import { describe, it, expect } from 'vitest'
import {
  humanizarMotivoSkip,
  detectSkipMotivo,
} from '@/lib/excel-import/humanize-skip-reason'

describe('humanizarMotivoSkip', () => {
  it('NEEDS_REVIEW_FAVORECIDO com confidence inclui % no texto', () => {
    const msg = humanizarMotivoSkip({
      motivo: 'NEEDS_REVIEW_FAVORECIDO',
      favorecidoConfidence: 0.45,
    })
    expect(msg).toContain('45%')
    expect(msg).toContain('favorecido')
  })

  it('NEEDS_REVIEW_FAVORECIDO sem confidence usa texto genérico', () => {
    const msg = humanizarMotivoSkip({ motivo: 'NEEDS_REVIEW_FAVORECIDO' })
    expect(msg).toContain('ambíguo')
  })

  it('NO_FAVORECIDO com raw vazio menciona "em branco"', () => {
    const msg = humanizarMotivoSkip({ motivo: 'NO_FAVORECIDO', rawFavorecido: '' })
    expect(msg.toLowerCase()).toContain('branco')
  })

  it('DUPLICATE menciona "já existe"', () => {
    const msg = humanizarMotivoSkip({ motivo: 'DUPLICATE' })
    expect(msg).toContain('já existe')
  })

  it('EXCLUDED_BY_USER explica que foi o user', () => {
    const msg = humanizarMotivoSkip({ motivo: 'EXCLUDED_BY_USER' })
    expect(msg.toLowerCase()).toContain('você')
  })
})

describe('detectSkipMotivo', () => {
  it('duplicateOf preenchido → DUPLICATE', () => {
    expect(
      detectSkipMotivo({
        userDecision: 'INCLUDE',
        rawFavorecido: 'X',
        favorecidoConfidence: 0.9,
        duplicateOf: 'outra-row',
      }),
    ).toBe('DUPLICATE')
  })

  it('rawFavorecido vazio → NO_FAVORECIDO', () => {
    expect(
      detectSkipMotivo({
        userDecision: 'INCLUDE',
        rawFavorecido: '',
        favorecidoConfidence: 0.9,
        duplicateOf: null,
      }),
    ).toBe('NO_FAVORECIDO')
  })

  it('userDecision EXCLUDE → EXCLUDED_BY_USER', () => {
    expect(
      detectSkipMotivo({
        userDecision: 'EXCLUDE',
        rawFavorecido: 'X',
        favorecidoConfidence: 0.9,
        duplicateOf: null,
      }),
    ).toBe('EXCLUDED_BY_USER')
  })

  it('NEEDS_REVIEW + confidence baixo → NEEDS_REVIEW_FAVORECIDO', () => {
    expect(
      detectSkipMotivo({
        userDecision: 'NEEDS_REVIEW',
        rawFavorecido: 'José SILVA',
        favorecidoConfidence: 0.45,
        duplicateOf: null,
      }),
    ).toBe('NEEDS_REVIEW_FAVORECIDO')
  })

  it('NEEDS_REVIEW sem confidence → NEEDS_REVIEW_GENERICO', () => {
    expect(
      detectSkipMotivo({
        userDecision: 'NEEDS_REVIEW',
        rawFavorecido: 'X',
        favorecidoConfidence: null,
        duplicateOf: null,
      }),
    ).toBe('NEEDS_REVIEW_GENERICO')
  })

  it('precedence: DUPLICATE > NO_FAVORECIDO > USER > NEEDS_REVIEW', () => {
    // duplicate + sem favorecido → ainda DUPLICATE (mais específico)
    expect(
      detectSkipMotivo({
        userDecision: 'EXCLUDE',
        rawFavorecido: null,
        favorecidoConfidence: null,
        duplicateOf: 'x',
      }),
    ).toBe('DUPLICATE')
  })
})
