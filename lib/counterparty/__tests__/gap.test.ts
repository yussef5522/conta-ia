import { describe, it, expect } from 'vitest'
import { countCounterpartyGap, isCounterpartyEligible, type GapTx } from '../gap'

describe('isCounterpartyEligible', () => {
  it('PIX/TED/DOC de pessoa são elegíveis', () => {
    expect(isCounterpartyEligible('PIX RECEBIDO')).toBe(true)
    expect(isCounterpartyEligible('PIX ENVIADO')).toBe(true)
    expect(isCounterpartyEligible('TED 123')).toBe(true)
    expect(isCounterpartyEligible('DOC E')).toBe(true)
    expect(isCounterpartyEligible('VERO PIX')).toBe(true)
  })
  it('tarifa/IOF NÃO são elegíveis (cobrança do banco, sem favorecido)', () => {
    expect(isCounterpartyEligible('TARIFA PIX')).toBe(false)
    expect(isCounterpartyEligible('IOF PIX')).toBe(false)
  })
  it('não-transferência não é elegível', () => {
    expect(isCounterpartyEligible('CREDITO STONE')).toBe(false)
    expect(isCounterpartyEligible('APLICACAO AUTOMATICA')).toBe(false)
    expect(isCounterpartyEligible('SAQUE DINHEIRO')).toBe(false)
    expect(isCounterpartyEligible('')).toBe(false)
    expect(isCounterpartyEligible(null)).toBe(false)
  })
})

describe('countCounterpartyGap', () => {
  const tx = (description: string, counterpartyName: string | null = null): GapTx => ({ description, counterpartyName })
  it('conta só elegíveis SEM contraparte', () => {
    const txs = [
      tx('PIX RECEBIDO'), // conta
      tx('PIX ENVIADO', 'FULANO DA SILVA'), // já tem cp → não conta
      tx('TARIFA PIX'), // fee → não conta
      tx('CREDITO STONE'), // não-transferência → não conta
      tx('TED 987'), // conta
    ]
    expect(countCounterpartyGap(txs)).toBe(2)
  })
  it('lista vazia → 0', () => {
    expect(countCounterpartyGap([])).toBe(0)
  })
})
