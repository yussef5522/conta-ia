/**
 * ⭐⭐ O PEDIDO DA ORDEM — duas fontes, a origem SEMPRE dita, e o ciclo fechado.
 *
 * ⚠️ O teste que mais importa é o do **DERIVADO marcado como derivado**: são **471 ordens** em
 * prod que nasceram antes deste campo, e dizer "pedido 80" seco nelas afirmaria que o dono
 * pediu 80 quando foi a ficha que calculou.
 */
import { describe, it, expect } from 'vitest'
import { pedidoDaOrdem, fraseDoCiclo } from '../pedido-da-ordem'

describe('⭐⭐ pedidoDaOrdem — o DECLARADO manda, o DERIVADO cobre, e a origem vai junto', () => {
  it('⭐ com meta registrada: DECLARADO, e é o número que o dono digitou', () => {
    const p = pedidoDaOrdem({ meta: 80, escala: 80, loteBase: 1 })
    expect(p).toMatchObject({ unidades: 80, origem: 'DECLARADO' })
    expect(p.comoSoube).toContain('você pediu')
  })

  it('⭐⭐ sem meta: DERIVADO da ficha pela PORTA, e a tela sabe que é derivado', () => {
    // é o estado das 471 ordens de prod hoje
    const p = pedidoDaOrdem({ meta: null, escala: 80, loteBase: 1 })
    expect(p).toMatchObject({ unidades: 80, origem: 'DERIVADO' })
    expect(p.comoSoube).toContain('calculado pela ficha')
  })

  it('⭐ a MAIONESE derivada: escala 3,4989 × lote 2,858 = 10 KG', () => {
    const p = pedidoDaOrdem({ meta: null, escala: 3.4989, loteBase: 2.858 })
    expect(p.unidades).toBeCloseTo(10, 3)
    expect(p.origem).toBe('DERIVADO')
  })

  /**
   * ⭐⭐⭐ O INVARIANTE QUE TORNA A TROCA SEGURA (medido ao escrever o item 2):
   *
   * a ordem nova grava `escalaReceitas = pedido ÷ loteBase` (a porta) **e** a meta = pedido.
   * Então `saidaEsperadaDaFicha(escala, loteBase) == meta` **por construção** — o DERIVADO e o
   * DECLARADO coincidem nas ordens novas. É por isso que ligar a meta não muda número nenhum
   * da eficiência: ela só dá NOME à fonte.
   */
  it('⭐⭐⭐ nas ordens NOVAS o derivado == o declarado, por construção', () => {
    for (const [pedido, loteBase] of [[80, 1], [10, 2.858], [137.5, 0.5], [1, 12]] as const) {
      const escala = Math.round((pedido / loteBase + 1e-9) * 1e4) / 1e4
      const comMeta = pedidoDaOrdem({ meta: pedido, escala, loteBase })
      const semMeta = pedidoDaOrdem({ meta: null, escala, loteBase })
      expect(comMeta.unidades).toBe(pedido)
      expect(semMeta.unidades, `pedido ${pedido} / lote ${loteBase}`).toBeCloseTo(pedido, 3)
      // ⭐ o que muda é só a ORIGEM — e é por isso que ela tem que aparecer
      expect(comMeta.origem).toBe('DECLARADO')
      expect(semMeta.origem).toBe('DERIVADO')
    }
  })

  it('⛔ sem meta e sem lote utilizável: `null`, NUNCA zero', () => {
    expect(pedidoDaOrdem({ meta: null, escala: 0, loteBase: 1 })).toMatchObject({ unidades: null, origem: null })
    expect(pedidoDaOrdem({ meta: null, escala: 10, loteBase: 0 })).toMatchObject({ unidades: null, origem: null })
    expect(pedidoDaOrdem({ meta: 0, escala: 0, loteBase: 0 }).unidades).toBeNull()
  })

  it('⛔ meta zerada ou negativa não vira DECLARADO (cai no derivado)', () => {
    expect(pedidoDaOrdem({ meta: 0, escala: 80, loteBase: 1 }).origem).toBe('DERIVADO')
    expect(pedidoDaOrdem({ meta: -5, escala: 80, loteBase: 1 }).origem).toBe('DERIVADO')
  })
})

describe('⭐⭐ fraseDoCiclo — a sentença que o dono pediu', () => {
  it('⭐ o ciclo inteiro: pedido · separado · produziu · %', () => {
    const f = fraseDoCiclo({ pedido: 80, unidadeProduto: 'UN', separadoReais: 412.3, produzido: 78 })
    expect(f).toContain('pedido 80 UN')
    expect(f).toContain('produziu 78')
    expect(f).toContain('98%')
    expect(f).toMatch(/separado\s*R\$/)
  })

  it('⛔⛔ o separado é DINHEIRO — somar KG com UN é o pecado de 13/09', () => {
    /**
     * ⚠️ Este teste existe porque **a 1ª versão somava QUANTIDADE**: `coxão 14,4 KG + caixa 80
     * UN + sal 0,16 KG` daria `94,56` — um número que não existe no mundo. O guard é o TIPO
     * (`separadoReais`), e a frase imprime moeda.
     */
    const f = fraseDoCiclo({ pedido: 80, unidadeProduto: 'UN', separadoReais: 94.56, produzido: 80 })
    expect(f).toMatch(/R\$\s*94,56/)
    // ⛔ e não aparece nenhuma unidade física colada no separado
    expect(f).not.toMatch(/separado [\d.,]+ (KG|UN|LT)/)
  })

  it('⚠️ ausência NÃO é zero: ordem sem separação/produção não imprime 0', () => {
    const f = fraseDoCiclo({ pedido: 80, unidadeProduto: 'UN' })
    expect(f).toBe('pedido 80 UN')
    expect(f).not.toContain('separado')
    expect(f).not.toContain('produziu')
    expect(f).not.toContain('0%')
  })

  it('⚠️ sem pedido, a frase DIZ "a apurar" — e não calcula % de nada', () => {
    const f = fraseDoCiclo({ pedido: null, unidadeProduto: 'UN', produzido: 78 })
    expect(f).toContain('pedido: a apurar')
    expect(f).toContain('produziu 78')
    expect(f).not.toContain('%')
  })

  it('⭐ produziu MAIS que o pedido mostra acima de 100% (não é erro, é ficha generosa)', () => {
    expect(fraseDoCiclo({ pedido: 80, unidadeProduto: 'UN', produzido: 108 })).toContain('135%')
  })
})
