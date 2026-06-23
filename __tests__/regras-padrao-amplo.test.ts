// Sprint 9 — testes do detector de "padrão amplo" no modal Nova Regra.
import { describe, it, expect } from 'vitest'

const LIMITE_PADRAO_AMPLO_ABS = 50
const LIMITE_PADRAO_AMPLO_PCT = 0.25

function detectarPadraoAmplo(count: number, janela: number): boolean {
  if (count >= LIMITE_PADRAO_AMPLO_ABS) return true
  if (janela > 0 && count / janela >= LIMITE_PADRAO_AMPLO_PCT) return true
  return false
}

describe('detectarPadraoAmplo', () => {
  it('count >= 50 absoluto = padrão amplo', () => {
    expect(detectarPadraoAmplo(50, 200)).toBe(true)
    expect(detectarPadraoAmplo(51, 200)).toBe(true)
    expect(detectarPadraoAmplo(100, 200)).toBe(true)
  })

  it('count < 50 mas >= 25% da janela = padrão amplo', () => {
    expect(detectarPadraoAmplo(25, 100)).toBe(true) // 25%
    expect(detectarPadraoAmplo(30, 100)).toBe(true) // 30%
    expect(detectarPadraoAmplo(10, 40)).toBe(true) // 25%
  })

  it('count < 50 E < 25% = OK (não amplo)', () => {
    expect(detectarPadraoAmplo(5, 100)).toBe(false) // 5%
    expect(detectarPadraoAmplo(20, 100)).toBe(false) // 20%
    expect(detectarPadraoAmplo(49, 200)).toBe(false) // 24.5%
  })

  it('count = 0 → não amplo', () => {
    expect(detectarPadraoAmplo(0, 1000)).toBe(false)
    expect(detectarPadraoAmplo(0, 0)).toBe(false)
  })

  it('janela = 0 e count > 0 → conta apenas absoluto', () => {
    expect(detectarPadraoAmplo(49, 0)).toBe(false)
    expect(detectarPadraoAmplo(50, 0)).toBe(true)
  })

  it('limite exato 25% passa (>=)', () => {
    expect(detectarPadraoAmplo(25, 100)).toBe(true)
    // 24.9% NAO passa
    expect(detectarPadraoAmplo(24, 100)).toBe(false)
  })

  it('caso real Cacula: padrão "FRIGORIFICO" → 3 tx em janela de 7 = amplo (43%)', () => {
    // 3/7 = 42.8% > 25% → amplo
    expect(detectarPadraoAmplo(3, 7)).toBe(true)
  })

  it('caso real Cacula: padrão "FRIGORIFICO SILVA" mais especifico → 3 em 239 = OK', () => {
    // 3/239 = 1.26% < 25% e count < 50 → OK
    expect(detectarPadraoAmplo(3, 239)).toBe(false)
  })

  it('caso real: padrão "PIX" → 1100 em 1500 = amplo absoluto e pct', () => {
    expect(detectarPadraoAmplo(1100, 1500)).toBe(true)
  })
})
