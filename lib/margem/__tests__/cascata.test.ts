/**
 * ⭐⭐⭐ A CASCATA DO MÊS — A CADEIA FECHA POR CONSTRUÇÃO E POR TESTE (10/10/2026).
 *
 * **Ordem do dono:** *"A CADEIA FECHA POR CONSTRUÇÃO e por teste: vendeu − cmv = sobra ·
 * sobra − casa = lucro — os 5 saem da MESMA lib do placar, estendida, sobre o MESMO conjunto
 * (as vendas com custo conhecido, pra cadeia nunca quebrar)"*.
 *
 * ⚠️ Os números são os MEDIDOS em prod (outubro): casa R$ 43.599,36 · sobra bruta
 * R$ 66.487,33 · complementos R$ 9.255,55 · cobertura 54,9%. **Fixture inventada testa o
 * mundo que eu imaginei** — e aqui o que está sob teste é justamente o fechamento ao centavo.
 *
 * ⭐⭐ ESTE ARQUIVO HERDOU A METADE VIVA DOS GUARDS DO PLACAR (aposentado em 10/10): *"a
 * apurar" nunca vira 0*, *a ressalva do veredito chega no herói*, *a composição dos chips vai
 * na sub da casa*, *os pedaços somam 1*, *cobertura `null` não vira 0%*. Ver o comentário de
 * inversão em `placar-e-montador.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { montarCasa, COBERTURA_MINIMA } from '../casa'
import { sobrasDoPeriodo, type LinhaParaSobra } from '../sobra'
import { montarCascata, CMV_SAUDAVEL } from '../cascata'

const linha = (o: Partial<LinhaParaSobra> & { chave: string; nome: string }): LinhaParaSobra => ({
  status: 'FICHA_OK', vendasQtd: 10, vendasValor: 1000, precoUsado: 100, precoOrigem: 'praticado',
  custoUnitario: 20, custoParcial: 20, componentesSemCusto: 0, ...o,
})

/** ⭐ os 4 maiores tijolos reais de prod (outubro) */
const PROD: LinhaParaSobra[] = [
  linha({ chave: 'f:combo', nome: 'Combo Caçula', vendasQtd: 285, precoUsado: 83.3, custoUnitario: 15.2 }),
  linha({ chave: 'f:fam45', nome: 'PIZZA FAMILIA 45CM', vendasQtd: 108, precoUsado: 120.44, custoUnitario: 17.74 }),
  linha({ chave: 'f:gp', nome: 'PIZZA GRANDE PRECINHO', vendasQtd: 143, precoUsado: 64.74, custoUnitario: 9.92 }),
  linha({ chave: 'f:pq', nome: 'PIZZA PEQUENA 25CM', vendasQtd: 38, precoUsado: 52.45, custoUnitario: 6.4 }),
]

/** ⚠️ o produto que VENDE e não tem custo — é ele que derruba a cobertura pros 55% de prod */
const FORA = linha({
  chave: 'f:x', nome: 'XIS COMPLETO', vendasQtd: 470,
  custoUnitario: null, componentesSemCusto: 1,
})

function cenario(opts: { custoFixo: number | null; linhas?: LinhaParaSobra[]; comp?: number; dias?: number }) {
  const sobras = sobrasDoPeriodo(opts.linhas ?? PROD)
  const casa = montarCasa({
    sobras,
    custoFixo: opts.custoFixo,
    dias: opts.dias ?? 7,
    composicao: { casa: true, banco: true, compromissos: true },
    complementos: { custo: opts.comp ?? 0, ocorrenciasComCusto: opts.comp ? 1000 : 0, ocorrenciasSemCusto: 0 },
  })
  return { sobras, casa }
}

const cascataDe = (o: Parameters<typeof cenario>[0], cmvPorCompra: number | null = null) => {
  const { sobras, casa } = cenario(o)
  return { c: montarCascata(casa, sobras, cmvPorCompra), casa, sobras }
}

const cartao = (c: ReturnType<typeof montarCascata>, qual: string) =>
  c.cartoes.find((x) => x.qual === qual)!

describe('⛔⛔⛔ A CADEIA — vendeu − cmv = sobra · sobra − casa = lucro', () => {
  it('⭐⭐ com lucro: os dois elos fecham AO CENTAVO e a saída diz `fecha`', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 })
    const vendeu = cartao(c, 'vendeu').valor!
    const cmv = cartao(c, 'cmv').valor!
    const sobra = cartao(c, 'sobra').valor!
    const casa = cartao(c, 'casa').valor!
    const lucro = cartao(c, 'lucro').valor!

    // ⛔ é ESTE fechamento que torna o número defensável: o dono soma na mão e bate
    expect(vendeu - cmv).toBeCloseTo(sobra, 2)
    expect(sobra - casa).toBeCloseTo(lucro, 2)
    expect(c.fecha).toBe(true)
    expect(c.heroi.estado).toBe('LUCRO')
  })

  it('⭐ com PREJUÍZO: a mesma conta do outro lado, e o cartão vira "Faltam"', () => {
    const { c } = cascataDe({ custoFixo: 200_000, comp: 9_255.55 })
    const sobra = cartao(c, 'sobra').valor!
    const casa = cartao(c, 'casa').valor!
    const falta = cartao(c, 'lucro').valor!

    expect(c.heroi.estado).toBe('FALTAM')
    // ⚠️ o cartão mostra o valor POSITIVO: "FALTAM R$ X" é estado honesto, nunca lucro negativo
    expect(falta).toBeGreaterThan(0)
    expect(casa - sobra).toBeCloseTo(falta, 2)
    expect(cartao(c, 'lucro').rotulo).toBe('Faltam')
    expect(c.fecha).toBe(true)
  })

  /**
   * ⛔⛔ O `fecha` É O GUARD QUE MORDE NAS CAUSAS REAIS — medido na REGRA 11 de 10/10: o CMV
   * esquecer os complementos, a sobra virar a BRUTA (complemento contado 2×) e a casa entrar
   * inflada no 2º elo dão **7 vermelhos cada**. O que NÃO quebra a cadeia é trocar a forma de
   * somar o custo (ver o teste abaixo, e o porquê no cabeçalho de `cascata.ts`).
   */
  it('⛔⛔ a cadeia fecha nos QUATRO períodos do seletor (hoje · 7d · mês · datas)', () => {
    for (const dias of [1, 7, 31, 92]) {
      const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55, dias })
      expect(c.fecha, `a cadeia não fecha com ${dias} dia(s)`).toBe(true)
    }
  })

  /**
   * ⚠️⚠️ ESTE TESTE EXISTE PORQUE A REGRA 11 ME CORRIGIU, e o que ele afirma mudou.
   *
   * Eu tinha escrito que a derivação consertava um resíduo de arredondamento. **Medido: não
   * conserta nada — não há resíduo.** `sobrasDoPeriodo` arredonda o `custo` em 2 casas, então
   * com custo de 3 e 4 casas e 2.429 unidades as TRÊS formas alternativas (`Σ custo × un`,
   * `Σ round2(preço − sobraUn) × un`, `vendeu − Σ sobraUn × un`) dão o MESMO número e o
   * `fecha` segue `true` em todas. ⭐ O que o teste trava, então, é o que é verdade: **a
   * cadeia fecha com custo fracionário**, que é o dado real (custo vem de explosão de ficha
   * com dose em grama).
   */
  it('⭐ custo de 3 e 4 casas × 2.429 unidades: a cadeia fecha ao centavo', () => {
    const FRACIONARIO: LinhaParaSobra[] = [
      linha({ chave: 'f:a', nome: 'A', vendasQtd: 931, precoUsado: 83.37, custoUnitario: 15.237 }),
      linha({ chave: 'f:b', nome: 'B', vendasQtd: 519, precoUsado: 120.41, custoUnitario: 17.746 }),
      linha({ chave: 'f:c', nome: 'C', vendasQtd: 503, precoUsado: 64.73, custoUnitario: 9.9238 }),
      linha({ chave: 'f:d', nome: 'D', vendasQtd: 476, precoUsado: 52.49, custoUnitario: 6.4051 }),
    ]
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55, linhas: FRACIONARIO })
    expect(cartao(c, 'vendeu').valor! - cartao(c, 'cmv').valor!).toBeCloseTo(cartao(c, 'sobra').valor!, 2)
    expect(c.fecha).toBe(true)
  })

  it('⛔ a cadeia fecha também com o produto FORA da obra na lista (a cena real de prod)', () => {
    const { c, casa } = cascataDe({ custoFixo: 20_000, comp: 9_255.55, linhas: [...PROD, FORA] })
    // ⚠️ o conjunto é o MESMO dos 2 lados: o `vendeu` é só o medido, então o fora não quebra
    expect(casa.cobertura.pct!).toBeLessThan(COBERTURA_MINIMA)
    expect(c.fecha).toBe(true)
  })
})

describe('⛔⛔ "A APURAR" NUNCA VIRA R$ 0,00 — a régua da casa', () => {
  it('⛔⛔ sem plano declarado: casa e lucro são `null`, e a barra nem existe', () => {
    const { c } = cascataDe({ custoFixo: null })
    expect(cartao(c, 'casa').valor).toBeNull()
    expect(cartao(c, 'lucro').valor).toBeNull()
    expect(c.heroi.estado).toBe('A_APURAR')
    // ⚠️ desenhar "de cada R$ 100" sem saber a casa afirmaria um lucro que ninguém calculou
    expect(c.composicao).toBeNull()
    expect(cartao(c, 'casa').sub).toContain('declare')
  })

  it('⛔ período SEM venda medida: vendeu/cmv/sobra `null` e o % do CMV não vira 0,0%', () => {
    const { c } = cascataDe({ custoFixo: 20_000, linhas: [] })
    expect(cartao(c, 'vendeu').valor).toBeNull()
    expect(cartao(c, 'cmv').valor).toBeNull()
    expect(cartao(c, 'cmv').pctDasVendas).toBeNull()
    expect(c.composicao).toBeNull()
  })
})

describe('⛔⛔ O % DO CMV — pctBR em todo percentual (ponto = vermelho)', () => {
  it('⛔⛔ o % GIGANTE do CMV sai com VÍRGULA e a palavra "das vendas"', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 })
    const pct = cartao(c, 'cmv').pctDasVendas!
    expect(pct).toMatch(/^\d+,\d% das vendas$/)
    // ⛔ O VERMELHO QUE O DONO PEDIU: *"% com ponto = vermelho"*
    expect(pct).not.toMatch(/\d\.\d/)
  })

  it('⛔ nenhum percentual da cascata usa PONTO decimal — nem na legenda, nem na régua', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 })
    const textos = [
      cartao(c, 'cmv').pctDasVendas!,
      c.composicao!.legenda.cmv,
      c.composicao!.legenda.casa,
      c.composicao!.legenda.lucro!,
      c.honestidade.linha,
      c.honestidade.reguaDoSetor,
    ]
    for (const t of textos) {
      expect(t, `percentual com ponto decimal: "${t}"`).not.toMatch(/\d\.\d\s*%/)
    }
  })

  it('⭐ a régua do setor vem da CONSTANTE — a tela nunca digita o número', () => {
    const { c } = cascataDe({ custoFixo: 20_000 })
    expect(c.honestidade.reguaDoSetor).toContain('28')
    expect(c.honestidade.reguaDoSetor).toContain('35')
    expect(CMV_SAUDAVEL).toEqual({ de: 0.28, ate: 0.35 })
  })
})

describe('⛔⛔ A COMPOSIÇÃO — de cada R$ 100, e os pedaços SOMAM 1', () => {
  it('⭐ com lucro: cmv + casa + lucro = 1 por construção', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 })
    const b = c.composicao!
    expect(b.cmv + b.casa + b.lucro).toBeCloseTo(1, 9)
    expect(b.faltam).toBeNull()
    expect(b.legenda.lucro).toContain('lucro')
  })

  /**
   * ⛔⛔ COM PREJUÍZO NÃO EXISTE FATIA VERDE, e a barra não finge que existe: os dois pedaços
   * se normalizam pelo total GASTO e o selo coral carrega o que falta. Desenhar um verde de 0%
   * seria a barra afirmando um lucro que não houve.
   */
  it('⛔⛔ com prejuízo: nenhum verde, legenda de lucro `null` e o selo coral DIZ o que falta', () => {
    const { c } = cascataDe({ custoFixo: 200_000, comp: 9_255.55 })
    const b = c.composicao!
    expect(b.lucro).toBe(0)
    expect(b.legenda.lucro).toBeNull()
    expect(b.cmv + b.casa).toBeCloseTo(1, 9)
    expect(b.faltam).toContain('faltam')
  })
})

describe('⛔⛔ A HONESTIDADE — o que o número NÃO é fica dito', () => {
  it('⭐ a linha diz a cobertura, as vendas TOTAIS e o CMV por compra', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55, linhas: [...PROD, FORA] }, 258_749.17)
    expect(c.honestidade.linha).toMatch(/medido em \d+,\d% das vendas/)
    expect(c.honestidade.linha).toContain('vendas totais')
    expect(c.honestidade.linha).toContain('CMV por compra (notas)')
  })

  /**
   * ⚠️ As **vendas TOTAIS** existem aqui de propósito: o `vendeu` da cascata é só o conjunto
   * medido, e sem este número o dono não tem como saber o tamanho do que ficou fora.
   */
  it('⛔ as vendas totais incluem o que está FORA da obra — senão o número esconde o buraco', () => {
    const { c } = cascataDe({ custoFixo: 20_000, linhas: [...PROD, FORA] })
    const semFora = cascataDe({ custoFixo: 20_000, linhas: PROD }).c
    const num = (s: string) => s.match(/vendas totais R\$\s*([\d.,]+)/)![1]
    expect(num(c.honestidade.linha)).not.toBe(num(semFora.honestidade.linha))
  })

  it('⛔ cobertura `null` (período sem venda) não vira "0% das vendas"', () => {
    const { c } = cascataDe({ custoFixo: 20_000, linhas: [] })
    expect(c.honestidade.linha).not.toContain('0,0% das vendas')
    expect(c.honestidade.linha).toContain('nenhuma venda no período')
  })

  it('⭐ sem nota de custo no período, o CMV por compra é "a apurar" — nunca R$ 0,00', () => {
    const { c } = cascataDe({ custoFixo: 20_000 }, null)
    expect(c.honestidade.linha).toContain('CMV por compra (notas): a apurar')
  })

  it('⭐⭐ o ⓘ explica CONSUMO × COMPRA lado a lado, e por que os dois diferem', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 }, 258_749.17)
    const tudo = c.honestidade.explicacoes.map((e) => `${e.titulo}: ${e.texto}`).join(' | ')
    expect(tudo).toContain('CONSUMO')
    expect(tudo).toContain('COMPRA')
    expect(tudo).toContain('comprar não é consumir')
  })

  /**
   * ⛔⛔ O PISO DO COMPLEMENTO É DITO — a régua que migrou da `sublinhaDaSobra` do placar
   * morto: ocorrência sem ficha não entra no custo, então o CMV é o **MÍNIMO**, e sem a
   * ressalva o número seria otimista justo onde decide se a casa pagou.
   */
  it('⛔⛔ complemento sem ficha: o ⓘ diz que o CMV é o MÍNIMO, não o total', () => {
    const sobras = sobrasDoPeriodo(PROD)
    const casa = montarCasa({
      sobras, custoFixo: 20_000, dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 9_255.55, ocorrenciasComCusto: 1000, ocorrenciasSemCusto: 1272 },
    })
    const c = montarCascata(casa, sobras, null)
    const tudo = c.honestidade.explicacoes.map((e) => e.texto).join(' | ')
    expect(tudo).toContain('1272 ocorrências ainda sem ficha')
    expect(tudo).toContain('MÍNIMO')
  })

  it('⭐ o complemento ENTRA no CMV — ele sai do estoque a cada ocorrência', () => {
    const semComp = cascataDe({ custoFixo: 20_000, comp: 0 }).c
    const comComp = cascataDe({ custoFixo: 20_000, comp: 9_255.55 }).c
    const d = cartao(comComp, 'cmv').valor! - cartao(semComp, 'cmv').valor!
    expect(d).toBeCloseTo(9_255.55, 2)
    // ⚠️ e a cadeia segue fechando dos dois lados — o complemento abate a sobra junto
    expect(semComp.fecha && comComp.fecha).toBe(true)
  })
})

describe('⭐ OS 5 CARTÕES — o operador é o que faz os números lerem como uma CONTA', () => {
  it('⭐ a ordem e os operadores são os do pedido do dono', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 })
    expect(c.cartoes.map((x) => x.qual)).toEqual(['vendeu', 'cmv', 'sobra', 'casa', 'lucro'])
    expect(c.cartoes.map((x) => x.operador)).toEqual([null, '−', '=', '−', '='])
  })

  /**
   * ⛔ A COMPOSIÇÃO DOS CHIPS VAI NA SUB DA CASA — o guard que vem do placar: o mesmo mês
   * custa números diferentes conforme o dono liga casa/banco/compromissos, e um total mudo
   * ali seria indefensável.
   */
  it('⛔ a sub da casa DIZ a composição dos chips — nunca um total mudo', () => {
    const { c } = cascataDe({ custoFixo: 20_000 })
    expect(cartao(c, 'casa').sub).toContain('casa + banco + compromissos')
  })

  it('⭐ só o cartão do CMV carrega o % — os outros quatro vêm `null`', () => {
    const { c } = cascataDe({ custoFixo: 20_000, comp: 9_255.55 })
    const comPct = c.cartoes.filter((x) => x.pctDasVendas != null)
    expect(comPct).toHaveLength(1)
    expect(comPct[0].qual).toBe('cmv')
  })
})
