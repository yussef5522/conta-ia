/**
 * ⭐⭐⭐ A LEI DO CUSTO MÉDIO, PURA (13/10/2026) — *"ele tem q fica com preco q tava antes de
 * zero estoque e manter esse preco ate se estoque fica negativo"*.
 *
 * ⚠️ Aqui mora a régua; o encaixe dela (o ledger de verdade) está no `.integration`. Os dois
 * existem porque *"guard que testa a função pura não prova o encaixe dela"* — e nesta casa já
 * aconteceu o contrário também: guard que testa a lib aprova a tela que a ignora.
 */
import { describe, it, expect } from 'vitest'
import { custoMedioComMemoria, memoriaDaEntrada, memoriaPelaHistoria } from '../custo-vigente'
import { TIPO_AJUSTE_RESIDUO } from '../entrada-cruza-o-zero'

describe('⭐ custoMedioComMemoria — a lei', () => {
  it('saldo > 0: valor ÷ saldo, IGUAL a hoje, ao centavo (zero regressão)', () => {
    expect(custoMedioComMemoria(822, 3450.92, null)).toBe(4.2)
    expect(custoMedioComMemoria(8029, 22038.48, null)).toBe(2.74)
    // ⭐ e a memória NÃO manda quando há saldo — o derivado é mais fresco
    expect(custoMedioComMemoria(10, 54, 999)).toBe(5.4)
  })

  it('⭐⭐ saldo ZERO: o custo CONTINUA o último conhecido (o caso da massa de pizza)', () => {
    expect(custoMedioComMemoria(0, 0, 0.54)).toBe(0.54)
  })

  it('⭐⭐ saldo NEGATIVO: o custo continua — "uma coisa não tem nada a ver com a outra"', () => {
    expect(custoMedioComMemoria(-2.97, -31.04, 34)).toBe(34)
  })

  it('⛔ nunca teve entrada com valor: "a definir" — número inventado NUNCA', () => {
    expect(custoMedioComMemoria(0, 0, null)).toBeNull()
    expect(custoMedioComMemoria(-5, 0, null)).toBeNull()
  })

  it('⛔ memória ≤ 0 é AUSÊNCIA, não custo (o resquício do estado impossível não se propaga)', () => {
    // o caso FANTA UVA: custo médio virou −R$ 2.540,13 e contaminou Posição/cardápio/CMV
    expect(custoMedioComMemoria(0, 0, -2540.13)).toBeNull()
    expect(custoMedioComMemoria(0, 0, 0)).toBeNull()
  })
})

describe('⭐⭐ memoriaDaEntrada — o que a entrada ensina', () => {
  const base = { tipo: 'ENTRADA_NF', quantidade: 10, custoTotal: 340, saldoAntes: 0, valorAntes: 0 }

  it('⭐ saldo antes ≤ 0: REINICIA no custo da entrada (padrão de mercado)', () => {
    expect(memoriaDaEntrada(base)).toBe(34)
    // ⛔⛔ o caso FERMENTO: a média ponderada daria 309 ÷ 5 = R$ 61,80/kg — o resíduo de
    //     dinheiro negativo contaminando o PREÇO DE COMPRA. A nota diz 34.
    expect(memoriaDaEntrada({ ...base, saldoAntes: -5, valorAntes: -31 })).toBe(34)
  })

  it('⭐ saldo antes > 0: média ponderada normal, como hoje', () => {
    // 10 KG a 5,00 + 10 KG a 9,00 = 20 KG a 7,00 (o caso do teste da entrada manual)
    expect(memoriaDaEntrada({ ...base, quantidade: 10, custoTotal: 90, saldoAntes: 10, valorAntes: 50 })).toBe(7)
  })

  it('⛔⛔ o AJUSTE_RESIDUO não ensina NADA — ele envenenaria a memória', () => {
    // ele grava 0,001 de quantidade com o unitário DERIVADO do total: R$ 89.580/kg
    expect(memoriaDaEntrada({ tipo: TIPO_AJUSTE_RESIDUO, quantidade: 0.001, custoTotal: 89.58, saldoAntes: 0, valorAntes: 0 })).toBeNull()
  })

  it('⛔ só tipo com custo DEFENSÁVEL ensina (a baixa carrega o médio do instante, não o pago)', () => {
    expect(memoriaDaEntrada({ ...base, tipo: 'BAIXA_VENDA', quantidade: 10, custoTotal: 340 })).toBeNull()
    expect(memoriaDaEntrada({ ...base, tipo: 'AJUSTE_CONTAGEM' })).toBeNull()
    expect(memoriaDaEntrada({ ...base, tipo: 'ESTORNO' })).toBeNull()
    // ⭐ e os 4 que ensinam, ensinam
    for (const t of ['ENTRADA_NF', 'ENTRADA_MANUAL', 'PRODUCAO_GERACAO', 'DEVOLUCAO_PRODUCAO']) {
      expect(memoriaDaEntrada({ ...base, tipo: t }), t).toBe(34)
    }
  })

  it('⚠️ bonificação (custo 0) não ensina preço — chegou de graça ≠ vale zero', () => {
    expect(memoriaDaEntrada({ ...base, custoTotal: 0 })).toBeNull()
  })

  it('⛔ saída não ensina (quantidade negativa)', () => {
    expect(memoriaDaEntrada({ ...base, quantidade: -10, custoTotal: 340 })).toBeNull()
  })
})

describe('⭐⭐⭐ memoriaPelaHistoria — o replay, que é o backfill E o juiz', () => {
  it('⭐ o caso da MASSA: produziu, consumiu tudo, saldo 0 → a memória é o último médio', () => {
    const memoria = memoriaPelaHistoria([
      { tipo: 'PRODUCAO_GERACAO', quantidade: 400, custoTotal: 216 }, // 0,54/un
      { tipo: 'SEPARACAO_SAIDA', quantidade: -400, custoTotal: -216 },
    ])
    expect(memoria).toBe(0.54)
  })

  it('⭐ média ponderada no meio da história e o ÚLTIMO estado manda', () => {
    expect(memoriaPelaHistoria([
      { tipo: 'ENTRADA_NF', quantidade: 1, custoTotal: 10 },
      { tipo: 'ENTRADA_NF', quantidade: 1, custoTotal: 20 },
      { tipo: 'BAIXA_VENDA', quantidade: -2, custoTotal: -30 },
    ]), 'a memória é a MÉDIA (15), nunca a última compra (20)').toBe(15)
  })

  it('⛔ item que nunca teve valor: null (o "a definir" honesto)', () => {
    expect(memoriaPelaHistoria([
      { tipo: 'AJUSTE_CONTAGEM', quantidade: 5, custoTotal: 0 },
      { tipo: 'BAIXA_VENDA', quantidade: -5, custoTotal: 0 },
    ])).toBeNull()
    expect(memoriaPelaHistoria([])).toBeNull()
  })

  it('⭐ entrada que chega com o saldo no chão ensina o PREÇO DELA (a mesma lei do writer)', () => {
    expect(memoriaPelaHistoria([
      { tipo: 'BAIXA_VENDA', quantidade: -20, custoTotal: -40 },
      { tipo: 'ENTRADA_NF', quantidade: 10, custoTotal: 340 }, // saldo ainda −10
    ])).toBe(34)
  })

  it('⚠️ o replay é a MESMA lei do writer — nenhuma segunda régua', () => {
    // se divergissem, o juiz E17 compararia o campo contra uma opinião diferente
    const movs = [
      { tipo: 'ENTRADA_NF', quantidade: 10, custoTotal: 50 },
      { tipo: 'ENTRADA_NF', quantidade: 10, custoTotal: 90 },
    ]
    const pelaHistoria = memoriaPelaHistoria(movs)
    const pelaEntrada = memoriaDaEntrada({ ...movs[1], saldoAntes: 10, valorAntes: 50 })
    expect(pelaHistoria).toBe(pelaEntrada)
  })
})
