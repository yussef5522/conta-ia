// Sprint Contract Suffix Fix — helper unico pra match de contrato.
// Cobre os 4 contratos reais Sicredi da Cacula + Banrisul (sem sufixo).

import { describe, it, expect } from 'vitest'
import {
  normalizeForContractMatch,
  extractContractCore,
  descriptionMatchesContract,
} from '@/lib/loans/contract-core'

describe('normalizeForContractMatch', () => {
  it('lowercase + remove non-alphanum', () => {
    expect(normalizeForContractMatch('C41033828-8')).toBe('c410338288')
    expect(normalizeForContractMatch('LIQUIDACAO DE PARCELA-C41033828'))
      .toBe('liquidacaodeparcelac41033828')
  })
  it('lida com vazio/null', () => {
    expect(normalizeForContractMatch('')).toBe('')
    expect(normalizeForContractMatch(null as unknown as string)).toBe('')
  })
})

describe('extractContractCore — extrai contrato sem sufixo "-N"', () => {
  it('Sicredi C41033828-8 → C41033828', () => {
    expect(extractContractCore('C41033828-8')).toBe('C41033828')
  })
  it('Sicredi C41022227-1 → C41022227', () => {
    expect(extractContractCore('C41022227-1')).toBe('C41022227')
  })
  it('Sicredi C41022570-0 → C41022570', () => {
    expect(extractContractCore('C41022570-0')).toBe('C41022570')
  })
  it('Sicredi C61021346-2 → C61021346', () => {
    expect(extractContractCore('C61021346-2')).toBe('C61021346')
  })
  it('Banrisul BNDES 002100057538834 (sem sufixo) → inalterado', () => {
    expect(extractContractCore('002100057538834')).toBe('002100057538834')
  })
  it('contrato sem sufixo → inalterado', () => {
    expect(extractContractCore('C41033828')).toBe('C41033828')
  })
  it('sufixo de 2 chars (DV alfanumerico) → remove', () => {
    expect(extractContractCore('C12345678-AB')).toBe('C12345678')
  })
  it('contrato muito curto (base <5) — NAO remove sufixo (evita ruido)', () => {
    expect(extractContractCore('AB-1')).toBe('AB-1')
  })
  it('null/vazio → vazio', () => {
    expect(extractContractCore(null)).toBe('')
    expect(extractContractCore('')).toBe('')
  })
  it('hifen no meio (sem sufixo curto no final) — inalterado', () => {
    // "C123-FOO-2025" → o último segmento "2025" tem 4 chars, regex casa, retorna parte antes
    // mas a base "C123-FOO" tem >=5 chars, então corta
    expect(extractContractCore('C12345678-FOO-2025')).toBe('C12345678-FOO-2025')
  })
})

describe('descriptionMatchesContract — match REAL', () => {
  // CASO REAL CACULA — os 4 contratos Sicredi com sufixo
  it('🎯 C41033828-8 bate em "LIQUIDACAO DE PARCELA-C41033828"', () => {
    expect(descriptionMatchesContract(
      'LIQUIDACAO DE PARCELA-C41033828',
      'C41033828-8',
    )).toBe(true)
  })
  it('🎯 C41022227-1 bate em "LIQUIDACAO DE PARCELA-C41022227"', () => {
    expect(descriptionMatchesContract(
      'LIQUIDACAO DE PARCELA-C41022227',
      'C41022227-1',
    )).toBe(true)
  })
  it('🎯 C41022570-0 bate em "LIQUIDACAO DE PARCELA-C41022570"', () => {
    expect(descriptionMatchesContract(
      'LIQUIDACAO DE PARCELA-C41022570',
      'C41022570-0',
    )).toBe(true)
  })
  it('🎯 C61021346-2 bate em "LIQUIDACAO DE PARCELA-C61021346"', () => {
    expect(descriptionMatchesContract(
      'LIQUIDACAO DE PARCELA-C61021346',
      'C61021346-2',
    )).toBe(true)
  })

  // Banrisul SEM sufixo continua funcionando
  it('Banrisul 002100057538834 bate em descricao com mesmo numero', () => {
    expect(descriptionMatchesContract(
      'EMPRESTIMO 002100057538834',
      '002100057538834',
    )).toBe(true)
  })

  // NOVO: bate descrição QUE TRAZ o sufixo também (compatibilidade)
  it('descricao com sufixo completo "C41033828-8" também bate', () => {
    expect(descriptionMatchesContract(
      'PARCELA-C41033828-8 LIQUIDACAO',
      'C41033828-8',
    )).toBe(true)
  })

  // REJEIÇÕES
  it('NAO bate quando descricao nao contem o core', () => {
    expect(descriptionMatchesContract(
      'PAGAMENTO FORNECEDOR LTDA',
      'C41033828-8',
    )).toBe(false)
  })
  it('NAO bate quando contractNumber e null', () => {
    expect(descriptionMatchesContract(
      'LIQUIDACAO DE PARCELA-C41033828',
      null,
    )).toBe(false)
  })
  it('NAO bate quando core normalizado <7 chars (anti falso-positivo)', () => {
    expect(descriptionMatchesContract(
      'PARCELA C123',
      'C123-4', // core "C123" → 4 chars normalizado, abaixo do minCoreLength=7
    )).toBe(false)
  })

  // ANTI-COLISAO: confirma que 2 contratos com sufixo diferente NAO se misturam
  it('NAO confunde C41022227 com C41022570 (cores totalmente diferentes)', () => {
    expect(descriptionMatchesContract(
      'LIQUIDACAO DE PARCELA-C41022570',
      'C41022227-1',
    )).toBe(false)
  })
})
