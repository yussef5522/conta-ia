import { describe, it, expect } from 'vitest'
import { detectCdbNature, isCdbTransfer, CDB_TARGET_CATEGORY } from '../detect'

describe('detectCdbNature — memos reais Banrisul', () => {
  it('APLICACAO AUTOMATICA → APLICACAO (transferência, fora do DRE)', () => {
    expect(detectCdbNature('APLICACAO AUTOMATICA')).toBe('APLICACAO')
    expect(isCdbTransfer('APLICACAO')).toBe(true)
  })
  it('RESGATE AUTOMATICO → RESGATE (transferência)', () => {
    expect(detectCdbNature('RESGATE AUTOMATICO')).toBe('RESGATE')
    expect(isCdbTransfer('RESGATE')).toBe(true)
  })
  it('IOF → despesa financeira (NÃO é transferência)', () => {
    expect(detectCdbNature('IOF')).toBe('IOF')
    expect(isCdbTransfer('IOF')).toBe(false)
  })
  it('REND CDB AUT → rendimento (receita, só ligado a CDB)', () => {
    expect(detectCdbNature('REND CDB AUT')).toBe('REND')
    expect(isCdbTransfer('REND')).toBe(false)
  })
  it('não confunde transações normais', () => {
    expect(detectCdbNature('PIX ENVIADO')).toBeNull()
    expect(detectCdbNature('PGTO BOLETO')).toBeNull()
    expect(detectCdbNature('CREDITO STONE')).toBeNull()
    // "REND" solto sem CDB não casa (evita falso positivo)
    expect(detectCdbNature('RENDA MENSAL FULANO')).toBeNull()
  })
  it('categorias-alvo mapeadas', () => {
    expect(CDB_TARGET_CATEGORY.APLICACAO).toBe('Aplicação Financeira (saída)')
    expect(CDB_TARGET_CATEGORY.RESGATE).toBe('Resgate de Aplicação (entrada)')
  })
})
