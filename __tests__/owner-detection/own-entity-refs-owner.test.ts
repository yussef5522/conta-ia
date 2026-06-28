// Sprint Owner Detection (28/06/2026) — detector reconhece CPF + nome do
// dono além de CNPJ + nome empresa.

import { describe, it, expect } from 'vitest'
import {
  extractOwnSignals,
  extractCpfsFromDescription,
  normalizeCpf,
  type OwnEntityRefs,
} from '@/lib/transfers/own-entity-signals'

const CACULA_FULL_REFS: OwnEntityRefs = {
  cnpj: '29756732000198',
  names: ['caçula mix'],
  accountNames: ['banrisul', 'sicredi', 'stone'],
  ownerCpfs: ['60025889060'],
  ownerNames: ['YUSSEF ABU ZAHRY MUSA'],
}

describe('Sprint Owner Detection — extractCpfsFromDescription', () => {
  it('extrai CPF de 11 digitos', () => {
    expect(extractCpfsFromDescription('PIX 60025889060 YUSSEF')).toEqual(['60025889060'])
  })
  it('ignora sequencia de 14 digitos (eh CNPJ)', () => {
    expect(extractCpfsFromDescription('PIX 29756732000198 CACULA MIX')).toEqual([])
  })
  it('lida com vazio', () => {
    expect(extractCpfsFromDescription('')).toEqual([])
  })
})

describe('Sprint Owner Detection — normalizeCpf', () => {
  it('aceita 11 digitos', () => {
    expect(normalizeCpf('600.258.890-60')).toBe('60025889060')
  })
  it('rejeita curto/longo', () => {
    expect(normalizeCpf('12345')).toBeNull()
    expect(normalizeCpf('29756732000198')).toBeNull() // CNPJ, nao CPF
  })
  it('rejeita null/vazio', () => {
    expect(normalizeCpf(null)).toBeNull()
    expect(normalizeCpf('')).toBeNull()
  })
})

describe('Sprint Owner Detection — sinais FORTES (CPF + CNPJ)', () => {
  it('🎯 CASO REAL: "PIX 60025889060 YUSSEF" — CPF dono FORTE', () => {
    const sig = extractOwnSignals('PIX 60025889060 YUSSEF', CACULA_FULL_REFS)
    expect(sig.hasOwnerCpf).toBe(true)
    // hasOwnerName precisa do NOME COMPLETO normalizado — "YUSSEF" sozinho
    // não bate "YUSSEF ABU ZAHRY MUSA" (proteção anti-prenome solto)
    expect(sig.hasOwnerName).toBe(false)
    expect(sig.scoreBoost).toBeGreaterThanOrEqual(0.15)
  })

  it('🎯 CASO REAL: "YUSSEF ABU ZAHRY MUSA - Transferência | Pix" — nome dono MEDIO', () => {
    const sig = extractOwnSignals(
      'YUSSEF ABU ZAHRY MUSA - Transferência | Pix',
      CACULA_FULL_REFS,
    )
    expect(sig.hasOwnerName).toBe(true)
    expect(sig.hasOwnCnpj).toBe(false) // sem CNPJ na descricao
    expect(sig.hasOwnerCpf).toBe(false) // sem CPF na descricao
    expect(sig.signalCount).toBeGreaterThanOrEqual(1)
  })

  it('CNPJ próprio continua funcionando (retrocompat)', () => {
    const sig = extractOwnSignals(
      'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX',
      CACULA_FULL_REFS,
    )
    expect(sig.hasOwnCnpj).toBe(true)
    expect(sig.hasOwnName).toBe(true) // cacula mix
  })

  it('rejeita prenome solto curto (anti falso-positivo)', () => {
    // "Ana" é nome de dono mas só 3 chars → filtra (mín 8)
    const refs: OwnEntityRefs = {
      ...CACULA_FULL_REFS,
      ownerNames: ['Ana'], // muito curto
    }
    const sig = extractOwnSignals('Ana Silva - Pagamento Cliente', refs)
    expect(sig.hasOwnerName).toBe(false)
  })

  it('venda normal de cliente NÃO vira movimentação própria', () => {
    const sig = extractOwnSignals(
      'PIX RECEBIDO 12345678901 Maria Souza',
      CACULA_FULL_REFS,
    )
    expect(sig.hasOwnerCpf).toBe(false) // CPF cliente, não do dono
    expect(sig.hasOwnerName).toBe(false) // nome cliente
    expect(sig.hasOwnCnpj).toBe(false)
    expect(sig.signalCount).toBe(0)
  })
})

describe('Sprint Owner Detection — boost máximo inclui owner signals', () => {
  it('MAX_OWN_SIGNAL_BOOST cresceu de 0.35 → 0.60', async () => {
    const { MAX_OWN_SIGNAL_BOOST } = await import('@/lib/transfers/own-entity-signals')
    // CNPJ 0.15 + CPF 0.15 + nome empresa 0.10 + nome dono 0.10 + conta 0.10
    expect(MAX_OWN_SIGNAL_BOOST).toBeCloseTo(0.60, 5)
  })
})
