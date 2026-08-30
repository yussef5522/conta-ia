// ⭐⭐ REGRA 1 — O CASO DO OVO (30/08/2026).
//
// O dono ajustou a quantidade de 12 pra 360 (12 cartelas × 30 ovos — a conta CERTA) e o
// sistema manteve o custo por CARTELA em cada OVO: 360 × 18 = 6.480 por nota, contra os
// 216 que a nota declara. R$ 12.528 de estoque fantasma em duas notas.
//
// ⚠️ E o campo de fator não estava lá pra salvar: `uCom` era "UN" (cartela) e a unidade de
// controle também "UN" (ovo) — iguais, então o caminho certo ficou INVISÍVEL. Por isso o
// gatilho é a RAZÃO, não a diferença de unidade.

import { describe, it, expect } from 'vitest'
import { interpretarAjusteQtd } from '../ajuste-quantidade'

// a linha real da nota da CIA DA FRUTA
const OVO = { qtdNota: 12, vUnCom: 18 }

describe('⭐⭐ o caso do OVO: 12 → 360', () => {
  const r = interpretarAjusteQtd({ ...OVO, qtdRecebida: 360 })

  it('⭐⭐ CONVERSÃO mantém o valor da nota INTACTO e divide o custo', () => {
    expect(r.conversao).not.toBeNull()
    expect(r.conversao!.valorTotal).toBe(216) // ⭐ o que a nota diz
    expect(r.conversao!.custoUnitario).toBeCloseTo(0.6, 6)
    expect(r.conversao!.fatorConversao).toBe(30)
  })

  it('⭐⭐ QUANTIDADE REAL é a outra leitura — e mostra o 6.480 ANTES de gravar', () => {
    // ⚠️ é exatamente o número que virou fantasma. O ponto do fix é o dono VER os dois.
    expect(r.quantidadeReal.valorTotal).toBe(6480)
    expect(r.quantidadeReal.custoUnitario).toBe(18)
  })

  it('⭐ e o sistema RECONHECE que parece conversão (30× exato) — pra ordenar a tela', () => {
    expect(r.razao).toBe(30)
    expect(r.pareceConversao).toBe(true)
  })

  it('⚠️ mas NÃO escolhe sozinho: as duas opções voltam preenchidas', () => {
    // escolher por ele foi o que criou o fantasma. Sugere, o dono decide.
    expect(r.conversao).toBeTruthy()
    expect(r.quantidadeReal).toBeTruthy()
    expect(r.conversao!.valorTotal).not.toBe(r.quantidadeReal.valorTotal)
  })
})

describe('⭐ quantidade REAL diferente (o outro caso legítimo)', () => {
  it('recebi 10 de 12 (faltou mercadoria): o valor DESCE, o custo unitário fica', () => {
    const r = interpretarAjusteQtd({ ...OVO, qtdRecebida: 10 })
    expect(r.quantidadeReal.valorTotal).toBe(180)
    expect(r.quantidadeReal.custoUnitario).toBe(18)
    expect(r.pareceConversao).toBe(false) // 10/12 não é embalagem
  })

  it('recebi 13 de 12 (veio a mais): o valor SOBE', () => {
    const r = interpretarAjusteQtd({ ...OVO, qtdRecebida: 13 })
    expect(r.quantidadeReal.valorTotal).toBe(234)
    expect(r.pareceConversao).toBe(false)
  })
})

describe('⚠️ o custo da conversão vai em PRECISÃO CHEIA', () => {
  it('⭐⭐ o pão: 4 CX → 768 pães dá 2,3125, e arredondar aqui é o bug conhecido', () => {
    // 4 × 444 = 1.776; 1.776 / 768 = 2,3125 — não cabe em 2 casas.
    const r = interpretarAjusteQtd({ qtdNota: 4, vUnCom: 444, qtdRecebida: 768 })
    expect(r.conversao!.custoUnitario).toBe(2.3125)
    expect(r.conversao!.valorTotal).toBe(1776)
    // a prova de que fecha: 768 × 2,3125 == 1.776 exato
    expect(Math.round(768 * r.conversao!.custoUnitario * 100) / 100).toBe(1776)
  })

  it('⭐ a caixa de pizza: 6.313 unidades fecham com a nota ao centavo', () => {
    const r = interpretarAjusteQtd({ qtdNota: 6313, vUnCom: 2.742145, qtdRecebida: 6313 })
    // sem mudança de quantidade não há conversão a oferecer
    expect(r.mudou).toBe(false)
    expect(r.conversao).toBeNull()
  })
})

describe('bordas', () => {
  it('sem mudança: nada a perguntar', () => {
    const r = interpretarAjusteQtd({ ...OVO, qtdRecebida: 12 })
    expect(r.mudou).toBe(false)
    expect(r.conversao).toBeNull()
  })

  it('⭐ conversão pra MENOS (30 pacotes → 1 fardo) também é reconhecida', () => {
    const r = interpretarAjusteQtd({ qtdNota: 30, vUnCom: 2, qtdRecebida: 1 })
    expect(r.pareceConversao).toBe(true)
    expect(r.conversao!.valorTotal).toBe(60) // valor intacto
    expect(r.conversao!.custoUnitario).toBe(60)
  })

  it('respeita o fator JÁ aprendido na opção de quantidade real', () => {
    // 1 CX = 20 garrafas já aprendido: o custo por garrafa é 169,20/20
    const r = interpretarAjusteQtd({ qtdNota: 1, vUnCom: 169.2, qtdRecebida: 25, fatorAtual: 20 })
    expect(r.quantidadeReal.custoUnitario).toBeCloseTo(8.46, 6)
    expect(r.quantidadeReal.valorTotal).toBe(211.5) // 25 garrafas de verdade
  })

  it('qtdNota zero não estoura nem inventa razão', () => {
    const r = interpretarAjusteQtd({ qtdNota: 0, vUnCom: 10, qtdRecebida: 5 })
    expect(r.razao).toBeNull()
    expect(r.conversao).toBeNull()
    expect(r.pareceConversao).toBe(false)
  })
})
