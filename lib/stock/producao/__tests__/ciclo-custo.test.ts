// ESTOQUE FASE 2 item 2.0 — ciclo proibido + custo teórico (puros, REGRA 3).

import { describe, it, expect } from 'vitest'
import { detectaCicloFicha, type GrafoFichas } from '../ciclo'
import { calcularCustoTeorico, calcularMargem } from '../custo-teorico'

describe('detectaCicloFicha', () => {
  it('sem ciclo: carne + gordura → pacote de carne', () => {
    const g: GrafoFichas = new Map()
    expect(detectaCicloFicha('pacote', ['carne', 'gordura'], g).ciclo).toBe(false)
  })
  it('auto-referência direta é ciclo', () => {
    expect(detectaCicloFicha('pacote', ['pacote'], new Map()).ciclo).toBe(true)
  })
  it('ciclo indireto: xis usa pacote, pacote passa a usar xis → proibido', () => {
    const g: GrafoFichas = new Map([['xis', ['pacote', 'pao']]]) // xis já usa pacote
    const r = detectaCicloFicha('pacote', ['carne', 'xis'], g) // pacote passaria a usar xis
    expect(r.ciclo).toBe(true)
    expect(r.via).toBe('xis')
  })
  it('recursão legítima (sem voltar): pacote usa carne; xis usa pacote → ok', () => {
    const g: GrafoFichas = new Map([['pacote', ['carne']]])
    expect(detectaCicloFicha('xis', ['pacote', 'pao'], g).ciclo).toBe(false)
  })
})

describe('calcularCustoTeorico', () => {
  it('todos com custo, sem rendimento → custo do lote ok, por-unidade a apurar', () => {
    const r = calcularCustoTeorico([{ custoMedio: 40, qtdPlanejada: 5 }, { custoMedio: 8, qtdPlanejada: 1 }], null)
    expect(r.custoLote).toBe(208) // 40×5 + 8×1
    expect(r.custoPorUnidade).toBeNull()
    expect(r.semRendimento).toBe(true)
    expect(r.custoADefinir).toBe(false)
  })
  it('componente sem custo → a definir (nunca 0,01)', () => {
    const r = calcularCustoTeorico([{ custoMedio: 40, qtdPlanejada: 5 }, { custoMedio: null, qtdPlanejada: 1 }], 50)
    expect(r.custoADefinir).toBe(true)
    expect(r.custoLote).toBeNull()
    expect(r.custoPorUnidade).toBeNull()
    expect(r.componentesSemCusto).toBe(1)
  })
  it('com rendimento → custo por unidade', () => {
    const r = calcularCustoTeorico([{ custoMedio: 40, qtdPlanejada: 5 }], 40) // 200 / 40 = 5,00
    expect(r.custoLote).toBe(200)
    expect(r.custoPorUnidade).toBe(5)
  })
})

describe('calcularMargem', () => {
  it('margem ok', () => { expect(calcularMargem(10, 5)).toBe(0.5) })
  it('sem valorVenda → a definir (null)', () => { expect(calcularMargem(null, 5)).toBeNull() })
  it('sem custo → null', () => { expect(calcularMargem(10, null)).toBeNull() })
})
