// ⭐⭐⭐ O CUSTO DA BAIXA — o red-then-green do caso REAL de 17/10 (19/10/2026).
//
// **O caso, medido em prod antes de uma linha de código:** a baixa dos complementos de 17/10
// foi barrada pelo guarda do estado impossível na `porçao calabresa ralada 50 grama` —
// 49 UN, valor R$ 39,57, baixa calculada R$ 39,69 → **final 0 UN / −R$ 0,12**.
//
// ⛔ Os números deste arquivo são os do banco, não inventados: `saldo 49 · valor 39,57 ·
// custo médio arredondado 0,81`. O contrafactual (a aritmética antiga) reproduz os
// **−R$ 0,12** ao centavo.

import { describe, it, expect } from 'vitest'
import { custoDaBaixa, valorPrevistoDaBaixa, type EstadoDaBaixa } from '../custo-da-baixa'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** o estado REAL da calabresa ralada em 19/10, lido de prod */
const CALABRESA = 'item-calabresa-ralada'
const estadoReal = (): EstadoDaBaixa => ({
  porItem: new Map([[CALABRESA, { saldo: 49, valor: 39.57, custoMedio: 0.81 }]]),
  vigentes: new Map([[CALABRESA, 0.81]]),
})

describe('o custo da baixa — o caso real de 17/10', () => {
  it('⭐ zerar a quantidade zera o valor: 49 UN de R$ 39,57 baixam R$ 39,57', () => {
    const e = estadoReal()
    const r = custoDaBaixa(CALABRESA, 49, e)

    expect(round2(Math.abs(r.custoTotal))).toBe(39.57)
    // o valor que SOBRA depois da baixa — era isto que o guarda recusava
    expect(round2(39.57 - Math.abs(r.custoTotal))).toBe(0)
  })

  it('⛔ CONTRAFACTUAL — a aritmética antiga deixa os −R$ 0,12 que barraram a baixa', () => {
    // é literalmente o que `baixa-complemento.ts` fazia: custo de TELA × quantidade
    const custoDeTela = 0.81
    const totalAntigo = round2(49 * custoDeTela)
    expect(totalAntigo).toBe(39.69)
    expect(round2(39.57 - totalAntigo)).toBe(-0.12)
    // saldo 0 com valor negativo = o estado que `assertSaldoNaoFicaImpossivel` recusa
    expect(round2(49 - 49)).toBe(0)
  })

  it('⭐ o custo unitário vai em PRECISÃO CHEIA, não arredondado', () => {
    const r = custoDaBaixa(CALABRESA, 49, estadoReal())
    expect(r.custoUnitario).toBeCloseTo(39.57 / 49, 12)
    expect(r.custoUnitario).not.toBe(0.81)
  })

  it('⭐⭐ o PREVIEW mostra o MESMO número que o ledger grava', () => {
    const e = estadoReal()
    const gravado = Math.abs(custoDaBaixa(CALABRESA, 49, e).custoTotal)
    expect(valorPrevistoDaBaixa(CALABRESA, 49, e)).toBe(round2(gravado))
    // ⛔ e NÃO o número da aritmética antiga
    expect(valorPrevistoDaBaixa(CALABRESA, 49, e)).not.toBe(39.69)
  })

  it('⭐ baixa PARCIAL também sai pela precisão cheia (o resíduo não se acumula)', () => {
    const e = estadoReal()
    const a = custoDaBaixa(CALABRESA, 20, e)
    const b = custoDaBaixa(CALABRESA, 29, e)
    // as duas somadas não passam do valor do item (o que o arredondado fazia)
    expect(round2(Math.abs(a.custoTotal) + Math.abs(b.custoTotal))).toBeLessThanOrEqual(39.57)
  })
})

describe('as duas leis que vieram de graça com a porta única', () => {
  it('⭐ saldo ≤ 0 sai pelo CUSTO VIGENTE, nunca R$ 0,00 (a lei de 15/10)', () => {
    const e: EstadoDaBaixa = {
      porItem: new Map([['neg', { saldo: -8, valor: -16.24, custoMedio: 2.03 }]]),
      vigentes: new Map([['neg', 2.03]]),
    }
    const r = custoDaBaixa('neg', 10, e)
    expect(r.custoUnitario).toBe(2.03)
    expect(Math.abs(r.custoTotal)).toBeCloseTo(20.3, 2)
  })

  it('⛔ item que NUNCA teve entrada com valor sai a zero, e o preview diz "a definir"', () => {
    const e: EstadoDaBaixa = {
      porItem: new Map([['semcusto', { saldo: 5, valor: 0, custoMedio: null }]]),
      vigentes: new Map(),
    }
    expect(custoDaBaixa('semcusto', 2, e).custoTotal).toBe(0)
    // ⛔ a tela NÃO pode dizer R$ 0,00 — ausência de custo não é custo zero
    expect(valorPrevistoDaBaixa('semcusto', 2, e)).toBeNull()
  })

  it('⛔ item fora do estado (sem movimento nenhum) não inventa custo', () => {
    const e: EstadoDaBaixa = { porItem: new Map(), vigentes: new Map() }
    expect(custoDaBaixa('fantasma', 3, e).custoTotal).toBe(0)
    expect(valorPrevistoDaBaixa('fantasma', 3, e)).toBeNull()
  })
})

describe('o CHECK do ledger fecha por construção', () => {
  const fecha = (qtd: number, e: EstadoDaBaixa, itemId: string) => {
    const r = custoDaBaixa(itemId, qtd, e)
    // a MESMA régua do banco: abs(custoTotal − quantidade × custoUnitario) <= 0,01
    return Math.abs(r.custoTotal - (-qtd * r.custoUnitario)) <= 0.01
  }

  it('⭐ fecha no caso real', () => {
    expect(fecha(49, estadoReal(), CALABRESA)).toBe(true)
  })

  it('⭐ fecha numa baixa grande, onde o erro do arredondamento seria maior', () => {
    const e: EstadoDaBaixa = {
      porItem: new Map([['drift', { saldo: 2000, valor: 1108, custoMedio: 0.55 }]]),
      vigentes: new Map([['drift', 0.55]]),
    }
    expect(fecha(1999, e, 'drift')).toBe(true)
    expect(fecha(2000, e, 'drift')).toBe(true)
  })

  /**
   * ⭐⭐⭐ A TRAVA QUE SUBSTITUIU O RAMO MORTO (19/10/2026).
   *
   * A 1ª versão de `custoDaBaixa` tinha um ramo que ABSORVIA o resíduo quando a baixa zerava
   * o item (unitário derivado do total, pro CHECK do ledger fechar). A **REGRA 11 provou que
   * ele era inalcançável** — repondo o defeito, 0 vermelhos.
   *
   * ⭐ A razão é o ponto do arquivo: ***com precisão cheia o resíduo NÃO NASCE.*** Então o
   * que guarda a classe não é um paliativo — é esta varredura. Se alguém voltar a arredondar
   * o custo unitário (`round2(valor/saldo)`, o número de TELA), o resíduo volta a nascer e
   * **isto fica VERMELHO apontando a causa**, em vez de um ajuste silencioso tapar o estrago.
   */
  it('⭐⭐ VARREDURA — zerar a quantidade zera o valor, e o guarda nunca morde', () => {
    const casos: [number, number][] = [
      [49, 39.57],      // o caso real de 17/10
      [2000, 1108],     // baixa grande: o erro do round2 cresce com a quantidade
      [3, 10],          // dízima (3,333…)
      [1000, 555.555],  // valor com 3 casas no ledger
      [7, 0.07],        // item barato: centavo por unidade
      [1, 0.01],        // o menor caso possível
      [278.48, 695.07], // fracionada (KG)
      [22864, 248.56],  // o lote de grandeza (19/09)
    ]
    for (const [saldo, valor] of casos) {
      const e: EstadoDaBaixa = {
        porItem: new Map([['x', { saldo, valor, custoMedio: round2(valor / saldo) }]]),
        vigentes: new Map([['x', round2(valor / saldo)]]),
      }
      const r = custoDaBaixa('x', saldo, e)
      const valorDepois = round2(valor - Math.abs(r.custoTotal))

      // ⛔ o estado que o guarda `assertSaldoNaoFicaImpossivel` recusa: saldo 0 e valor < −0,01
      expect(valorDepois, `saldo ${saldo} / valor ${valor}: sobrou ${valorDepois}`).toBeGreaterThanOrEqual(-0.01)
      // ⭐ e o CHECK do ledger fecha sem ninguém derivar nada
      expect(Math.abs(r.custoTotal - (-saldo * r.custoUnitario))).toBeLessThanOrEqual(0.01)
    }
  })

  it('⛔ CONTRAFACTUAL — com o custo ARREDONDADO o resíduo nasce e o guarda barra', () => {
    // é a aritmética antiga, nos mesmos casos: `round2(valor/saldo)` é número de TELA
    const barrados = ([[49, 39.57], [1000, 555.555], [22864, 248.56]] as [number, number][])
      .map(([saldo, valor]) => round2(valor - round2(saldo * round2(valor / saldo))))
      .filter((sobra) => sobra < -0.01)
    expect(barrados.length).toBeGreaterThan(0)
    expect(barrados).toContain(-0.12) // ⭐ os −R$ 0,12 do dia 17/10, ao centavo
  })

  it('⭐ fecha com quantidade fracionada (grama/ml, 6 casas)', () => {
    const e: EstadoDaBaixa = {
      porItem: new Map([['kg', { saldo: 278.48, valor: 695.07, custoMedio: 2.5 }]]),
      vigentes: new Map([['kg', 2.5]]),
    }
    expect(fecha(2.22, e, 'kg')).toBe(true)
  })
})
