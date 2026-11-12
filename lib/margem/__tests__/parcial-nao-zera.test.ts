/**
 * ⭐⭐ E3 (12/11/2026, ordem do dono) — OS IRMÃOS da porta de custo (REGRA 14): ingrediente sem
 * preço NUNCA zera a ficha. O "pelo menos" soma o que tem preço; o total FECHADO continua
 * exigindo tudo; a marca de incompleto continua acesa (nunca parcial vestido de completo).
 */
import { describe, it, expect } from 'vitest'
import { montarPizza, type SaborDisponivel } from '../montador'
import { custoComplementoPorDia } from '../por-dia'
import type { TamanhoDePizza } from '../tamanhos'

const sabor = (nome: string, custo: number | null, parcial?: number): SaborDisponivel => ({ fichaId: nome, nome, custo, parcial, familia: 'X', icone: '🍕', temFicha: true })

describe('E3 · montador do "Quem paga a casa"', () => {
  const tamanho = { tamanho: 'GRANDE', sabores: 2, base: { fichaId: 'b', nome: 'base', custo: null, parcial: 8.14 } } as unknown as TamanhoDePizza

  it('base e sabor com ingrediente sem preço: o "pelo menos" SOMA o parcial; o total fechado segue null e marcado', () => {
    const r = montarPizza({ tamanho, escolhas: [sabor('CALABRESA', 4.8), sabor('MILHO', null, 1.5)], precoVenda: 60, canais: [] })
    expect(r.custoParcial).toBe(14.44) // 8,14 + 4,80 + 1,50 — antes: 4,80 (a base e o milho zerados)
    expect(r.custoTotal).toBeNull()
    expect(r.incompleto.map((i) => i.motivo)).toContain('SABOR_SEM_CUSTO')
  })
})

describe('E3 · CMV de complementos por dia', () => {
  it('o parcial ENTRA no custo e a ocorrência segue contada como sem custo (o CMV é o MÍNIMO)', () => {
    const m = custoComplementoPorDia(
      [{ dia: '2026-11-10', nomeSuitable: 'CALABRESA', ocorrencias: 10 }, { dia: '2026-11-10', nomeSuitable: 'MILHO', ocorrencias: 4 }],
      new Map([['CALABRESA', 4.8], ['MILHO', null]]),
      new Map([['MILHO', 1.5]]),
    )
    expect(m.get('2026-11-10')).toEqual({ custo: 54, comCusto: 10, semCusto: 4 })
  })
})
