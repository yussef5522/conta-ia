// Sprint Central de Transferências — sinais de "transferência interna"
// extraídos da descrição.

import { describe, it, expect } from 'vitest'
import {
  normalizeCnpj,
  extractCnpjsFromDescription,
  extractOwnSignals,
  MAX_OWN_SIGNAL_BOOST,
} from '@/lib/transfers/own-entity-signals'

describe('normalizeCnpj', () => {
  it('14 dígitos puro → válido', () => {
    expect(normalizeCnpj('29756732000198')).toBe('29756732000198')
  })

  it('formatado com pontuação → só dígitos', () => {
    expect(normalizeCnpj('29.756.732/0001-98')).toBe('29756732000198')
  })

  it('menos de 14 dígitos → null', () => {
    expect(normalizeCnpj('29756732')).toBeNull()
  })

  it('null/undefined → null', () => {
    expect(normalizeCnpj(null)).toBeNull()
    expect(normalizeCnpj(undefined)).toBeNull()
    expect(normalizeCnpj('')).toBeNull()
  })
})

describe('extractCnpjsFromDescription', () => {
  it('CNPJ no meio da descrição', () => {
    expect(
      extractCnpjsFromDescription('PAGAMENTO PIX 29756732000198 CACULA MIX'),
    ).toEqual(['29756732000198'])
  })

  it('múltiplos CNPJs', () => {
    expect(
      extractCnpjsFromDescription('TRANSF 12345678000100 PARA 98765432000111'),
    ).toEqual(['12345678000100', '98765432000111'])
  })

  it('sequência de 13 dígitos → não pega (não é CNPJ)', () => {
    expect(extractCnpjsFromDescription('CPF 1234567890123')).toEqual([])
  })

  it('descrição sem dígitos → vazio', () => {
    expect(extractCnpjsFromDescription('PIX João Silva')).toEqual([])
  })

  it('CNPJ com pontuação NÃO pega (esperado — caller normaliza antes)', () => {
    expect(
      extractCnpjsFromDescription('PIX 29.756.732/0001-98 CACULA'),
    ).toEqual([])
  })
})

describe('extractOwnSignals — caso real Yussef', () => {
  const refs = {
    cnpj: '29756732000198',
    names: ['caçula mix', 'CACULA MIX RESTAURANTE LTDA'],
    accountNames: ['sicredi', 'stone', 'banrisul'], ownerCpfs: [], ownerNames: [],
  }

  it('descrição com CNPJ + nome + nada de conta → 2 sinais', () => {
    const sig = extractOwnSignals(
      'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX',
      refs,
    )
    expect(sig.hasOwnCnpj).toBe(true)
    expect(sig.hasOwnName).toBe(true)
    expect(sig.hasOwnAccountName).toBe(false)
    expect(sig.signalCount).toBe(2)
    expect(sig.scoreBoost).toBeCloseTo(0.25, 5) // 0.15 + 0.10
  })

  it('descrição só com nome de conta própria', () => {
    const sig = extractOwnSignals('TRANSF PARA SICREDI', refs)
    expect(sig.hasOwnAccountName).toBe(true)
    expect(sig.hasOwnCnpj).toBe(false)
    expect(sig.hasOwnName).toBe(false)
    expect(sig.signalCount).toBe(1)
    expect(sig.scoreBoost).toBeCloseTo(0.1, 5)
  })

  it('venda de cliente (sem sinal) — não detecta', () => {
    const sig = extractOwnSignals(
      'ANA PAULA MEIRELES SANTOS - Pix | Maquininha',
      refs,
    )
    expect(sig.hasOwnCnpj).toBe(false)
    expect(sig.hasOwnName).toBe(false)
    expect(sig.hasOwnAccountName).toBe(false)
    expect(sig.signalCount).toBe(0)
    expect(sig.scoreBoost).toBe(0)
  })

  it('CNPJ + nome + conta → 3 sinais (boost parcial)', () => {
    // Sprint Owner Detection (28/06/2026): MAX_OWN_SIGNAL_BOOST cresceu de
    // 0.35 → 0.60 (CPF dono +0.15 + nome dono +0.10 NOVOS). Este caso só
    // dispara 3 sinais (CNPJ + nome empresa + conta) então boost = 0.35.
    const sig = extractOwnSignals(
      'PIX 29756732000198 CACULA MIX para sicredi',
      refs,
    )
    expect(sig.signalCount).toBe(3)
    expect(sig.scoreBoost).toBeCloseTo(0.35, 5)
    // Sanity: max possivel cresceu pra 0.60 (todos 5 sinais)
    expect(MAX_OWN_SIGNAL_BOOST).toBeCloseTo(0.60, 5)
  })

  it('refs sem CNPJ ou nomes (empresa não cadastrada) — não quebra', () => {
    const sig = extractOwnSignals('qualquer descrição', {
      cnpj: null,
      names: [],
      accountNames: [],
      ownerCpfs: [],
      ownerNames: [],
    })
    expect(sig.signalCount).toBe(0)
    expect(sig.scoreBoost).toBe(0)
  })

  it('nome muito curto (< 4 chars) é ignorado pra evitar ruído', () => {
    // Se accountName fosse "x" e desc fosse "Bx Pix", não deveria casar
    const sig = extractOwnSignals('AB ENVIA PIX', {
      cnpj: null,
      names: ['AB'],
      accountNames: ['XY'],
      ownerCpfs: [],
      ownerNames: [],
    })
    expect(sig.hasOwnName).toBe(false)
    expect(sig.hasOwnAccountName).toBe(false)
    expect(sig.signalCount).toBe(0)
  })
})
