// Sprint Fechar-Ponte (08/08/2026) — Regra 1. Antes do fix o helper não existia
// (import falha = VERMELHO). Cobre a regra "disponível pode ser negativo e isso
// é INTENCIONAL" (adiantamento, não erro).

import { describe, it, expect } from 'vitest'
import { computeDisponivelStatus } from '../lucro-context'

describe('computeDisponivelStatus — lucro disponível (decisões Yussef 08/08)', () => {
  it('positivo: caçula real (apurado 311.996,33 − distribuído 138.417,70)', () => {
    const r = computeDisponivelStatus(311996.33, 138417.7)
    expect(r).toEqual({ disponivel: 173578.63, negativo: false })
  })

  it('negativo é INTENCIONAL (distribuiu além do apurado = adiantamento, não erro)', () => {
    const r = computeDisponivelStatus(-877, 7728)
    expect(r.disponivel).toBe(-8605)
    expect(r.negativo).toBe(true)
  })

  it('zero não é negativo', () => {
    expect(computeDisponivelStatus(1000, 1000)).toEqual({ disponivel: 0, negativo: false })
  })

  it('arredonda pra 2 casas (sem lixo de float)', () => {
    const r = computeDisponivelStatus(0.3, 0.1)
    expect(r.disponivel).toBe(0.2)
    expect(r.negativo).toBe(false)
  })
})
