// ⭐⭐ OS NÚMEROS DO PRINT DO DONO (01/09/2026) — "porção queijo 135 grama".
//
// A ficha pede **0,135 KG** de mussarela por porção e rende **1 porção** por receita; a
// cozinha entrega **92%** disso na média medida. Todos os números que o dono citou saem
// desta régua, e é isso que prova que o modelo é o certo:
//   · 20,85 kg tirados  → ~154 porções (teórico)  ·  ~142 pela média
//   · "faz 200 porções" → 27 kg teórico  ·  **29,3 kg** pela média  ← o sentido principal
//   · 100 kg           → ~740 teórico   ·  ~681 pela média
//   · saíram 120       → **78%** do teórico
//
// ⚠️ O TESTE DA IDA-E-VOLTA é o que impede a tela de se contradizer: `200 → 29,3 → 200`.

import { describe, it, expect } from 'vitest'
import {
  escalaDoConsumo, reguaDoRendimento, preverSaida, escalaParaSaida, insumoParaSaida,
  avaliarVariacao, MIN_LOTES_PARA_MEDIA,
} from '../previsao-rendimento'

const POR_LOTE = 0.135          // KG de mussarela por 1× a receita
const QUEIJO = { teorico: 1, medido: 0.92, lotes: 4 }   // 1 porção/receita; medido 92%, 4 lotes
const SEM_HISTORICO = { teorico: 1, medido: null, lotes: 0 }
const UM_LOTE = { teorico: 1, medido: 0.92, lotes: 1 }

describe('⭐ o que o dono tirou da câmara vira previsão', () => {
  it('⭐ 20,85 KG de mussarela = 154,4 receitas → ~154 teórico · ~142 pela média', () => {
    const escala = escalaDoConsumo([{ qtd: 20.85, porLote: POR_LOTE }])!
    expect(escala).toBeCloseTo(154.44, 2)
    const p = preverSaida(escala, QUEIJO)
    expect(Math.round(p.teorico)).toBe(154)
    expect(Math.round(p.medido!)).toBe(142)
    expect(Math.round(p.esperado)).toBe(142) // a régua vigente é a MEDIDA (4 lotes)
  })

  it('⭐⭐ o SENTIDO PRINCIPAL: "faz 200 porções" → 29,3 KG (e não 27)', () => {
    // ⚠️ é a razão de a régua ser a medida: pelo teórico ele pega 27 kg e FALTA.
    expect(insumoParaSaida(200, POR_LOTE, QUEIJO)).toBeCloseTo(29.35, 2)
    expect(insumoParaSaida(200, POR_LOTE, SEM_HISTORICO)).toBeCloseTo(27, 2)
  })

  it('⭐ 100 KG → ~681 pela média (o ~740 é o teórico, que fica ao lado)', () => {
    // ⚠️ a lib devolve o valor EXATO (740,74 / 681,48) — quem arredonda é a TELA, com a
    // precisão da ficha. É a mesma regra que fez o `round2` do `explodirSeparacao` cair:
    // arredondar no servidor perde dado antes de alguém poder decidir como mostrar.
    const escala = escalaDoConsumo([{ qtd: 100, porLote: POR_LOTE }])!
    const p = preverSaida(escala, QUEIJO)
    expect(p.teorico).toBeCloseTo(740.74, 1)
    expect(p.esperado).toBeCloseTo(681.48, 1)
  })
})

describe('⛔⛔ a ida-e-volta TEM que fechar — senão a tela parece defeituosa', () => {
  it('⛔⛔ 200 porções → 29,3 KG → 200 porções', () => {
    const kg = insumoParaSaida(200, POR_LOTE, QUEIJO)!
    const volta = preverSaida(escalaDoConsumo([{ qtd: kg, porLote: POR_LOTE }])!, QUEIJO)
    expect(volta.esperado).toBeCloseTo(200, 1)
  })

  it('⛔ com réguas MISTURADAS a volta erraria em 17 porções (o bug evitado)', () => {
    // ida pela média (29,35 kg) e volta pelo teórico = 217 — o dono digitaria 200 e veria 217.
    const kg = insumoParaSaida(200, POR_LOTE, QUEIJO)!
    const voltaTeorica = preverSaida(escalaDoConsumo([{ qtd: kg, porLote: POR_LOTE }])!, QUEIJO).teorico
    expect(Math.round(voltaTeorica)).toBe(217)
    expect(Math.round(voltaTeorica)).not.toBe(200) // é isto que a régua única impede
  })
})

describe('⚠️ uma produção não é média', () => {
  it(`⚠️ com ${MIN_LOTES_PARA_MEDIA - 1} lote a régua ainda é a FICHA`, () => {
    const r = reguaDoRendimento(UM_LOTE)
    expect(r.daMedia).toBe(false)
    expect(r.valor).toBe(1)              // o teórico
    expect(r.pct).toBeCloseTo(0.92, 2)   // mas o 92% aparece na tela ("1 lote ainda não é média")
    expect(insumoParaSaida(200, POR_LOTE, UM_LOTE)).toBeCloseTo(27, 2)
  })

  it(`⭐ com ${MIN_LOTES_PARA_MEDIA} lotes a régua VIRA a medida`, () => {
    const r = reguaDoRendimento({ teorico: 1, medido: 0.92, lotes: 2 })
    expect(r.daMedia).toBe(true)
    expect(r.lotes).toBe(2)
  })

  it('⚠️ sem histórico nenhum: só o teórico, sem inventar', () => {
    const r = reguaDoRendimento(SEM_HISTORICO)
    expect(r.daMedia).toBe(false)
    expect(r.pct).toBeNull()
    expect(preverSaida(10, SEM_HISTORICO).medido).toBeNull()
  })
})

describe('⭐ o aviso de variação — sugere, nunca decide', () => {
  const escala = 154.44
  it('⭐ saíram 120 → 78% do teórico, e ABAIXO contra a média de 92%', () => {
    const v = avaliarVariacao(120, escala, QUEIJO)
    expect(v.pctTeorico).toBeCloseTo(0.777, 2)   // o "78%" do dono
    expect(v.pctMedia).toBeCloseTo(0.845, 2)
    expect(v.pctMediaDaFicha).toBeCloseTo(0.92, 2)
    expect(v.faixa).toBe('ABAIXO')
    expect(v.alerta).toBe(true)
  })

  it('⭐ saíram 142 (o esperado pela média) → NORMAL, sem alerta', () => {
    const v = avaliarVariacao(142, escala, QUEIJO)
    expect(v.faixa).toBe('NORMAL')
    expect(v.alerta).toBe(false)
  })

  it('⭐ saiu MUITO mais que o normal também avisa (pode ser porção menor que a ficha)', () => {
    expect(avaliarVariacao(180, escala, QUEIJO).faixa).toBe('ACIMA')
  })

  it('⛔⛔ com 1 lote NÃO acusa nada — "normal" de uma medição só é régua inventada', () => {
    const v = avaliarVariacao(120, escala, UM_LOTE)
    expect(v.faixa).toBe('SEM_REGUA')
    expect(v.alerta).toBe(false)
    expect(v.pctTeorico).toBeCloseTo(0.777, 2) // o número aparece; o JULGAMENTO é que não
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
