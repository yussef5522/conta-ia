// Sprint Account Kind PJ/PF (27/06/2026) — classificador puro de pares.

import { describe, it, expect } from 'vitest'
import { classifyTransferPair, normalizeAccountKind } from '@/lib/accounts/kind'

describe('classifyTransferPair — PJ+PJ → TRANSFER interna', () => {
  it('PJ DEBIT → PJ (transferência saindo)', () => {
    const r = classifyTransferPair('PJ', 'DEBIT', 'PJ')
    expect(r.kind).toBe('TRANSFER_INTERNAL')
  })
  it('PJ CREDIT → PJ (transferência entrando)', () => {
    const r = classifyTransferPair('PJ', 'CREDIT', 'PJ')
    expect(r.kind).toBe('TRANSFER_INTERNAL')
  })
})

describe('classifyTransferPair — PJ+PF', () => {
  it('PJ DEBIT, par PF → RETIRADA (dinheiro saiu da PJ pra PF)', () => {
    const r = classifyTransferPair('PJ', 'DEBIT', 'PF')
    expect(r.kind).toBe('RETIRADA_LUCRO')
    if (r.kind === 'RETIRADA_LUCRO') expect(r.sideSending).toBe('PJ')
  })
  it('PJ CREDIT, par PF → APORTE (dinheiro entrou na PJ vindo da PF)', () => {
    const r = classifyTransferPair('PJ', 'CREDIT', 'PF')
    expect(r.kind).toBe('APORTE_CAPITAL')
    if (r.kind === 'APORTE_CAPITAL') expect(r.sideReceiving).toBe('PJ')
  })
  it('PF DEBIT, par PJ → APORTE (dinheiro saiu da PF, entrou na PJ)', () => {
    const r = classifyTransferPair('PF', 'DEBIT', 'PJ')
    expect(r.kind).toBe('APORTE_CAPITAL')
  })
  it('PF CREDIT, par PJ → RETIRADA (dinheiro entrou na PF, saiu da PJ)', () => {
    const r = classifyTransferPair('PF', 'CREDIT', 'PJ')
    expect(r.kind).toBe('RETIRADA_LUCRO')
  })
})

describe('classifyTransferPair — PF+PF → OUT_OF_SCOPE', () => {
  it('PF DEBIT → PF não interessa pra DRE de empresa', () => {
    const r = classifyTransferPair('PF', 'DEBIT', 'PF')
    expect(r.kind).toBe('OUT_OF_SCOPE')
  })
})

describe('classifyTransferPair — normalização defensiva', () => {
  it('strings inválidas viram PJ (default seguro)', () => {
    const r = classifyTransferPair('JURIDICA' as any, 'DEBIT', 'jakaja' as any)
    expect(r.kind).toBe('TRANSFER_INTERNAL') // ambos viraram PJ
  })
  it('normalizeAccountKind: só PF é PF, qualquer outra coisa vira PJ', () => {
    expect(normalizeAccountKind('PJ')).toBe('PJ')
    expect(normalizeAccountKind('PF')).toBe('PF')
    expect(normalizeAccountKind(null)).toBe('PJ')
    expect(normalizeAccountKind(undefined)).toBe('PJ')
    expect(normalizeAccountKind('')).toBe('PJ')
    expect(normalizeAccountKind('pf')).toBe('PJ') // case-sensitive
  })
})
