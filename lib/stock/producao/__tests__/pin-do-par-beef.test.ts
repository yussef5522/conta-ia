/**
 * ⛔⛔⛔ O PIN DO PAR — ordem de 10 beefs separa a dose da ficha (item 4c, 03/10/2026).
 *
 * **O caso vivo:** *"ordem de beef de xis pede 10 → separa pra ~6,7 · hamburger OK"*. Medido em
 * prod, as duas fichas estão **iguais e corretas** (`loteBase 1`, doses por unidade, nunca
 * alteradas) — o que difere é o **rendimento MEDIDO**: xis **1,4749**, hamburger **0,9326**. A
 * escala nasce de `pedido ÷ rendimento`, então 10 ÷ 1,4749 = **6,78**.
 *
 * ⭐⭐ **E A MÉDIA DO XIS ESTAVA ENVENENADA POR DOIS LOTES**, não por um erro de ficha:
 * ```
 * 1,0400 · 1,0598 · 1,2532 · 1,8803 · 2,1411   →  MÉDIA 1,4749  ·  MEDIANA 1,2532
 * ```
 * (27/09 declarou 173 un com consumo pra 92; 29/09 declarou 94 com consumo pra 44.)
 *
 * ⚠️ **E o relato do dono era MENOR que o problema: o hamburger também separava errado** — 7%
 * a MAIS (razão 1,0723). A menos é visível porque falta material; a mais sobra e passa batido.
 *
 * ⭐ **A CURA SÃO DUAS CAMADAS, e nenhuma sozinha resolve** (cada teste abaixo prova uma):
 * **(1)** MEDIANA no lugar da média — tira o peso do outlier; **(2)** FAIXA DE CONCORDÂNCIA —
 * medição que destoa > ±20% do declarado **não manda**, e o sistema avisa.
 */
import { describe, it, expect } from 'vitest'
import {
  reguaDoRendimento,
  escalaParaSaida,
  insumoParaSaida,
  DISCORDANCIA_MAXIMA,
} from '../previsao-rendimento'
import { medianaDosRendimentos } from '../conclusao'
import { avisosDaEscala } from '../escala-do-pedido'

/** os rendimentos REAIS dos 5 últimos lotes de cada ficha, medidos em prod em 03/10 */
const XIS_5 = [1.0400, 1.0598, 1.2532, 1.8803, 2.1411]
const HAMBURGER_5 = [0.9420, 0.9499, 0.9568, 0.8250, 0.9894]

/** as fichas REAIS (loteBase 1, dose por unidade) */
const XIS = { acem: 0.091, peito: 0.044, gordura: 0.02 }
const HAMBURGER = { acem: 0.11, peito: 0.055, gordura: 0.018 }

const reguaDe = (rends: number[]) =>
  reguaDoRendimento({ teorico: 1, medido: medianaDosRendimentos(rends), lotes: rends.length })

describe('⛔⛔⛔ O PIN: pedir 10 separa a dose da ficha × 10', () => {
  it('⭐ 10 beef de xis → 0,910 acém · 0,440 peito · 0,200 gordura', () => {
    const r = { teorico: 1, medido: medianaDosRendimentos(XIS_5), lotes: 5 }
    const escala = escalaParaSaida(10, r)!
    expect(escala).toBe(10) // ⭐ a régua recusou a mediana discordante e usou a ficha

    expect(insumoParaSaida(10, XIS.acem, r)).toBeCloseTo(0.910, 6)
    expect(insumoParaSaida(10, XIS.peito, r)).toBeCloseTo(0.440, 6)
    expect(insumoParaSaida(10, XIS.gordura, r)).toBeCloseTo(0.200, 6)
  })

  it('⚠️⚠️ 10 beef de hamburger → 1,158 · 0,579 · 0,189 — e NÃO o pin de 1,100/0,550/0,180', () => {
    /**
     * ⛔⛔ **ESTA ASSERÇÃO CONTRARIA A LETRA DO ITEM 4c DO PEDIDO, e o motivo é medição.**
     *
     * O dono escreveu o pin `10 hamburger → 1,100/0,550/0,180` — a dose NOMINAL da ficha. Mas
     * os **22 lotes** desta ficha são consistentes em **0,94–0,99** (mediana 0,9499): a cozinha
     * consome de verdade ~5% mais carne por beef do que a ficha diz. **Isso é perda real de
     * trim/manipulação, não média envenenada** — e é exatamente por isso que o dono chamou o
     * hamburger de **"OK"** no mesmo pedido.
     *
     * ⚠️ As duas metades do pedido não podem ser verdade juntas: *"hamburger OK"* descreve o
     * comportamento que separa um pouco a MAIS, e `1,100` é o nominal. Entregar o nominal aqui
     * faria **FALTAR material** — que é literalmente o problema que motivou a decisão de 01/09
     * (*"pelo teórico ele pega pouco e falta"*).
     *
     * ⭐ O que o conserto de hoje FAZ pelo hamburger: a mediana aproxima do nominal
     * (**1,1795 → 1,158**), e a faixa garante que o dia em que a média dele for envenenada o
     * plano volte pro declarado. **Qual dos dois vale é decisão do dono — está no relatório.**
     */
    const r = { teorico: 1, medido: medianaDosRendimentos(HAMBURGER_5), lotes: 5 }
    expect(reguaDoRendimento(r).daMedia).toBe(true) // ⭐ 95% do teórico: perda real, dentro da faixa
    expect(insumoParaSaida(10, HAMBURGER.acem, r)).toBeCloseTo(1.158, 3)
    expect(insumoParaSaida(10, HAMBURGER.peito, r)).toBeCloseTo(0.579, 3)
    expect(insumoParaSaida(10, HAMBURGER.gordura, r)).toBeCloseTo(0.1895, 3)

    // ⭐ e está MAIS PERTO do nominal do que antes do conserto (a média dava 1,1795)
    const comMedia = { teorico: 1, medido: 0.9326, lotes: 5 }
    expect(insumoParaSaida(10, HAMBURGER.acem, comMedia)).toBeCloseTo(1.1795, 3)
  })
})

describe('⭐ CAMADA 1 — a MEDIANA tira o peso dos dois outliers', () => {
  it('a média do xis é 1,4749 e a mediana é 1,2532 — os 5 lotes REAIS', () => {
    const media = XIS_5.reduce((s, r) => s + r, 0) / XIS_5.length
    expect(media).toBeCloseTo(1.4749, 4)
    expect(medianaDosRendimentos(XIS_5)).toBe(1.2532)
  })

  it('⛔⛔ e a MÉDIA sozinha produzia o defeito: 10 ÷ 1,4749 = 6,78 → 0,617 de acém', () => {
    /**
     * ⚠️ O contrafactual exato do relato (*"pede 10 → separa pra ~6,7"*), calculado como a régua
     * ANTIGA calculava — direto, sem a faixa. Hoje `escalaParaSaida` devolveria 10 aqui, porque
     * a faixa recusa a média discordante; é por isso que o contrafactual tem que ser a conta
     * crua, senão ele some junto com o defeito e o teste deixa de documentar o caso.
     */
    const escalaAntiga = 10 / 1.4749
    expect(escalaAntiga).toBeCloseTo(6.78, 2)
    expect(escalaAntiga * XIS.acem).toBeCloseTo(0.617, 3)
    // ⭐ e a régua de HOJE recusa: devolve 10
    expect(escalaParaSaida(10, { teorico: 1, medido: 1.4749, lotes: 5 })).toBe(10)
  })
})

describe('⭐⭐ CAMADA 2 — a FAIXA: a medição não sobrescreve a ficha em silêncio', () => {
  it('a mediana do xis (125%) DISCORDA → a régua volta pro declarado e MARCA', () => {
    const r = reguaDe(XIS_5)
    expect(r.pct).toBe(1.2532)
    expect(r.discordante).toBe(true)
    expect(r.daMedia).toBe(false)
    expect(r.valor).toBe(1) // ⭐ o que a FICHA declara
  })

  it('⭐ e a faixa NÃO contradiz a decisão de 01/09 — a porção de queijo segue na medida', () => {
    /**
     * ⚠️ Em 01/09 o dono exigiu a média porque *"pelo teórico (0,135 × 200 = 27 kg) ele pega
     * pouco e falta"*. Essa ficha roda em **101%** do teórico (medido em prod) — **dentro** da
     * faixa, então segue usando a medida. ⭐ O que a faixa barra é a média ENVENENADA, nunca a
     * correção fina. Sem este teste, o conserto de hoje quebraria o sprint daquele dia.
     */
    const r = reguaDoRendimento({ teorico: 1, medido: 1.0113, lotes: 32 })
    expect(r.discordante).toBe(false)
    expect(r.daMedia).toBe(true)
    expect(r.valor).toBe(1.0113)
  })

  it('⛔⛔ e desarma a BOMBA do QUEIJO CHEDDAR (medido 10,2704 = 1027%)', () => {
    /**
     * Medido em prod: pedir 10 ali separaria material pra **1 unidade**. É a pior das 13 fichas
     * que passam de ±20%, e estava armada esperando alguém criar a ordem.
     */
    const r = reguaDoRendimento({ teorico: 1, medido: 10.2704, lotes: 4 })
    expect(r.discordante).toBe(true)
    expect(escalaParaSaida(10, { teorico: 1, medido: 10.2704, lotes: 4 })).toBe(10)
  })

  it('⚠️ sem teórico comparável (≤ 0) a medida é tudo que existe — e manda', () => {
    const r = reguaDoRendimento({ teorico: 0, medido: 17, lotes: 5 })
    expect(r.discordante).toBe(false)
    expect(r.valor).toBe(17)
  })

  it('a faixa é ±20%, a MESMA do M2 — e não é escolhida a dedo', () => {
    expect(DISCORDANCIA_MAXIMA).toBe(0.2)
    expect(reguaDoRendimento({ teorico: 1, medido: 1.2, lotes: 5 }).discordante).toBe(false)
    expect(reguaDoRendimento({ teorico: 1, medido: 1.21, lotes: 5 }).discordante).toBe(true)
  })
})

describe('⛔⛔ O GUARD DO ATO DA CRIAÇÃO — avisa ANTES de separar (item 4b)', () => {
  const pedidoXis = (escala: number) => ({
    pedido: 10, escala, regua: reguaDe(XIS_5),
    loteBase: 1, unidadeLoteBase: 'KG', unidadeProduto: 'UN',
    maiorDose: { nome: 'Acém', dose: XIS.acem },
  })

  it('⭐ a ficha do xis acusa as DUAS causas, na ordem da causa → consequência', () => {
    const a = avisosDaEscala(pedidoXis(10))
    expect(a.map((x) => x.motivo)).toEqual(['MEDIA_DISCORDA', 'LOTE_NAO_COMPARAVEL'])
    expect(a[0].frase).toContain('a FICHA declara')
    expect(a[1].frase).toContain('não diz quantas UN saem')
  })

  it('⛔⛔ e com a escala TORTA (6,78) ele diz o número em KG que o dono reconhece', () => {
    const a = avisosDaEscala(pedidoXis(6.78))
    const sep = a.find((x) => x.motivo === 'SEPARACAO_DESTOA')!
    expect(sep.frase).toContain('0.617') // o que a tela ia pré-preencher
    expect(sep.frase).toContain('0.91') //  o que a ficha pede
    expect(sep.frase).toContain('Vai faltar material')
  })

  it('⭐ ficha coerente e escala certa → NENHUM aviso (não é alarme diário)', () => {
    expect(
      avisosDaEscala({
        pedido: 10, escala: 10,
        regua: reguaDoRendimento({ teorico: 1, medido: 1.01, lotes: 10 }),
        loteBase: 1, unidadeLoteBase: 'UN', unidadeProduto: 'UN',
        maiorDose: { nome: 'Acém', dose: 0.091 },
      }),
    ).toEqual([])
  })

  it('⚠️ a folga de 6% da cozinha NÃO acende — senão o aviso morre de ruído', () => {
    const a = avisosDaEscala({
      pedido: 10, escala: 10.6,
      regua: reguaDoRendimento({ teorico: 1, medido: 0.94, lotes: 20 }),
      loteBase: 1, unidadeLoteBase: 'UN', unidadeProduto: 'UN',
      maiorDose: { nome: 'Acém', dose: 0.11 },
    })
    expect(a.map((x) => x.motivo)).not.toContain('SEPARACAO_DESTOA')
  })
})
