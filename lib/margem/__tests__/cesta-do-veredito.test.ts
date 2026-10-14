/**
 * ⭐⭐⭐ A CESTA / MODO COMBO — os vermelhos que o dono ditou (14/10/2026).
 *
 * *"1 item escolhido → o cartão fica EXATAMENTE como hoje — regressão travada em teste"* ·
 * *"toque liga/desliga; qtd mínima 1; Σ custo ao centavo"* · *"avulsos = Σ média×qtd"* ·
 * *"teto ponderado com caso de 3 itens de tetos 35/40/25 (conta exata = senão vermelho)"* ·
 * *"ideal > avulsos → dica 'não fecha' visível"* · *"preço ≥ avulsos → 'sem vantagem'"* ·
 * *"item sem ficha → combo inteiro 'a apurar' (número inventado NUNCA)"*.
 */
import { describe, it, expect } from 'vitest'
import {
  alternarNaCesta,
  estaNaCesta,
  montarCesta,
  mudarQtd,
  vantagemDoCombo,
  vereditoDaCesta,
} from '../cesta-do-veredito'
import type { ProdutoDoVeredito } from '../produto-do-veredito'
import {
  montarBlocoDoVeredito,
  reguaDaSecao,
  reguaPonderada,
  type CanalDoVeredito,
} from '../veredito-de-preco'

const CANAIS: CanalDoVeredito[] = [
  { canal: 'balcão', taxaPct: 0 },
  { canal: 'iFood', taxaPct: 0.2 },
]

function produto(p: {
  nome: string
  secao: string
  custo: number | null
  preco: number | null
  unidades?: number
}): ProdutoDoVeredito {
  return {
    chave: `ficha:${p.nome}`,
    nome: p.nome,
    apelidos: [p.nome.toUpperCase()],
    secao: p.secao,
    secaoSugerida: false,
    regua: reguaDaSecao(p.secao),
    custo: p.custo,
    custoParcial: p.custo ?? 0,
    componentesSemCusto: p.custo == null ? 1 : 0,
    preco: p.preco,
    precoOrigem: p.preco == null ? null : 'praticado',
    unidades: p.unidades ?? 100,
    temFicha: p.custo != null,
    href: `/x/${p.nome}`,
    porque: p.custo == null ? '1 componente da ficha sem custo' : null,
  }
}

/** o caso real do dono: o XIS - COMPLETO e a porção que ele quer vender junto */
const XIS = produto({ nome: 'XIS - COMPLETO', secao: 'XIS', custo: 25.42, preco: 95.9, unidades: 212 })
const FRITAS = produto({ nome: 'MINI FRITAS', secao: 'PORCOES', custo: 3.11, preco: 9.99, unidades: 399 })
const SEM_FICHA = produto({ nome: 'Combo Caçula', secao: 'LANCHES', custo: null, preco: 76.54 })
const SEM_VENDA = produto({ nome: 'ESPETINHO', secao: 'PORCOES', custo: 4.2, preco: null })

describe('os gestos da cesta', () => {
  it('⭐ o toque LIGA e DESLIGA, e o item entra com qtd 1', () => {
    let cesta = alternarNaCesta([], XIS.chave)
    expect(cesta).toEqual([{ chave: XIS.chave, qtd: 1 }])
    expect(estaNaCesta(cesta, XIS.chave)).toBe(true)

    cesta = alternarNaCesta(cesta, FRITAS.chave)
    expect(cesta.map((e) => e.chave)).toEqual([XIS.chave, FRITAS.chave])

    cesta = alternarNaCesta(cesta, XIS.chave)
    expect(cesta, 'tocar de novo TIRA').toEqual([{ chave: FRITAS.chave, qtd: 1 }])
    expect(estaNaCesta(cesta, XIS.chave)).toBe(false)
  })

  it('⛔ o −/+ nunca chega a ZERO — mínimo 1', () => {
    const cesta = [{ chave: XIS.chave, qtd: 1 }]
    expect(mudarQtd(cesta, XIS.chave, -1), 'zero não é quantidade, é a ausência do item').toEqual([
      { chave: XIS.chave, qtd: 1 },
    ])
    expect(mudarQtd(cesta, XIS.chave, +2)).toEqual([{ chave: XIS.chave, qtd: 3 }])
    expect(mudarQtd(mudarQtd(cesta, XIS.chave, +5), XIS.chave, -99)).toEqual([
      { chave: XIS.chave, qtd: 1 },
    ])
  })
})

describe('a soma da cesta', () => {
  it('⭐ Σ custo ao CENTAVO, com quantidade', () => {
    const c = montarCesta([XIS, FRITAS], [
      { chave: XIS.chave, qtd: 2 },
      { chave: FRITAS.chave, qtd: 3 },
    ])
    // 25,42 × 2 = 50,84 · 3,11 × 3 = 9,33
    expect(c.linhas[0].custoTotal).toBe(50.84)
    expect(c.linhas[1].custoTotal).toBe(9.33)
    expect(c.custoDoCombo, 'Σ ao centavo').toBe(60.17)
  })

  it('⭐ avulsos = Σ (média do PDV × qtd)', () => {
    const c = montarCesta([XIS, FRITAS], [
      { chave: XIS.chave, qtd: 1 },
      { chave: FRITAS.chave, qtd: 2 },
    ])
    // 95,90 + 9,99 × 2 = 115,88
    expect(c.avulsos).toBe(115.88)
  })

  it('⛔⛔ UM item sem ficha derruba o combo INTEIRO pra "a apurar" — nunca um número menor', () => {
    const c = montarCesta([XIS, SEM_FICHA], [
      { chave: XIS.chave, qtd: 1 },
      { chave: SEM_FICHA.chave, qtd: 1 },
    ])
    expect(c.custoDoCombo, 'somar só os que têm custo daria um número PLAUSÍVEL e errado').toBeNull()
    expect(c.itensSemFicha).toBe(1)
    expect(c.porque).toContain('sem ficha')

    const v = vereditoDaCesta({ produtos: [XIS, SEM_FICHA], escolhas: [
      { chave: XIS.chave, qtd: 1 },
      { chave: SEM_FICHA.chave, qtd: 1 },
    ], preco: null, alvoPct: null, canais: CANAIS })
    expect(v.bloco.farol.tom, 'farol NEUTRO').toBe('neutro')
    expect(v.bloco.canais.every((x) => x.preco == null), 'ideal "a apurar" em TODO canal').toBe(true)
    expect(v.frase, 'o convite, não um número').toContain('cria a ficha')
  })

  it('⛔ item sem venda no período → a linha dos avulsos vira "a apurar"', () => {
    const c = montarCesta([XIS, SEM_VENDA], [
      { chave: XIS.chave, qtd: 1 },
      { chave: SEM_VENDA.chave, qtd: 1 },
    ])
    expect(c.avulsos).toBeNull()
    expect(c.itensSemVenda).toBe(1)
    expect(c.custoDoCombo, 'e o CUSTO segue conhecido — são perguntas diferentes').toBe(29.62)
  })

  it('⭐ a qtd é saneada na entrada (mínimo 1, inteira)', () => {
    const c = montarCesta([XIS], [{ chave: XIS.chave, qtd: 0 }])
    expect(c.linhas[0].qtd).toBe(1)
  })
})

describe('o TETO PONDERADO pelo custo', () => {
  /**
   * ⛔⛔ O caso do dono: tetos **35/40/25** com pesos que fazem a média SIMPLES dar outro
   * número. *"xis pesa mais que a coca"* — se a ponderação cair, o teto vira **33** e o
   * cartão passa a cobrar um alvo que a cesta não tem.
   */
  it('⭐ 35/40/25 ponderados pelo custo dão 36 — a média simples daria 33', () => {
    const r = reguaPonderada([
      { tetoPct: 35, peso: 10 },
      { tetoPct: 40, peso: 5 },
      { tetoPct: 25, peso: 1 },
    ])
    // (35×10 + 40×5 + 25×1) ÷ 16 = 575 ÷ 16 = 35,9375 → 36
    expect(r.tetoPct).toBe(36)
    expect(Math.round((35 + 40 + 25) / 3), 'o contrafactual da média simples').toBe(33)
    expect(r.alvosPct, 'os alvos saem do MESMO alvosDe do mapa').toEqual([31, 36, 45])
    expect(r.porque).toContain('ponderada pelo custo')
  })

  it('⚠️ sem NENHUM custo pra ponderar, cai na média simples — e DIZ isso', () => {
    const r = reguaPonderada([
      { tetoPct: 35, peso: null },
      { tetoPct: 40, peso: null },
      { tetoPct: 25, peso: null },
    ])
    expect(r.tetoPct).toBe(33)
    expect(r.porque).toContain('nenhum item da cesta tem custo')
  })

  /**
   * ⛔⛔ O ENCAIXE, e ele precisa de teste PRÓPRIO: a REGRA 11 pegou que trocar o peso por
   * `null` dentro do `montarCesta` deixava os testes acima **VERDES** — eles chamavam
   * `reguaPonderada` direto. *Guard que testa a função não prova o encaixe de quem a chama*
   * (a cicatriz da mediana no encaixe, 03/10).
   *
   * Cesta REAL: XIS (teto 35, custo 25,42) + MINI FRITAS (teto 40, custo 3,11).
   * ponderado = (35×25,42 + 40×3,11) ÷ 28,53 = 35,54 → **36**
   * simples   = (35 + 40) ÷ 2 = 37,5 → **38**  ← o que a cesta diria sem a ponderação
   */
  it('⛔⛔ a CESTA pondera pelo custo de verdade — o xis pesa mais que a porção', () => {
    const c = montarCesta([XIS, FRITAS], [
      { chave: XIS.chave, qtd: 1 },
      { chave: FRITAS.chave, qtd: 1 },
    ])
    expect(c.regua.tetoPct, 'ponderado pelo custo').toBe(36)
    expect(Math.round((35 + 40) / 2), 'o contrafactual da média simples').toBe(38)
    expect(c.regua.porque).toContain('ponderada pelo custo')
  })

  it('⭐ cesta de um teto só não inventa média', () => {
    const r = reguaPonderada([
      { tetoPct: 35, peso: 10 },
      { tetoPct: 35, peso: 1 },
    ])
    expect(r.tetoPct).toBe(35)
    expect(r.porque).toContain('todos os itens')
  })
})

describe('a LINHA DA VANTAGEM', () => {
  it('⭐ preço MENOR que os avulsos → verde, com R$ e % em pt-BR', () => {
    const v = vantagemDoCombo(99.9, 115.88)
    expect(v.tom).toBe('verde')
    expect(v.valor).toBe(15.98)
    expect(v.frase).toContain('vantagem pro cliente')
    expect(v.frase).toContain('R$ 15,98')
    expect(v.frase, 'o % é pctBR — vírgula, nunca ponto').toMatch(/13,8%/)
  })

  it('⛔⛔ preço IGUAL ou MAIOR que os avulsos → CORAL "combo SEM vantagem — ninguém leva"', () => {
    expect(vantagemDoCombo(115.88, 115.88).tom, 'igual já não é promoção').toBe('coral')
    expect(vantagemDoCombo(120, 115.88).tom).toBe('coral')
    expect(vantagemDoCombo(120, 115.88).frase).toBe('combo SEM vantagem — ninguém leva')
  })

  it('⚠️ sem preço digitado ou sem avulsos a linha NÃO aparece — nunca inventa vantagem', () => {
    expect(vantagemDoCombo(null, 115.88).frase).toBeNull()
    expect(vantagemDoCombo(99.9, null).frase).toBeNull()
    expect(vantagemDoCombo(0, 115.88).frase).toBeNull()
  })
})

describe('a frase do especialista do combo', () => {
  it('⛔⛔ ideal > avulsos → "não fecha", e o problema é o preço AVULSO de um item', () => {
    /**
     * Cesta cara com avulsos baixos: o alvo pedido exige mais do que a soma dos preços de
     * balcão — ou seja, algum item está vendido abaixo do que deveria.
     */
    const caro = produto({ nome: 'PRATO CARO', secao: 'PRATOS', custo: 40, preco: 45 })
    const v = vereditoDaCesta({
      produtos: [caro],
      escolhas: [{ chave: caro.chave, qtd: 1 }],
      preco: 45,
      alvoPct: 30,
      canais: CANAIS,
    })
    // ideal no alvo 30% ≈ 133,90 contra avulsos de 45,00
    expect(v.bloco.canais[0].preco!).toBeGreaterThan(v.cesta.avulsos!)
    expect(v.frase).toContain('não fecha')
    expect(v.frase).toContain('avulso')
  })

  it('⭐ vantagem acima de 20% → "generoso demais"', () => {
    const v = vereditoDaCesta({
      produtos: [XIS, FRITAS],
      escolhas: [{ chave: XIS.chave, qtd: 1 }, { chave: FRITAS.chave, qtd: 1 }],
      preco: 70,
      alvoPct: 45,
      canais: CANAIS,
    })
    // avulsos 105,89 · preço 70 → 33,9% de vantagem
    expect(v.vantagem.pct!).toBeGreaterThan(0.2)
    expect(v.frase).toContain('generoso demais')
  })

  it('⭐ redondo → "cliente ganha X%, a casa fica com CMV Y%"', () => {
    const v = vereditoDaCesta({
      produtos: [XIS, FRITAS],
      escolhas: [{ chave: XIS.chave, qtd: 1 }, { chave: FRITAS.chave, qtd: 1 }],
      preco: 95,
      alvoPct: 35,
      canais: CANAIS,
    })
    expect(v.frase).toMatch(/cliente ganha .*%, a casa fica com CMV .*%/)
    expect(v.frase, 'percentual em pt-BR: vírgula, nunca ponto decimal').not.toMatch(/\d\.\d/)
  })

  it('⛔ "vendendo o combo a" nasce VAZIO — combo não tem média no PDV', () => {
    const v = vereditoDaCesta({
      produtos: [XIS, FRITAS],
      escolhas: [{ chave: XIS.chave, qtd: 1 }, { chave: FRITAS.chave, qtd: 1 }],
      preco: null,
      alvoPct: null,
      canais: CANAIS,
    })
    expect(v.bloco.farol.tom, 'sem preço, farol neutro').toBe('neutro')
    expect(v.vantagem.frase).toBeNull()
    expect(v.frase).toContain('digita o preço do combo')
  })
})

describe('⛔⛔ REGRESSÃO — 1 item escolhido = o cartão de hoje, EXATAMENTE', () => {
  /**
   * A ordem do dono: *"1 item escolhido → o cartão fica EXATAMENTE como hoje (média PDV,
   * farol, 3 sobras, canais) — regressão travada em teste; qualquer diferença = vermelho"*.
   *
   * ⚠️ A `frase` é a única coisa que difere de propósito (a do combo conhece `avulsos`, que o
   * produto único não tem) — por isso a comparação é do BLOCO: farol, teto, alvos e canais.
   */
  it('⭐ farol, teto, alvos e OS TRÊS CANAIS são idênticos ao produto sozinho', () => {
    const preco = 95.9
    const alvoPct = XIS.regua.tetoPct

    const comoHoje = montarBlocoDoVeredito({
      custo: XIS.custo,
      preco,
      tetoPct: XIS.regua.tetoPct,
      alvosPct: XIS.regua.alvosPct,
      alvoPct,
      canais: CANAIS,
      tipo: 'produto',
      motivoNeutro: '—',
    })

    const { bloco, cesta } = vereditoDaCesta({
      produtos: [XIS],
      escolhas: [{ chave: XIS.chave, qtd: 1 }],
      preco,
      alvoPct,
      canais: CANAIS,
    })

    expect(cesta.custoDoCombo, 'o custo do "combo" de 1 item É o custo do produto').toBe(XIS.custo)
    expect(cesta.avulsos, 'e os avulsos são a média do PDV dele').toBe(preco)
    expect(bloco.farol).toEqual(comoHoje.farol)
    expect(bloco.tetoPct).toBe(comoHoje.tetoPct)
    expect(bloco.alvosPct).toEqual(comoHoje.alvosPct)
    expect(bloco.alvoPct).toBe(comoHoje.alvoPct)
    expect(bloco.canais, 'os 3 canais, preço e sobra, ao centavo').toEqual(comoHoje.canais)
  })

  it('⭐ e vale nos TRÊS alvos — o chip ligado não muda a conta do produto único', () => {
    for (const alvoPct of XIS.regua.alvosPct) {
      const comoHoje = montarBlocoDoVeredito({
        custo: XIS.custo,
        preco: 95.9,
        tetoPct: XIS.regua.tetoPct,
        alvosPct: XIS.regua.alvosPct,
        alvoPct,
        canais: CANAIS,
        tipo: 'produto',
        motivoNeutro: '—',
      })
      const { bloco } = vereditoDaCesta({
        produtos: [XIS],
        escolhas: [{ chave: XIS.chave, qtd: 1 }],
        preco: 95.9,
        alvoPct,
        canais: CANAIS,
      })
      expect(bloco.canais, `alvo ${alvoPct}%`).toEqual(comoHoje.canais)
      expect(bloco.farol, `alvo ${alvoPct}%`).toEqual(comoHoje.farol)
    }
  })
})

describe('⛔ ZERO ESCRITA — cesta, alvo e preço são SIMULAÇÃO', () => {
  /**
   * ⚠️ Lê o arquivo **SEM COMENTÁRIO**, pelo detector único da casa: o próprio cabeçalho
   * da lib cita `prisma` e `react` pra DIZER que não os conhece, e *o arquivo que documenta
   * a regra não pode ser o que a reprova* (a cicatriz do "menção, não uso").
   */
  it('⛔ a lib da cesta não importa prisma, nem react, nem escreve em lugar nenhum', async () => {
    const fs = await import('node:fs')
    const { semComentarios } = await import('../../../__tests__/regras-ui/_leitura-de-fonte')
    const src = semComentarios(fs.readFileSync('lib/margem/cesta-do-veredito.ts', 'utf8'))
    expect(src, 'nada de banco').not.toMatch(/@\/lib\/db|prisma/i)
    expect(src, 'nada de componente — a decisão é pura').not.toMatch(/\breact\b/i)
    expect(src, 'nenhuma escrita').not.toMatch(/\.(create|update|upsert|delete)\w*\(/)
  })
})
