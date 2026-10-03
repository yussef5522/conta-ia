// ⭐⭐ OS NÚMEROS DO PRINT DO DONO (01/09/2026) — "porção queijo 135 grama".
//
// A ficha pede **0,135 KG** de mussarela por porção e rende **1 porção** por receita; a
// cozinha entrega **92%** disso na média medida. Todos os números que o dono citou saem
// desta régua:
//   · 20,85 kg tirados  → ~154 porções (a receita)  ·  ~142 pela média
//   · "faz 200 porções" → 27 kg pela receita        ·  29,3 kg é o que a média DIRIA
//   · saíram 120        → **78%** do que a receita promete
//
// ⛔⛔⛔ **ESTE ARQUIVO MUDOU DE LEI EM 03/10/2026 — decisão do dono: "RECEITA É LEI,
// RENDIMENTO É SÓ RELATÓRIO".** A separação passou a ser SEMPRE `ficha × pedido`, e a
// conversão mudou de casa pra `escala-da-ordem.ts` (ver o pin em `pin-do-par-beef.test.ts`).
//
// **As asserções invertidas abaixo estão marcadas uma por uma, com o motivo.** O que em 01/09
// era *"a régua TEM que ser a medida, senão ele pega 27 kg e FALTA"* virou *"ele pega os 27 da
// receita; se a perda é real, EU mudo a ficha"*. O motivo não é aritmético e está escrito no
// topo de `escala-da-ordem.ts`: **sistema que adapta a separação pela medição aprende o
// desvio como normal e passa a cobrir ele.**

import { describe, it, expect } from 'vitest'
import {
  escalaDoConsumo, eficienciaMedia, preverSaida,
  avaliarVariacao, MIN_LOTES_PARA_MEDIA,
} from '../previsao-rendimento'
import { insumoDoPedido } from '../escala-da-ordem'

const POR_LOTE = 0.135          // KG de mussarela por 1× a receita
const QUEIJO = { teorico: 1, medido: 0.92, lotes: 4 }   // 1 porção/receita; medido 92%, 4 lotes
const SEM_HISTORICO = { teorico: 1, medido: null, lotes: 0 }
const UM_LOTE = { teorico: 1, medido: 0.92, lotes: 1 }

describe('⭐ o que o dono tirou da câmara vira previsão', () => {
  it('⭐ 20,85 KG de mussarela = 154,4 receitas → ~154 pela receita · ~142 é o que a média diria', () => {
    const escala = escalaDoConsumo([{ qtd: 20.85, porLote: POR_LOTE }])!
    expect(escala).toBeCloseTo(154.44, 2)
    const p = preverSaida(escala, QUEIJO)
    /** ⭐ a expectativa é a RECEITA — era `p.esperado` (a régua vigente) e dava 142 */
    expect(Math.round(p.esperadoDaFicha)).toBe(154)
    /** ⚠️ o 142 continua existindo, agora como ESPELHO ao lado, nunca como meta */
    expect(Math.round(p.medido!)).toBe(142)
  })

  it('⛔⛔ "faz 200 porções" → 27 KG, os da RECEITA — asserção INVERTIDA (era 29,3)', () => {
    /**
     * ⚠️⚠️ **ESTA É A INVERSÃO CENTRAL DO SPRINT DE 03/10.** Em 01/09 este teste exigia
     * **29,35** com o comentário *"é a razão de a régua ser a medida: pelo teórico ele pega
     * 27 kg e FALTA"*. O dono reverteu: **a separação é a receita**, e perda real só entra
     * quando ele muda a ficha (*"acém limpo = 95% do cru"*).
     *
     * ⭐ E o 29,35 não some do mundo — ele vira a frase do espelho na tela
     * (*"a sua média daria ~X"*) e o aviso do juiz P8 quando a eficiência cai.
     */
    expect(insumoDoPedido({ pedido: 200, loteBase: 1 }, POR_LOTE)).toBeCloseTo(27, 2)
    // ⛔ o contrafactual: era ISTO que a régua antiga devolvia
    expect(200 / 0.92 * POR_LOTE).toBeCloseTo(29.35, 2)
  })

  it('⭐ sem histórico a conta é a MESMA — e é o ponto: a medição não muda nada', () => {
    expect(insumoDoPedido({ pedido: 200, loteBase: 1 }, POR_LOTE)).toBeCloseTo(27, 2)
    expect(preverSaida(10, SEM_HISTORICO).esperadoDaFicha).toBe(10)
    expect(preverSaida(10, SEM_HISTORICO).medido).toBeNull()
  })
})

describe('⛔⛔ a ida-e-volta TEM que fechar — senão a tela parece defeituosa', () => {
  it('⭐⭐ 200 porções → 27 KG → 200 porções, e agora fecha SEM depender de régua', () => {
    /**
     * ⭐ **A ida-e-volta ficou TRIVIALMENTE verdadeira, e isso é melhorar.** Em 01/09 ela só
     * fechava porque os dois sentidos usavam a MESMA régua escolhida (média ou ficha); errar
     * a régua num dos lados produzia `200 → 29,3 → 217`. Com a receita nos dois lados **não
     * existe régua pra errar**.
     */
    const kg = insumoDoPedido({ pedido: 200, loteBase: 1 }, POR_LOTE)!
    const volta = preverSaida(escalaDoConsumo([{ qtd: kg, porLote: POR_LOTE }])!, QUEIJO)
    expect(volta.esperadoDaFicha).toBeCloseTo(200, 1)
  })

  it('⛔ o bug de 01/09 (erra 17 porções) ficou IMPOSSÍVEL, não só evitado', () => {
    /** ⚠️ Era `ida pela média + volta pelo teórico = 217`. A ida deixou de ter média. */
    const kg = insumoDoPedido({ pedido: 200, loteBase: 1 }, POR_LOTE)!
    expect(preverSaida(escalaDoConsumo([{ qtd: kg, porLote: POR_LOTE }])!, QUEIJO).esperadoDaFicha)
      .toBeCloseTo(200, 1)
  })
})

describe('⚠️ uma produção não é média — o espelho precisa de 2 lotes', () => {
  it(`⚠️ com ${MIN_LOTES_PARA_MEDIA - 1} lote NÃO existe espelho (mas o número está gravado)`, () => {
    /** ⭐ `reguaDoRendimento` morreu; a pergunta "a média manda?" não existe mais. */
    expect(eficienciaMedia(UM_LOTE)).toBeNull()
    // ⛔ e a separação é a mesma COM ou SEM espelho — a prova de que ele não manda
    expect(insumoDoPedido({ pedido: 200, loteBase: 1 }, POR_LOTE)).toBeCloseTo(27, 2)
  })

  it(`⭐ com ${MIN_LOTES_PARA_MEDIA} lotes o espelho EXISTE — pra ler, não pra dividir`, () => {
    expect(eficienciaMedia({ teorico: 1, medido: 0.92, lotes: 2 })).toEqual({ pct: 0.92, lotes: 2 })
  })

  it('⚠️ sem histórico nenhum: nada de espelho, sem inventar', () => {
    expect(eficienciaMedia(SEM_HISTORICO)).toBeNull()
    expect(preverSaida(10, SEM_HISTORICO).medido).toBeNull()
  })
})

describe('⭐ o aviso de EFICIÊNCIA — contra a receita, sugere e nunca decide', () => {
  const escala = 154.44
  it('⭐ saíram 120 → 78% do que a receita promete → ABAIXO', () => {
    const v = avaliarVariacao(120, escala, QUEIJO)
    expect(v.pctFicha).toBeCloseTo(0.777, 2)   // o "78%" do dono
    expect(v.pctMedia).toBeCloseTo(0.845, 2)   // ⭐ espelho: contra a sua média
    expect(v.pctMediaDaFicha).toBeCloseTo(0.92, 2)
    expect(v.faixa).toBe('ABAIXO')
    expect(v.alerta).toBe(true)
  })

  it('⭐ saíram 142 → 92% da RECEITA: NORMAL nas duas réguas, e por razões diferentes', () => {
    /**
     * ⚠️⚠️ **EU ERREI ESTA ASSERÇÃO E O TESTE ME CORRIGIU.** Escrevi que 142 passaria a ser
     * `ABAIXO` ("a régua mudou, então o 92% agora acusa") e rodei: veio `NORMAL`. **A conta
     * desmente o raciocínio** — 142/154,44 = **91,9%**, e a faixa é ±15%, então 92% está
     * dentro dela de qualquer lado que se meça.
     *
     * ⭐ E está CERTO que esteja: é a mesma razão por que o dono chamou o `beef de hamburger`
     * (94-99%) de *"OK"*. **Perda de poucos % é a vida real da cozinha; ela não é denúncia.**
     * O que a decisão de 03/10 mudou não foi a largura da faixa — foi **contra o que** ela é
     * medida, e o efeito aparece quando a média destoa MUITO da ficha (o xis em 125%).
     */
    const v = avaliarVariacao(142, escala, QUEIJO)
    expect(v.pctFicha).toBeCloseTo(0.919, 2)
    expect(v.faixa).toBe('NORMAL')
    expect(v.pctMedia).toBeCloseTo(1, 2) // ⭐ contra a média, 100% — as duas concordam aqui
  })

  it('⛔⛔ e com a MÉDIA ENVENENADA as duas réguas DISCORDAM — é aí que o sprint morde', () => {
    /**
     * ⭐ O caso real do `beef de xis`: a ficha promete 1 por receita, a média medida diz
     * 1,2532. Um lote que sai em **100% da receita** era julgado **ABAIXO** pela régua antiga
     * (*"você rendeu menos do que costuma"*) — e o sistema ainda separava menos por causa
     * disso. Hoje ele é NORMAL contra a receita, e a média virou a denúncia (P8 / aviso).
     */
    const XIS = { teorico: 1, medido: 1.2532, lotes: 27 }
    const v = avaliarVariacao(100, 100, XIS)
    expect(v.pctFicha).toBe(1)
    expect(v.faixa).toBe('NORMAL')          // ⭐ entregou o que a receita promete
    expect(v.pctMedia).toBeCloseTo(0.798, 2) // ⛔ a régua antiga chamaria isso de ABAIXO
  })

  it('⭐ saiu MUITO mais que a receita também avisa (pode ser porção menor que a ficha)', () => {
    expect(avaliarVariacao(190, escala, QUEIJO).faixa).toBe('ACIMA')
  })

  it('⛔⛔ com 1 lote JÁ ACUSA — asserção INVERTIDA, e o motivo é o mesmo', () => {
    /**
     * ⚠️ Era `SEM_REGUA` com o argumento *"'normal' de uma medição só é régua inventada"* —
     * verdade **enquanto a régua era a média**. A receita não precisa de histórico pra ser
     * régua: ela é a declaração do dono desde o primeiro lote.
     */
    const v = avaliarVariacao(120, escala, UM_LOTE)
    expect(v.pctFicha).toBeCloseTo(0.777, 2)
    expect(v.faixa).toBe('ABAIXO')
    expect(v.alerta).toBe(true)
  })

  it('⛔ ficha com lote base ZERADO → SEM_REGUA (o único caso que sobrou)', () => {
    const v = avaliarVariacao(120, escala, { teorico: 0, medido: 0.92, lotes: 4 })
    expect(v.pctFicha).toBeNull()
    expect(v.faixa).toBe('SEM_REGUA')
    expect(v.alerta).toBe(false)
  })
})

describe('⭐ escalaDoConsumo — a régua ÚNICA (a mesma que grava o rendimento)', () => {
  it('⭐ vários insumos na mesma escala: porção de carne 8 KG de cada, 1 KG por receita', () => {
    const e = escalaDoConsumo([
      { qtd: 8, porLote: 1 }, { qtd: 8, porLote: 1 }, { qtd: 8, porLote: 1 },
    ])
    expect(e).toBe(8)
  })

  it('⚠️ linha ainda NÃO separada não vota (senão a escala despencaria a cada linha vazia)', () => {
    expect(escalaDoConsumo([{ qtd: 8, porLote: 1 }, { qtd: 0, porLote: 1 }])).toBe(8)
  })

  it('⚠️ `porLote` zero não entra — dividir por zero inventaria escala infinita', () => {
    expect(escalaDoConsumo([{ qtd: 5, porLote: 0 }])).toBeNull()
    expect(escalaDoConsumo([])).toBeNull()
  })

  it('⚠️ linhas DESENCONTRADAS dão a média — é o que a tela avisa, não esconde', () => {
    // coxão pra 200 porções, acém só pra 150: a média (175) é o que `concluir` também usaria
    expect(escalaDoConsumo([{ qtd: 8, porLote: 1 }, { qtd: 6, porLote: 1 }])).toBe(7)
  })
})
