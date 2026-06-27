// Sprint OFX V3 R7 — testes do detector de keyword de transferência.
// Casos reais Cacula Sicredi.

import { describe, it, expect } from 'vitest'
import { detectTransferKeyword } from '@/lib/ofx-v3/transfer-keyword'

describe('detectTransferKeyword', () => {
  it('detecta PIX_DEB', () => {
    expect(detectTransferKeyword('PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX')).toBe('PIX')
  })
  it('detecta PIX_CRED', () => {
    expect(detectTransferKeyword('RECEBIMENTO PIX-PIX_CRED 12345678000100')).toBe('PIX')
  })
  it('detecta PIX simples', () => {
    expect(detectTransferKeyword('PIX RECEBIDO SICREDI')).toBe('PIX')
  })
  it('detecta TED', () => {
    expect(detectTransferKeyword('TED PARA OUTRA CONTA')).toBe('TED')
  })
  it('detecta DOC', () => {
    expect(detectTransferKeyword('DOC SAQUE')).toBe('DOC')
  })
  it('detecta TRANSFERENCIA com acento', () => {
    expect(detectTransferKeyword('TRANSFERÊNCIA ENTRE CONTAS')).toBe('TRANSFER')
  })
  it('detecta TRANSF abrev', () => {
    expect(detectTransferKeyword('TRANSF ENVIADA BANRISUL')).toBe('TRANSFER')
  })
  it('NÃO detecta descrição irrelevante', () => {
    expect(detectTransferKeyword('PAGAMENTO FORNECEDOR LTDA')).toBeNull()
  })
  it('NÃO detecta string vazia', () => {
    expect(detectTransferKeyword('')).toBeNull()
  })
  it('NÃO detecta null-like', () => {
    expect(detectTransferKeyword(null as unknown as string)).toBeNull()
  })
})
