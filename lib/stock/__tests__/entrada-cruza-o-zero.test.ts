/**
 * ⭐⭐⭐ A ENTRADA QUE CRUZA O ZERO — a régua, com os números REAIS de prod (23/09/2026).
 *
 * O caso que a motivou: a nota do ALAN com SAL parada porque o `sal` está em **−0,9 KG** com
 * **R$ −0,22** pendurados, e o guard da baixa (que existe pra outra pergunta) barrava a
 * entrada que ia consertar exatamente isso.
 */
import { describe, it, expect } from 'vitest'
import { avaliarEntrada, ehEntradaQueConserta, frasePergunta } from '../entrada-cruza-o-zero'

describe('⭐⭐ cruzar o zero começa vida nova', () => {
  it('⭐ resíduo dentro do teto → ABSORVE e registra', () => {
    // item em −10 com 3 centavos pendurados; teto = max(0,05; 10×0,005) = 0,05
    const v = avaliarEntrada({ saldoAntes: -10, valorAntes: -0.03, qtdDaEntrada: 30, valorDaEntrada: 0 })
    expect(v.cruzaOZero).toBe(true)
    expect(v.decisao).toBe('AJUSTA_RESIDUO')
    expect(v.saldoDepois).toBe(20)
  })

  it('⛔⛔ acima do teto PERGUNTA — nunca recusa cega (o caso do SAL)', () => {
    const v = avaliarEntrada({ saldoAntes: -0.9, valorAntes: -0.22, qtdDaEntrada: 2.9, valorDaEntrada: 0 })
    expect(v.decisao, 'o sal passaria calado — 22 centavos não são arredondamento').toBe('PERGUNTA')
    expect(v.saldoDepois).toBe(2)
    expect(v.residuo).toBe(-0.22)
    // ⭐ e a frase carrega A CONTA, que é o que a torna respondível
    const f = frasePergunta(v, 'sal', 'KG')
    expect(f).toContain('R$ 0,22')
    expect(f).toContain('2 KG')
    expect(f, 'a nota não pode ser reescrita — e a frase diz isso').toContain('a nota entra pelo valor dela')
  })

  it('⭐ a entrada que traz dinheiro suficiente não tem o que perguntar', () => {
    const v = avaliarEntrada({ saldoAntes: -0.9, valorAntes: -0.22, qtdDaEntrada: 2.9, valorDaEntrada: 15 })
    expect(v.decisao).toBe('OK')
    expect(v.valorDepois).toBe(14.78)
  })

  it('⛔⛔ NÃO cruzou o zero → RECUSA (o caso do FERMENTO, 16/09)', () => {
    /**
     * ⚠️ Saldo já POSITIVO com valor negativo é a compra que falta num item que **continua
     * na prateleira** — absorver ali esconderia o buraco. A régua irmã (`avaliarResiduo`)
     * diz a mesma coisa do outro lado: só zera valor quando a quantidade vai a ZERO.
     */
    const v = avaliarEntrada({ saldoAntes: 5, valorAntes: -31.04, qtdDaEntrada: 5, valorDaEntrada: 0 })
    expect(v.cruzaOZero).toBe(false)
    expect(v.decisao).toBe('RECUSA')
  })

  it('⛔ e a entrada que NÃO alcança o zero também não limpa nada', () => {
    const v = avaliarEntrada({ saldoAntes: -45.48, valorAntes: -3.26, qtdDaEntrada: 10, valorDaEntrada: 0 })
    expect(v.saldoDepois).toBe(-35.48)
    expect(v.cruzaOZero).toBe(false)
    expect(v.decisao).toBe('RECUSA')
  })

  it('⭐ o teto é PROPORCIONAL ao que saiu sem lastro, com piso', () => {
    // 2.000 unidades a descoberto: meio centavo cada = R$ 10 de folga
    expect(avaliarEntrada({ saldoAntes: -2000, valorAntes: -9, qtdDaEntrada: 2100, valorDaEntrada: 0 }).decisao)
      .toBe('AJUSTA_RESIDUO')
    // e a MESMA folga num item de 2 unidades seria absurda
    expect(avaliarEntrada({ saldoAntes: -2, valorAntes: -9, qtdDaEntrada: 5, valorDaEntrada: 0 }).decisao)
      .toBe('PERGUNTA')
  })
})

describe('⛔⛔⛔ a FRONTEIRA — só a ENTRADA conserta, a contagem não', () => {
  it('⭐ os tipos que representam "a coisa que faltava chegou"', () => {
    expect(ehEntradaQueConserta('ENTRADA_NF')).toBe(true)
    expect(ehEntradaQueConserta('ENTRADA_MANUAL')).toBe(true)
    // ⭐ a produção lançada é literalmente a porta que a recusa do intermediário oferece
    expect(ehEntradaQueConserta('PRODUCAO_GERACAO')).toBe(true)
    expect(ehEntradaQueConserta('DEVOLUCAO_PRODUCAO')).toBe(true)
  })

  it('⛔⛔ AJUSTE_CONTAGEM fica FORA — contar por cima enterra o lote que ninguém lançou', () => {
    /**
     * ⚠️⚠️ ESTA LINHA VEIO DE UM TESTE VERMELHO, não de um raciocínio meu. A 1ª versão
     * valia pra qualquer movimento que cruzasse o zero e **engoliu a porta do negativo**
     * (22/09): a contagem passou a perguntar sobre centavos em vez de dizer *"vendeu sem
     * ter produção registrada"*. A régua do dono é "a ENTRADA é o conserto".
     */
    expect(ehEntradaQueConserta('AJUSTE_CONTAGEM')).toBe(false)
    expect(ehEntradaQueConserta('BAIXA_VENDA')).toBe(false)
    expect(ehEntradaQueConserta('PERDA')).toBe(false)
  })
})
