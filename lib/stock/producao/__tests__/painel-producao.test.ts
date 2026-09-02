// ⭐⭐ AS AGREGAÇÕES DO PAINEL DE PRODUÇÃO (01/09/2026).
//
// O dono exigiu, antes do código, o mapa de onde cada número vem — *"quero conferir que
// nenhum nasceu de conta nova"*. Este arquivo trava as duas contas que são REALMENTE novas
// (a ponderada e o em-produção extraído) e a régua de "é de ontem?".

import { describe, it, expect } from 'vitest'
import { emProducaoPorOrdem, valorEmProducao } from '../em-producao'
import { rendimentoPonderado, ehDeOntem, ESTADOS_ABERTOS } from '../painel-producao'

describe('⭐⭐ o em-produção — UMA expressão, não três', () => {
  const movs = [
    { receiptId: 'o1', itemId: 'queijo', tipo: 'SEPARACAO_SAIDA', quantidade: -20.85 },
    { receiptId: 'o1', itemId: 'queijo', tipo: 'DEVOLUCAO_PRODUCAO', quantidade: 0.85 },
    { receiptId: 'o2', itemId: 'coxao', tipo: 'SEPARACAO_SAIDA', quantidade: -8 },
    { receiptId: 'o2', itemId: 'coxao', tipo: 'PRODUCAO_CONSUMO', quantidade: -8 },
  ]

  it('⭐ separou entra; consumiu e devolveu saem', () => {
    const m = emProducaoPorOrdem(movs)
    expect(m.get('o1')!.get('queijo')).toBeCloseTo(20, 2) // 20,85 − 0,85
    expect(m.get('o2')!.get('coxao')).toBe(0) // separou 8, consumiu 8 → nada preso
  })

  it('⚠️ o SINAL do ledger não serve: SEPARACAO é negativo porque sai da PRATELEIRA', () => {
    // se a conta usasse o sinal cru, o em-produção ficaria negativo — e o card diria que
    // há dinheiro NEGATIVO parado.
    expect(emProducaoPorOrdem([movs[0]]).get('o1')!.get('queijo')).toBeCloseTo(20.85, 2)
  })

  it('⭐ o VALOR usa o custo médio — a mesma fonte da Posição', () => {
    const custo = new Map<string, number | null>([['queijo', 31.9], ['coxao', 46.95]])
    expect(valorEmProducao(emProducaoPorOrdem(movs), custo)).toBeCloseTo(638, 0) // 20 × 31,90
  })

  it('⚠️ item SEM custo (nunca teve nota) vale 0, não quebra a soma', () => {
    const custo = new Map<string, number | null>([['queijo', null]])
    expect(valorEmProducao(emProducaoPorOrdem(movs), custo)).toBe(0)
  })

  it('⛔ sobra NEGATIVA não vira crédito — quem acusa isso é o P1', () => {
    const errado = [{ receiptId: 'x', itemId: 'a', tipo: 'PRODUCAO_CONSUMO', quantidade: -5 }]
    expect(valorEmProducao(emProducaoPorOrdem(errado), new Map([['a', 10]]))).toBe(0)
  })
})

describe('⭐⭐ o rendimento do período é PONDERADO', () => {
  it('⭐⭐ um lote de 200 e um de 5 NÃO pesam igual', () => {
    // 190 de 200 esperados + 2 de 5 esperados = 192 / 205
    const r = rendimentoPonderado([
      { qtdGerada: 190, esperado: 200 },
      { qtdGerada: 2, esperado: 5 },
    ])
    expect(r.pct).toBeCloseTo(0.937, 2)
    expect(r.lotes).toBe(2)

    // ⛔ CONTRAFACTUAL — a média SIMPLES dos percentuais daria 0,675: o teste minúsculo
    // (40%) derrubaria o dia inteiro de 95%. É a razão de a régua ser ponderada.
    const simples = (190 / 200 + 2 / 5) / 2
    expect(simples).toBeCloseTo(0.675, 2)
    expect(r.pct!).toBeGreaterThan(simples + 0.25)
  })

  it('⚠️ lote SEM régua fica fora das DUAS somas — não infla nem zera', () => {
    const r = rendimentoPonderado([
      { qtdGerada: 100, esperado: 100 },
      { qtdGerada: 50, esperado: null }, // ficha sem rendimento medido
    ])
    expect(r.pct).toBe(1)
    expect(r.lotes).toBe(1) // ⭐ a tela diz "de 1 lote", não "de 2"
  })

  it('⚠️ nada concluído → null, nunca 0 (zero afirmaria que rendeu nada)', () => {
    expect(rendimentoPonderado([])).toEqual({ pct: null, lotes: 0 })
    expect(rendimentoPonderado([{ qtdGerada: 10, esperado: 0 }])).toEqual({ pct: null, lotes: 0 })
  })
})

describe('⚠️ "é de ontem?" ≠ "parou >24h?"', () => {
  const agora = new Date('2026-09-01T08:00:00Z')

  it('⚠️ ordem mexida ONTEM às 23h É de ontem — mas NÃO está parada há 24h', () => {
    const ontem23h = new Date('2026-08-31T23:00:00Z')
    expect(ehDeOntem(ontem23h, agora)).toBe(true)
    const horas = (agora.getTime() - ontem23h.getTime()) / 3600_000
    expect(horas).toBeLessThan(24) // ⭐ o P2 NÃO dispararia — e as duas estão certas
  })

  it('⭐ ordem mexida HOJE não é de ontem, por mais cedo que tenha sido', () => {
    expect(ehDeOntem(new Date('2026-09-01T00:01:00Z'), agora)).toBe(false)
  })

  it('⭐ e a lista de estados abertos é a MESMA do P2', () => {
    expect([...ESTADOS_ABERTOS]).toEqual(['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'])
  })
})
