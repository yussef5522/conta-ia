/**
 * ⭐⭐ O PEDIDO DA ORDEM — duas fontes, a origem SEMPRE dita, e o ciclo fechado.
 *
 * ⚠️ O teste que mais importa é o do **DERIVADO marcado como derivado**: são **471 ordens** em
 * prod que nasceram antes deste campo, e dizer "pedido 80" seco nelas afirmaria que o dono
 * pediu 80 quando foi a ficha que calculou.
 */
import { describe, it, expect } from 'vitest'
import { pedidoDaOrdem, fraseDoCiclo } from '../pedido-da-ordem'

/**
 * ⚠️ `estado` é OBRIGATÓRIO desde 11/10 — e isso é o ponto, não cerimônia: sem ele o
 * resolvedor não consegue distinguir *"a ordem ainda vai declarar"* (**AGUANDANDO**, que abre
 * na pergunta) de *"nasceu antes do campo e a ficha calculou"* (**DERIVADO**, as 471 de prod).
 * O tipo exigir o estado foi o que fez o `tsc` achar TODOS os chamadores (REGRA 4 de graça).
 *
 * ⛔ O default aqui é **CONCLUIDA** de propósito: é o estado da esmagadora maioria das ordens
 * antigas, que são justamente as que o DERIVADO existe pra cobrir.
 */
const ENCERRADA = 'CONCLUIDA'

describe('⭐⭐ pedidoDaOrdem — o DECLARADO manda, o DERIVADO cobre, e a origem vai junto', () => {
  it('⭐ com meta registrada: DECLARADO, e é o número que o dono digitou', () => {
    const p = pedidoDaOrdem({ meta: 80, escala: 80, loteBase: 1, estado: ENCERRADA })
    expect(p).toMatchObject({ unidades: 80, origem: 'DECLARADO' })
    /**
     * ⚠️ A FRASE MUDOU em 11/10 (*"você declarou esta quantidade nesta ordem"*), e o motivo é
     * o lugar: ela nasceu quando o pedido era digitado na CRIAÇÃO (*"você pediu"* fazia
     * sentido ali) e agora a declaração acontece NA ORDEM. O que o teste afirma segue o
     * mesmo: o DECLARADO diz, com palavras, que **o dono** é a fonte do número.
     */
    expect(p.comoSoube).toContain('você declarou')
  })

  it('⭐⭐ sem meta: DERIVADO da ficha pela PORTA, e a tela sabe que é derivado', () => {
    // é o estado das 471 ordens de prod hoje
    const p = pedidoDaOrdem({ meta: null, escala: 80, loteBase: 1, estado: ENCERRADA })
    expect(p).toMatchObject({ unidades: 80, origem: 'DERIVADO' })
    expect(p.comoSoube).toContain('calculado pela ficha')
  })

  it('⭐ a MAIONESE derivada: escala 3,4989 × lote 2,858 = 10 KG', () => {
    const p = pedidoDaOrdem({ meta: null, escala: 3.4989, loteBase: 2.858, estado: ENCERRADA })
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
      const comMeta = pedidoDaOrdem({ meta: pedido, escala, loteBase, estado: ENCERRADA })
      const semMeta = pedidoDaOrdem({ meta: null, escala, loteBase, estado: ENCERRADA })
      expect(comMeta.unidades).toBe(pedido)
      expect(semMeta.unidades, `pedido ${pedido} / lote ${loteBase}`).toBeCloseTo(pedido, 3)
      // ⭐ o que muda é só a ORIGEM — e é por isso que ela tem que aparecer
      expect(comMeta.origem).toBe('DECLARADO')
      expect(semMeta.origem).toBe('DERIVADO')
    }
  })

  it('⛔ sem meta e sem lote utilizável: `null`, NUNCA zero', () => {
    expect(pedidoDaOrdem({ meta: null, escala: 0, loteBase: 1, estado: ENCERRADA })).toMatchObject({ unidades: null, origem: null })
    expect(pedidoDaOrdem({ meta: null, escala: 10, loteBase: 0, estado: ENCERRADA })).toMatchObject({ unidades: null, origem: null })
    expect(pedidoDaOrdem({ meta: 0, escala: 0, loteBase: 0, estado: ENCERRADA }).unidades).toBeNull()
  })

  /**
   * ⭐⭐⭐ O ESTADO QUE MATOU O FANTASMA (11/10).
   *
   * ⚠️ A ordem NOVA nasce com `escalaReceitas = 1` (o DEFAULT do banco, porque a coluna é NOT
   * NULL com `CHECK > 0` — *"sem pedido" não é representável nela*). Se o DERIVADO mandasse
   * aqui, a tela imprimiria **"pedido 1 lote"** — um número que ninguém pediu, na tela em que
   * o dono ainda vai dizer quanto quer. O `AGUARDANDO` existe pra a ausência ter NOME.
   *
   * ⛔ E a ordem das regras importa: AGUARDANDO vem ANTES do DERIVADO.
   */
  it('⭐⭐⭐ PLANEJADA sem meta: AGUARDANDO — a ordem abre na pergunta, nunca em "pedido 1"', () => {
    const p = pedidoDaOrdem({ meta: null, escala: 1, loteBase: 1, estado: 'PLANEJADA' })
    expect(p).toMatchObject({ unidades: null, origem: 'AGUARDANDO' })
    expect(p.comoSoube).toContain('diga quantas unidades')
    // ⛔ o contrafactual: com a régua VELHA (derivado sempre) ela diria 1
    expect(p.unidades).not.toBe(1)
  })

  it('⭐ PLANEJADA COM meta já declarada: DECLARADO (a pergunta já foi respondida)', () => {
    const p = pedidoDaOrdem({ meta: 30, escala: 30, loteBase: 1, estado: 'PLANEJADA' })
    expect(p).toMatchObject({ unidades: 30, origem: 'DECLARADO' })
  })

  it('⛔ meta zerada ou negativa não vira DECLARADO (cai no derivado)', () => {
    expect(pedidoDaOrdem({ meta: 0, escala: 80, loteBase: 1, estado: ENCERRADA }).origem).toBe('DERIVADO')
    expect(pedidoDaOrdem({ meta: -5, escala: 80, loteBase: 1, estado: ENCERRADA }).origem).toBe('DERIVADO')
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
