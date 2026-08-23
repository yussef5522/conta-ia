// ESTOQUE FASE 3 PARTE 2 — O FREIO (função pura). Roda a decisão real, não procura string.
// O freio existe pra que um clique distraído não mova o ledger; e NÃO pode tocar à toa,
// senão o dono aprende a confirmar sem ler e ele perde a função.

import { describe, it, expect } from 'vitest'
import { avaliarFreio, validarQuantidade, ContagemError, FREIO_PCT, FREIO_VALOR, FREIO_VALOR_MIN } from '../contagem'

describe('avaliarFreio', () => {
  it('não freia quando a contagem BATE com o sistema', () => {
    const r = avaliarFreio(28, 28, 40)
    expect(r.grande).toBe(false)
    expect(r.valorDivergencia).toBe(0)
  })

  it('não freia divergência pequena em qtd E em dinheiro', () => {
    // 28 → 27,5 KG a R$ 40 = 1,8% fora, R$ 20 de diferença
    const r = avaliarFreio(28, 27.5, 40)
    expect(r.grande).toBe(false)
  })

  it('FREIA quando o desvio passa de 30% e vale mais que o mínimo', () => {
    // 10 → 4 KG a R$ 30 = 60% fora, R$ 180
    const r = avaliarFreio(10, 4, 30)
    expect(r.grande).toBe(true)
    expect(r.pct).toBeGreaterThan(FREIO_PCT)
    expect(r.motivo).toContain('%')
  })

  it('FREIA por DINHEIRO mesmo com desvio percentual pequeno', () => {
    // 1000 → 990 UN a R$ 50 = 1% fora, mas R$ 500 de diferença
    const r = avaliarFreio(1000, 990, 50)
    expect(r.grande).toBe(true)
    expect(Math.abs(r.valorDivergencia)).toBeGreaterThan(FREIO_VALOR)
    expect(r.motivo).toContain('R$')
  })

  it('NÃO freia desvio percentual enorme de item barato (anti alarme-à-toa)', () => {
    // 1 → 0,4 KG de sal a R$ 3 = 60% fora, mas R$ 1,80 — alarme aqui treina a ignorar
    const r = avaliarFreio(1, 0.4, 3)
    expect(r.grande).toBe(false)
    expect(Math.abs(r.valorDivergencia)).toBeLessThan(FREIO_VALOR_MIN)
  })

  it('saldo ZERO não freia por percentual (item novo na contagem inicial é normal)', () => {
    const r = avaliarFreio(0, 12, 5) // R$ 60 — abaixo do limite de dinheiro
    expect(r.grande).toBe(false)
    expect(r.pct).toBeNull()
  })

  it('saldo ZERO AINDA freia se o valor for alto', () => {
    const r = avaliarFreio(0, 100, 50) // R$ 5.000 aparecendo do nada
    expect(r.grande).toBe(true)
  })

  it('freia igual pros dois lados (sobra também é divergência)', () => {
    const falta = avaliarFreio(10, 4, 30)
    const sobra = avaliarFreio(10, 16, 30)
    expect(falta.grande).toBe(true)
    expect(sobra.grande).toBe(true)
    expect(sobra.valorDivergencia).toBeGreaterThan(0)
    expect(falta.valorDivergencia).toBeLessThan(0)
  })

  it('item sem custo não estoura (custo 0 → divergência vale 0)', () => {
    const r = avaliarFreio(10, 2, 0)
    expect(r.valorDivergencia).toBe(0)
    expect(r.grande).toBe(false) // sem custo não dá pra medir dinheiro; % sozinho não basta
  })
})

describe('validarQuantidade — KG decimal (balança) / UN inteiro', () => {
  it('aceita decimal em KG', () => {
    expect(() => validarQuantidade('KG', 27.485)).not.toThrow()
  })
  it('aceita decimal em LT', () => {
    expect(() => validarQuantidade('LT', 3.5)).not.toThrow()
  })
  it('RECUSA decimal em UN (meia unidade não existe)', () => {
    expect(() => validarQuantidade('UN', 2.5)).toThrow(ContagemError)
  })
  it('aceita inteiro em UN', () => {
    expect(() => validarQuantidade('UN', 12)).not.toThrow()
  })
  it('RECUSA quantidade negativa', () => {
    expect(() => validarQuantidade('KG', -1)).toThrow(ContagemError)
  })
  it('aceita ZERO (contei e não tem nada é uma resposta legítima)', () => {
    expect(() => validarQuantidade('KG', 0)).not.toThrow()
  })
})
