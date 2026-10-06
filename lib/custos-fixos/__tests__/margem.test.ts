/**
 * ⭐⭐ A MARGEM E O "A APURAR" — função PURA, com os três meses MEDIDOS em prod (06/10/2026).
 *
 * ⚠️ Os números são reais: jul 485.248,55 × 221.027,82 (54,5%) · ago 554.099,70 × 232.349,53
 * (58,1%) · set 536.684,89 × 272.891,20 (49,2%). **A oscilação de 9 pontos é o motivo de a
 * ressalva do CMV-por-compra ser obrigatória na tela.**
 */
import { describe, it, expect } from 'vitest'
import { avaliarMargem, pontoDeEquilibrio, DIAS_MINIMOS_DA_JANELA } from '../margem'

const janela = { de: new Date('2026-09-06T00:00:00Z'), ate: new Date('2026-10-06T00:00:00Z') }
const base = { diasComReceita: 30, diasDaJanela: 30, ...janela }

describe('⭐ a margem dos meses reais', () => {
  it('julho: 54,5%', () => {
    const m = avaliarMargem({ ...base, receita: 485248.55, cmv: 221027.82 })
    expect(m.pct).toBeCloseTo(0.5445, 3)
    expect(m.porque).toBeNull()
  })
  it('agosto: 58,1%', () => {
    expect(avaliarMargem({ ...base, receita: 554099.7, cmv: 232349.53 }).pct).toBeCloseTo(0.5807, 3)
  })
  it('setembro: 49,2%', () => {
    expect(avaliarMargem({ ...base, receita: 536684.89, cmv: 272891.2 }).pct).toBeCloseTo(0.4915, 3)
  })
  it('⭐ a CONTA vai escrita — percentual sem régua em tela de dinheiro é pior que ausência', () => {
    const m = avaliarMargem({ ...base, receita: 536684.89, cmv: 272891.2 })
    expect(m.conta).toContain('÷ receita')
    expect(m.ressalva).toMatch(/por COMPRA/)
  })
})

describe('⛔⛔ "a apurar" é honesto — NUNCA número inventado', () => {
  it('sem receita', () => {
    const m = avaliarMargem({ ...base, receita: 0, cmv: 1000 })
    expect(m.pct).toBeNull()
    expect(m.porque).toMatch(/receita/)
  })

  it('⛔ sem CMV categorizado a margem sairia 100% — e isso é uma mentira plausível', () => {
    const m = avaliarMargem({ ...base, receita: 500000, cmv: 0 })
    expect(m.pct).toBeNull()
    expect(m.porque).toMatch(/100%/)
  })

  it('⚠️ pouco dado na janela — um feriadão viraria "a casa não vende"', () => {
    const m = avaliarMargem({ ...base, receita: 50000, cmv: 20000, diasComReceita: DIAS_MINIMOS_DA_JANELA - 1 })
    expect(m.pct).toBeNull()
    expect(m.porque).toMatch(/dias/)
  })

  it('⛔ CMV acima da receita: margem ≤ 0 → o ponto de equilíbrio NÃO EXISTE (nada de ∞ disfarçado)', () => {
    const m = avaliarMargem({ ...base, receita: 100000, cmv: 120000 })
    expect(m.pct).toBeLessThan(0)
    expect(m.porque).not.toBeNull()
    const p = pontoDeEquilibrio(1000, m)
    expect(p.porDia).toBeNull()
  })
})

describe('⭐⭐ o ponto de equilíbrio herda o "a apurar" das DUAS pontas', () => {
  const m = avaliarMargem({ ...base, receita: 536684.89, cmv: 272891.2 })

  it('a conta do dono: custo fixo diário ÷ margem', () => {
    const p = pontoDeEquilibrio(4000, m)
    expect(p.porDia).toBeCloseTo(4000 / 0.49155, 0)
    expect(p.conta).toContain('÷ margem')
  })

  it('⛔ sem plano declarado NÃO devolve R$ 0,00/dia — isso se lê como "a casa se paga sozinha"', () => {
    const p = pontoDeEquilibrio(null, m)
    expect(p.porDia).toBeNull()
    expect(p.porque).toMatch(/declare/)
  })

  it('⛔ sem margem medida, o motivo que chega na tela é o DA MARGEM', () => {
    const semCmv = avaliarMargem({ ...base, receita: 500000, cmv: 0 })
    const p = pontoDeEquilibrio(4000, semCmv)
    expect(p.porDia).toBeNull()
    expect(p.porque).toBe(semCmv.porque)
  })
})
