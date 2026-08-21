// ESTOQUE FASE 1 item 3 — status min/max: comportamento (REGRA 3, executa a função pura).

import { describe, it, expect } from 'vitest'
import { statusEstoque } from '../status-estoque'

describe('statusEstoque', () => {
  it('sem mínimo → cinza, sem barra', () => {
    const r = statusEstoque(10, null, null)
    expect(r.status).toBe('SEM_MIN')
    expect(r.cor).toBe('cinza')
    expect(r.barra).toBeNull()
  })
  it('abaixo do mínimo → vermelho', () => {
    const r = statusEstoque(3, 5, 20)
    expect(r.status).toBe('ABAIXO')
    expect(r.cor).toBe('vermelho')
    expect(r.barra!.saldoPct).toBeCloseTo(15) // 3/20
    expect(r.barra!.minPct).toBeCloseTo(25) // 5/20
    expect(r.barra!.maxPct).toBeCloseTo(100)
  })
  it('dentro da faixa → verde', () => {
    expect(statusEstoque(10, 5, 20).status).toBe('DENTRO')
    expect(statusEstoque(10, 5, 20).cor).toBe('verde')
  })
  it('igual ao mínimo é DENTRO (não abaixo)', () => {
    expect(statusEstoque(5, 5, 20).status).toBe('DENTRO')
  })
  it('acima do máximo → azul', () => {
    const r = statusEstoque(25, 5, 20)
    expect(r.status).toBe('ACIMA')
    expect(r.cor).toBe('azul')
  })
  it('sem máximo: mín fica no meio da barra (escala mín*2), sem teto de acima', () => {
    const r = statusEstoque(30, 5, null)
    expect(r.status).toBe('DENTRO') // sem máx, nunca ACIMA
    expect(r.barra!.minPct).toBeCloseTo(50) // 5 / (5*2)
    expect(r.barra!.maxPct).toBeNull()
  })
})
