/**
 * ⭐⭐ O PREVIEW RESPONDE "ISSO MEXE NO MEU ESTOQUE?" — e nas 28 fichas 1:1 a resposta é NÃO.
 *
 * ⚠️ É o teste que protege a frase mais importante da tela. Se o preview passar a dizer que a
 * separação muda numa ficha 1:1, o dono (com razão) não converte nenhuma das 37 — e os 37
 * achados do M5 ficam pra sempre.
 */

import { describe, it, expect } from 'vitest'
import { previewDaConversao, fraseDoPreview, PEDIDO_DE_EXEMPLO } from '../preview-da-conversao'

/** a `porcao coxao 80 grama` real: lote 1 KG, produto em UN, dose de trim 0,18 KG */
const PORCAO_COXAO = {
  loteBase: 1,
  unidadeLoteBase: 'KG',
  unidadeProduto: 'UN',
  componentes: [
    { itemId: 'coxao', nome: 'Coxão Mole', unidade: 'KG', qtdPlanejada: 0.18 },
    { itemId: 'sal', nome: 'sal', unidade: 'KG', qtdPlanejada: 0.002 },
  ],
}

describe('⭐⭐ o caso 1:1 — 28 das 30 fichas medidas', () => {
  it('⭐⭐ a separação NÃO muda um grama, e o preview DIZ isso', () => {
    const p = previewDaConversao(PORCAO_COXAO, 1)!
    expect(p.separacaoIntacta).toBe(true)
    expect(p.soRotulo).toBe(true)
    // pedir 10 porções separa 1,8 KG de coxão — antes e depois
    expect(p.separacao[0]).toMatchObject({ nome: 'Coxão Mole', antes: 1.8, depois: 1.8, igual: true })
    expect(p.separacao[1]).toMatchObject({ antes: 0.02, depois: 0.02, igual: true })
    expect(fraseDoPreview(p, 'UN')).toContain('a separação NÃO muda')
  })

  it('⭐ e a ficha nova diz a verdade sobre o que produz', () => {
    const p = previewDaConversao(PORCAO_COXAO, 1)!
    expect(p.conversao).toMatchObject({ loteBaseNovo: 1, unidadeLoteBaseNova: 'UN' })
  })

  it('o pedido de exemplo é PARÂMETRO — a conta escala com ele', () => {
    expect(PEDIDO_DE_EXEMPLO).toBe(10)
    const p = previewDaConversao(PORCAO_COXAO, 1, 80)!
    expect(p.pedido).toBe(80)
    // 80 porções × 0,18 = 14,4 KG de coxão, nos dois lados
    expect(p.separacao[0]).toMatchObject({ antes: 14.4, depois: 14.4, igual: true })
    expect(p.separacaoIntacta).toBe(true)
  })
})

describe('⛔⛔ o caso que MUDA — e aí o preview grita', () => {
  it('⛔ a fórmula do NOME (12,5) muda a separação e o aviso aparece', () => {
    const p = previewDaConversao(PORCAO_COXAO, 12.5)!
    expect(p.separacaoIntacta).toBe(false)
    expect(p.soRotulo).toBe(false)
    // ⛔ de 1,8 KG pra 0,144 KG: 14 g de carne em cada porção de 80 g
    expect(p.separacao[0].antes).toBe(1.8)
    expect(p.separacao[0].depois).toBeCloseTo(0.144, 4)
    const frase = fraseDoPreview(p, 'UN')
    expect(frase).toContain('a separação MUDA')
    expect(frase).toContain('2 de 2')
  })

  it('⭐ a MAIONESE muda de verdade (lote 2,858 UN → 1 KG) e o preview mostra a conta', () => {
    const maionese = {
      loteBase: 2.858,
      unidadeLoteBase: 'UN',
      unidadeProduto: 'KG',
      componentes: [{ itemId: 'oleo', nome: 'OLEO DE SOJA', unidade: 'LT', qtdPlanejada: 3 }],
    }
    const p = previewDaConversao(maionese, 2.858, 10)!
    // ANTES: 10 ÷ 2,858 = 3,4989 lotes × 3 LT = 10,4969 LT
    expect(p.separacao[0].antes).toBeCloseTo(10.4969, 3)
    // DEPOIS: 10 ÷ 1 = 10 lotes × 1,049685 LT = 10,4969 LT  ⭐ o MESMO material
    expect(p.separacao[0].depois).toBeCloseTo(10.4969, 3)
    /**
     * ⭐⭐ ACHADO DO TESTE, e é o ponto que torna a conversão segura: no caso da MAIONESE as
     * DOSES mudam (3 LT → 1,05 LT) mas a SEPARAÇÃO dá no mesmo material — porque a conversão
     * só reescreve a mesma receita numa unidade honesta. A tela tem frase própria pra isso.
     */
    expect(p.soRotulo).toBe(false)
    expect(p.separacaoIntacta).toBe(true)
    expect(fraseDoPreview(p, 'KG')).toContain('dá no mesmo material')
  })
})

/**
 * ═══ ⭐⭐⭐ A LEI QUE O TESTE DA MAIONESE EXPÔS (04/10/2026) ═══
 *
 * A separação é **exatamente** `pedido ÷ loteBase × dose`. Depois da conversão ela é
 * `pedido ÷ 1 × (dose ÷ unidadesPorReceita)`. As duas são iguais **se e somente se**
 * `unidadesPorReceita == loteBase`.
 *
 * ⭐⭐ **E isso é o diagnóstico inteiro em uma frase:** *converter é neutro no estoque
 * precisamente quando o dono diz que o NÚMERO do lote já estava certo e só a UNIDADE estava
 * errada* — que é o caso das 37 fichas (`1 KG` → `1 UN`; `2,858 UN` → `2,858 KG`... e aí vira
 * `1 KG` com a dose dividida, dando no mesmo material).
 *
 * ⛔ **O corolário é a trava:** se o dono digitar um número DIFERENTE do loteBase atual, ele
 * **não está corrigindo rótulo — está mudando a receita**, e aí a separação muda mesmo. É o
 * caso da fórmula do nome (12,5 ≠ 1). O preview mostra os dois números lado a lado; esta lei é
 * por que ele PODE prometer "não mexe no estoque" sem mentir.
 */
describe('⭐⭐⭐ a lei: converter é neutro no estoque ⟺ o número digitado É o loteBase atual', () => {
  const casos = [
    { nome: 'porção em KG→UN (as 28 do dado real)', loteBase: 1, digitado: 1 },
    { nome: 'MAIONESE (o caso inverso)', loteBase: 2.858, digitado: 2.858 },
    { nome: 'QUEIJO CHEDDAR com o medido envenenado', loteBase: 1, digitado: 7.5572 },
    { nome: 'a fórmula do nome', loteBase: 1, digitado: 12.5 },
    { nome: 'lote fracionário batendo', loteBase: 0.5, digitado: 0.5 },
    { nome: 'lote grande destoando', loteBase: 12, digitado: 1 },
  ]

  for (const c of casos) {
    it(`${c.nome}: loteBase ${c.loteBase} × digitado ${c.digitado}`, () => {
      const ficha = {
        loteBase: c.loteBase,
        unidadeLoteBase: 'KG',
        unidadeProduto: 'UN',
        componentes: [
          { itemId: 'a', nome: 'principal', unidade: 'KG', qtdPlanejada: 0.18 },
          { itemId: 'b', nome: 'secundário', unidade: 'KG', qtdPlanejada: 1.4 },
        ],
      }
      const p = previewDaConversao(ficha, c.digitado, 10)!
      const deveriaSerNeutro = Math.abs(c.digitado - c.loteBase) < 1e-9
      expect(p.separacaoIntacta, `${c.nome} — a lei diz ${deveriaSerNeutro}`).toBe(deveriaSerNeutro)
    })
  }

  it('⭐ e a lei vale pra QUALQUER pedido: não é coincidência do 10', () => {
    const ficha = {
      loteBase: 2.858,
      unidadeLoteBase: 'UN',
      unidadeProduto: 'KG',
      componentes: [{ itemId: 'a', nome: 'óleo', unidade: 'LT', qtdPlanejada: 3 }],
    }
    for (const pedido of [1, 7, 10, 80, 137.5, 1000]) {
      expect(previewDaConversao(ficha, 2.858, pedido)!.separacaoIntacta, `pedido ${pedido}`).toBe(true)
      expect(previewDaConversao(ficha, 1, pedido)!.separacaoIntacta, `pedido ${pedido}`).toBe(false)
    }
  })
})

describe('as recusas — nunca um número plausível e errado', () => {
  it('⛔ número que não serve não vira preview', () => {
    expect(previewDaConversao(PORCAO_COXAO, 0)).toBeNull()
    expect(previewDaConversao(PORCAO_COXAO, 1, 0)).toBeNull()
    expect(previewDaConversao({ ...PORCAO_COXAO, loteBase: 0 }, 1)).toBeNull()
  })

  it('⛔ dose ZERO na ficha devolve `null` na linha, nunca 0 (que leria como "não separa nada")', () => {
    const comZero = {
      ...PORCAO_COXAO,
      componentes: [{ itemId: 'x', nome: 'tempero', unidade: 'KG', qtdPlanejada: 0 }],
    }
    const p = previewDaConversao(comZero, 1)!
    expect(p.separacao[0].antes).toBeNull()
    expect(p.separacao[0].depois).toBeNull()
    expect(p.separacao[0].igual).toBe(false)
  })
})
