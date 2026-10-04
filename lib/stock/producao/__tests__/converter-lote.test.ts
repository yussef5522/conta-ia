/**
 * ⭐⭐ O ASSISTENTE DE CONVERSÃO KG→UN — e o contrafactual que matou a fórmula do nome.
 *
 * ⚠️ **ESTE ARQUIVO EXISTE PORQUE O DADO REFUTOU O PEDIDO.** O dono propôs dividir as doses
 * por `1 ÷ peso-do-nome` (*"porcao coxao 80 grama → 12,5 UN/KG"*). Medido nas 37 fichas reais,
 * isso produz **14 g de coxão numa porção de 80 g**. O teste do contrafactual é o que impede
 * alguém de "simplificar" o assistente de volta pra uma fórmula só.
 */

import { describe, it, expect } from 'vitest'
import {
  converterLote,
  sugestoesDaConversao,
  pesoDoNome,
  CONCORDANCIA_DAS_FONTES,
} from '../converter-lote'

/** A `porcao coxao 80 grama` real da Caçula: lote declarado em KG, produto contado em UN. */
const PORCAO_COXAO = {
  loteBase: 1,
  unidadeLoteBase: 'KG',
  unidadeProduto: 'UN',
  componentes: [
    { itemId: 'coxao', nome: 'Coxão Mole', unidade: 'KG', qtdPlanejada: 0.18 },
    { itemId: 'sal', nome: 'sal', unidade: 'KG', qtdPlanejada: 0.002 },
  ],
}

describe('converterLote — 1 receita passa a produzir 1 unidade do produto', () => {
  it('⭐ com 1 UN por receita a dose fica INTACTA: a conversão é só de rótulo', () => {
    const r = converterLote(PORCAO_COXAO, 1)!
    expect(r.loteBaseNovo).toBe(1)
    expect(r.unidadeLoteBaseNova).toBe('UN')
    expect(r.componentes.map((c) => c.qtdNova)).toEqual([0.18, 0.002])
    expect(r.soRotulo).toBe(true)
    expect(r.componentes.every((c) => c.intacta)).toBe(true)
  })

  it('⭐ a MAIONESE é o caso INVERSO e a mesma fórmula a resolve (2,858 UN → 1 KG)', () => {
    const maionese = {
      loteBase: 2.858,
      unidadeLoteBase: 'UN',
      unidadeProduto: 'KG',
      componentes: [{ itemId: 'oleo', nome: 'OLEO DE SOJA', unidade: 'LT', qtdPlanejada: 3 }],
    }
    const r = converterLote(maionese, 2.858)!
    expect(r.loteBaseNovo).toBe(1)
    expect(r.unidadeLoteBaseNova).toBe('KG')
    // 3 LT de óleo por 2,858 KG de maionese → 1,049685 LT por KG
    expect(r.componentes[0].qtdNova).toBeCloseTo(1.049685, 6)
    expect(r.soRotulo).toBe(false)
  })

  it('⛔⛔ O CONTRAFACTUAL: a fórmula do NOME daria 14 g de coxão numa porção de 80 g', () => {
    // `1 ÷ 0,080` = 12,5 — o número que o pedido original propunha
    const r = converterLote(PORCAO_COXAO, 12.5)!
    expect(r.componentes[0].qtdNova).toBeCloseTo(0.0144, 4)
    // 14 gramas de carne numa porção que o nome diz ter 80 g
    expect(r.componentes[0].qtdNova * 1000).toBeLessThan(15)
  })

  it('⛔ número que não serve NÃO converte (nunca chuta)', () => {
    expect(converterLote(PORCAO_COXAO, 0)).toBeNull()
    expect(converterLote(PORCAO_COXAO, -1)).toBeNull()
    expect(converterLote({ ...PORCAO_COXAO, loteBase: 0 }, 1)).toBeNull()
  })
})

describe('pesoDoNome — lê o que o nome DECLARA, e só', () => {
  it('lê grama e ml, com e sem espaço', () => {
    expect(pesoDoNome('porcao coxao 80 grama')).toBe(0.08)
    expect(pesoDoNome('porçao queijo 135 grama')).toBe(0.135)
    expect(pesoDoNome('MOLHO 150g')).toBe(0.15)
    expect(pesoDoNome('SUCO 200 ML')).toBe(0.2)
  })

  it('⛔ KG fica de fora de propósito: "QUEIJO 2KG" é a EMBALAGEM que entra, não a porção que sai', () => {
    expect(pesoDoNome('QUEIJO MUSSARELA 2KG')).toBeNull()
    expect(pesoDoNome('FEIJAO 1 KG')).toBeNull()
  })

  it('nome que não diz peso devolve null', () => {
    expect(pesoDoNome('beef de xis')).toBeNull()
    expect(pesoDoNome('MAIONESE')).toBeNull()
  })
})

describe('sugestoesDaConversao — três fontes, cada uma com a proveniência escrita', () => {
  it('⭐ o MEDIDO vem PRIMEIRO: é a medição da própria pergunta', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama',
      dosePrincipal: 0.18,
      medido: 1.02,
      lotes: 5,
      loteBase: 1,
    })
    expect(r.candidatas[0].origem).toBe('MEDIDO')
    expect(r.candidatas[0].valor).toBe(1.02)
    expect(r.candidatas[0].porque).toContain('5 lotes')
  })

  it('⛔ o MEDIDO não entra com UM lote só: uma produção não é média', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama',
      dosePrincipal: 0.18,
      medido: 1.02,
      lotes: 1,
      loteBase: 1,
    })
    expect(r.candidatas.some((c) => c.origem === 'MEDIDO')).toBe(false)
  })

  it('⭐⭐ MEDIDO ≈ 1 e UM_POR_RECEITA concordam → recomenda, e a recomendada é a MEDIDA', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama',
      dosePrincipal: 0.18,
      medido: 1.02,
      lotes: 5,
      loteBase: 1,
    })
    expect(r.recomendada?.origem).toBe('MEDIDO')
    expect(r.fontesDiscordam).toBe(false)
  })

  it('⭐ quando a dose JÁ É do tamanho da unidade, a frase DIZ isso (e explica a perda de trim)', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama',
      dosePrincipal: 0.18,
      medido: null,
      lotes: 0,
      loteBase: 1,
    })
    const um = r.candidatas.find((c) => c.origem === 'UM_POR_RECEITA')!
    expect(um.porque).toContain('já é do tamanho de 1 unidade')
    expect(um.porque).toContain('2,25') // 0,18 ÷ 0,080 = 2,25× o peso do nome
  })

  it('⭐ a fonte NOME aparece — e vem por ÚLTIMO, porque foi ela que falhou no dado real', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama',
      dosePrincipal: 0.18,
      medido: null,
      lotes: 0,
      loteBase: 1,
    })
    expect(r.candidatas[r.candidatas.length - 1].origem).toBe('NOME')
    expect(r.candidatas.at(-1)!.valor).toBe(12.5)
    expect(r.candidatas.at(-1)!.porque).toContain('confira a dose')
  })

  it('⛔⛔ SEM o medido, NOME (12,5) × UM_POR_RECEITA (1) DISCORDAM → nenhuma recomendada', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama',
      dosePrincipal: 0.18,
      medido: null,
      lotes: 0,
      loteBase: 1,
    })
    expect(r.recomendada).toBeNull()
    expect(r.fontesDiscordam).toBe(true)
    // ⭐ é AQUI que o dono decide — e é por isso que as duas aparecem com a conta do lado
    expect(r.candidatas.length).toBe(2)
  })

  it('⛔ fonte ÚNICA não recomenda: "duas concordando" é o critério, não "achei alguma"', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'MAIONESE',
      dosePrincipal: 3,
      medido: null,
      lotes: 0,
      loteBase: 2.858,
    })
    expect(r.candidatas.map((c) => c.origem)).toEqual(['UM_POR_RECEITA'])
    expect(r.recomendada).toBeNull()
    expect(r.fontesDiscordam).toBe(false)
  })

  it('⭐ a MAIONESE real: o medido 2,858 bate no ponto e DISCORDA do 1 — a tela mostra as duas', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'MAIONESE',
      dosePrincipal: 3,
      medido: 2.858,
      lotes: 4,
      loteBase: 2.858,
    })
    expect(r.candidatas[0]).toMatchObject({ origem: 'MEDIDO', valor: 2.858 })
    expect(r.fontesDiscordam).toBe(true)
    expect(r.recomendada).toBeNull()
  })

  it('a faixa de concordância é ±10% e vale pros dois lados da borda', () => {
    expect(CONCORDANCIA_DAS_FONTES).toBe(0.1)
    const dentro = sugestoesDaConversao({
      nomeProduto: 'beef de xis', dosePrincipal: 0.091, medido: 1.09, lotes: 3, loteBase: 1,
    })
    expect(dentro.recomendada?.origem).toBe('MEDIDO')
    const fora = sugestoesDaConversao({
      nomeProduto: 'beef de xis', dosePrincipal: 0.091, medido: 1.2, lotes: 3, loteBase: 1,
    })
    expect(fora.recomendada).toBeNull()
    expect(fora.fontesDiscordam).toBe(true)
  })

  /**
   * ⚠️⚠️ ESTE GUARD NASCEU DE DEFEITO REAL, pego na 1ª rodada: as frases interpolavam o número
   * CRU e imprimiam `0.18` / `2.25`. Elas vão pra TELA, e esta casa escreve pt-BR — é a cicatriz
   * do campo de quantidade (29/09) e do markdown que vazou pra UI (03/10): **o que a tela mostra
   * fala a língua do dono, não a do JavaScript.**
   */
  it('⛔⛔ nenhuma frase vaza ponto decimal nem markdown — ela vai pra TELA', () => {
    const cenarios = [
      { nomeProduto: 'porcao coxao 80 grama', dosePrincipal: 0.18, medido: 1.0204, lotes: 5, loteBase: 1 },
      { nomeProduto: 'MAIONESE', dosePrincipal: 3, medido: 2.858, lotes: 4, loteBase: 2.858 },
      { nomeProduto: 'porçao queijo 135 grama', dosePrincipal: 0.135, medido: null, lotes: 0, loteBase: 1 },
      { nomeProduto: 'beef de xis', dosePrincipal: 0.091, medido: 1.2532, lotes: 5, loteBase: 1 },
    ]
    for (const c of cenarios) {
      for (const cand of sugestoesDaConversao(c).candidatas) {
        // número com ponto decimal (1.5) — vírgula é a régua; "1.280" de milhar também não aparece aqui
        expect(cand.porque, `${c.nomeProduto} / ${cand.origem}`).not.toMatch(/\d\.\d/)
        expect(cand.porque).not.toMatch(/\*\*|__|<[a-z]/i)
      }
    }
  })

  it('⭐ e o número SAI em pt-BR: a razão 2,25 aparece com vírgula', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'porcao coxao 80 grama', dosePrincipal: 0.18, medido: null, lotes: 0, loteBase: 1,
    })
    const um = r.candidatas.find((c) => c.origem === 'UM_POR_RECEITA')!
    expect(um.porque).toContain('2,25')
    expect(um.porque).toContain('0,18')
    expect(um.porque).toContain('0,08')
  })

  it('⛔ o QUEIJO CHEDDAR é o outlier envenenado (medido 7,5572) e ele NÃO ganha recomendação sozinho', () => {
    const r = sugestoesDaConversao({
      nomeProduto: 'QUEIJO CHEDDAR FATIADO', dosePrincipal: 0.2, medido: 7.5572, lotes: 3, loteBase: 1,
    })
    expect(r.candidatas[0].valor).toBe(7.5572)
    expect(r.recomendada).toBeNull()
    expect(r.fontesDiscordam).toBe(true)
  })
})
