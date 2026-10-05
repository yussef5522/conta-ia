/**
 * ⭐⭐⭐ O PEDIDO NA TELA + A PÍLULA "% DO PEDIDO" (05/10/2026).
 *
 * **Ordem do dono (visual v4):** *"pedido SEMPRE redondo na exibição: 84,8608 → «85» (round
 * normal; só exibição). (…) A pílula volta com SOBRENOME: «N% do pedido» = fez ÷ pedido,
 * escrito por extenso dentro da pílula. Verde 90-110 · âmbar fora · vermelho ⚠ <70 ou >130."*
 */
import { describe, it, expect } from 'vitest'
import { pedidoNaTela, fmtPedido, pilulaDoPedido } from '../pedido-na-tela'

describe('⭐⭐ o arredondamento é GATEADO pela unidade', () => {
  it('⭐ em UN (contagem de peça) o pedido vira inteiro — o caso que o dono viu', () => {
    expect(pedidoNaTela(84.8608, 'UN')).toBe(85)
    expect(fmtPedido(84.8608, 'UN')).toBe('85')
    expect(fmtPedido(300.2074, 'UN')).toBe('300')
    expect(fmtPedido(45.91, 'UN')).toBe('46')
  })

  /**
   * ⛔⛔ **EM KG/LT A FRAÇÃO É O DADO.** O lote da maionese é `2,858 KG` e a dose do fermento
   * `0,0003 KG`: arredondar ali mentiria sobre o que foi pedido — é a mesma régua que fez o
   * campo de quantidade aceitar 6 casas em 29/08.
   */
  it('⛔⛔ em KG/LT nada é arredondado', () => {
    expect(pedidoNaTela(2.858, 'KG')).toBe(2.858)
    expect(fmtPedido(2.858, 'KG')).toBe('2,858')
    expect(fmtPedido(0.0003, 'KG')).toBe('0,0003')
    expect(fmtPedido(12.5, 'LT')).toBe('12,5')
  })

  /**
   * ⚠️ Quem decide *"esta unidade é de contagem?"* é o `aceitaFracao` da casa (lista FECHADA de
   * inteiras). Unidade imprevista (BANDEJA, FARDO) cai no lado que **aceita fração** — o erro
   * seguro, o mesmo default de 08/09.
   */
  it('⭐ a régua da unidade é a da casa: PC/CX arredondam, unidade nova não', () => {
    expect(fmtPedido(3.4, 'PC')).toBe('3')
    expect(fmtPedido(3.4, 'CX')).toBe('3')
    expect(fmtPedido(3.4, 'BANDEJA'), 'unidade que ninguém previu não é travada no inteiro').toBe('3,4')
  })

  it('⭐ round NORMAL (meio pra cima), como o dono pediu', () => {
    expect(pedidoNaTela(84.5, 'UN')).toBe(85)
    expect(pedidoNaTela(84.4999, 'UN')).toBe(84)
  })

  /** ⛔ ausência não é zero: sem pedido, não há número — e a tela mostra outra coisa */
  it('⛔ sem pedido devolve null, nunca 0', () => {
    expect(pedidoNaTela(null, 'UN')).toBeNull()
    expect(pedidoNaTela(undefined, 'UN')).toBeNull()
    expect(fmtPedido(null, 'UN')).toBeNull()
    expect(pedidoNaTela(Number.NaN, 'UN'), 'NaN na tela é pior que silêncio').toBeNull()
  })
})

describe('⭐⭐ a pílula "% do pedido" — a régua do dono', () => {
  it('⭐ 90 a 110 é VERDE', () => {
    for (const fez of [90, 100, 110]) {
      const p = pilulaDoPedido(fez, 100, 'UN')!
      expect(p.tom, `${fez}%`).toBe('verde')
      expect(p.alarme).toBe(false)
    }
  })

  it('⭐ fora de 90-110 e dentro de 70-130 é ÂMBAR', () => {
    for (const fez of [70, 89, 111, 130]) {
      const p = pilulaDoPedido(fez, 100, 'UN')!
      expect(p.tom, `${fez}%`).toBe('ambar')
      expect(p.alarme, `${fez}% não é alarme`).toBe(false)
    }
  })

  it('⛔ abaixo de 70 ou acima de 130 é VERMELHO com alarme', () => {
    for (const fez of [69, 50, 131, 333]) {
      const p = pilulaDoPedido(fez, 100, 'UN')!
      expect(p.tom, `${fez}%`).toBe('vermelho')
      expect(p.alarme).toBe(true)
    }
  })

  /** ⭐ o SOBRENOME por extenso DENTRO da pílula — "103%" sozinho não diz percentual de quê */
  it('⭐⭐ o texto carrega o sobrenome', () => {
    expect(pilulaDoPedido(103, 100, 'UN')!.texto).toBe('103% do pedido')
    expect(pilulaDoPedido(148, 120, 'UN')!.texto).toBe('123% do pedido')
  })

  /** ⛔ sem pedido não há pílula (dividir por nada é inventar régua) */
  it('⛔ sem pedido, sem pílula', () => {
    expect(pilulaDoPedido(148, null, 'UN')).toBeNull()
    expect(pilulaDoPedido(148, 0, 'UN')).toBeNull()
    expect(pilulaDoPedido(148, undefined, 'UN')).toBeNull()
  })

  /**
   * ⭐⭐ **O DENOMINADOR É O PEDIDO EXIBIDO — e este é o caso que explica por quê.** Com o cru,
   * a tela diria *"pedido 2 · fez 2 · 83% do pedido"*: três números na mesma linha contando
   * histórias diferentes, e o dono leria como defeito. *Uma régua, um número.*
   */
  it('⭐⭐ a pílula fecha com os números que estão na tela', () => {
    expect(pedidoNaTela(2.4, 'UN')).toBe(2)
    expect(pilulaDoPedido(2, 2.4, 'UN')!.pct, 'o que a tela mostra é "pedido 2 · fez 2"').toBe(100)
    // e no caso real do dono, os dois caminhos dão o mesmo
    expect(pilulaDoPedido(85, 84.8608, 'UN')!.pct).toBe(100)
  })

  /** ⚠️ em KG o denominador é o valor CHEIO (não há arredondamento pra alinhar) */
  it('⭐ em KG a pílula usa o valor cheio', () => {
    expect(pilulaDoPedido(2.858, 2.858, 'KG')!.pct).toBe(100)
    expect(pilulaDoPedido(1.429, 2.858, 'KG')!.pct).toBe(50)
  })

  /**
   * ⛔⛔ **ELA NÃO É A RÉGUA DA FICHA (o P8).** Os dois casos reais de prod provam que as duas
   * perguntas divergem: o `beef de xis` fez 92 de um pedido de 67,8 → **135% do pedido** (a
   * pílula acende âmbar/vermelho), enquanto o fiscal e o P8 falam do MATERIAL e da FICHA, com
   * degraus próprios. Confundir as duas foi o que aposentou a pílula antiga em 04/10.
   */
  it('⛔⛔ os números reais de prod, na régua desta pílula', () => {
    /** ⚠️ **135%, não 136%** — e a diferença é a regra funcionando: o denominador é o pedido
     *  EXIBIDO (67,8 → 68), então a pílula fecha com o que o olho lê na linha. Com o cru daria
     *  136% ao lado de "pedido 68 · fez 92", e aí os três números discordariam. */
    expect(pilulaDoPedido(92, 67.8, 'UN')!.texto).toBe('135% do pedido')
    expect(pilulaDoPedido(92, 67.8, 'UN')!.tom).toBe('vermelho')
    expect(pilulaDoPedido(153, 45.91, 'UN')!.texto, 'o frango frito de 333%').toBe('333% do pedido')
    expect(pilulaDoPedido(384, 380, 'UN')!.tom, 'a massa de pizza: 101%').toBe('verde')
    expect(pilulaDoPedido(76, 67.95, 'UN')!.tom, 'o coxão: 112% — fora do verde, sem alarme').toBe('ambar')
  })
})
