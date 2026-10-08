/**
 * ⭐⭐⭐ OS GUARDS DO v2 — o placar, a lista, os canais, os tamanhos e o montador (07/10/2026).
 *
 * ⚠️ Os números são os MEDIDOS em prod: casa R$ 43.599,36 · sobra bruta R$ 66.487,33 ·
 * complementos R$ 9.255,55 · cobertura 54,9%. Fixture inventada testa o mundo que eu imaginei.
 */
import { describe, it, expect } from 'vitest'
import { montarCasa, COBERTURA_MINIMA } from '../casa'
import { sobrasDoPeriodo, type LinhaParaSobra } from '../sobra'
import { montarPlacar, montarCarregadores, linhaDaCobertura, CARREGADORES_VISIVEIS } from '../placar'
import { sobraNoCanal, ordenarCanais, CANAIS_SEMEADOS, TAXA_MAXIMA, type CanalDeVenda } from '../canais'
import { saboresDoTamanho, montarTamanhos, SABORES_SEMEADOS, normalizarTamanho } from '../tamanhos'
import { montarPizza, ordenarSabores, type SaborDisponivel } from '../montador'

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

const casaDe = (opts: { custoFixo: number | null; linhas?: LinhaParaSobra[]; comp?: number }) =>
  montarCasa({
    sobras: sobrasDoPeriodo(opts.linhas ?? PROD),
    custoFixo: opts.custoFixo,
    dias: 7,
    composicao: { casa: true, banco: true, compromissos: true },
    complementos: { custo: opts.comp ?? 0, ocorrenciasComCusto: opts.comp ? 1000 : 0, ocorrenciasSemCusto: 0 },
  })

describe('⛔⛔ O PLACAR — a conta dos 3 cartões FECHA na tela', () => {
  it('⭐ casa PAGA: sobra − casa = transbordo, ao centavo', () => {
    const casa = casaDe({ custoFixo: 20_000, comp: 9_255.55 })
    const p = montarPlacar(casa)
    expect(p.resultado.tom).toBe('PAGOU')
    // ⛔ é ESTE fechamento que torna o número defensável: o dono soma na mão e bate
    expect(p.sobra.valor! - p.casa.valor!).toBeCloseTo(p.resultado.valor!, 2)
    expect(p.resultado.sublinha).toContain('daqui pra frente é lucro')
  })

  it('⭐ casa EM OBRA: sobra − casa = −falta (a mesma conta, do outro lado)', () => {
    const casa = casaDe({ custoFixo: 200_000, comp: 9_255.55 })
    const p = montarPlacar(casa)
    expect(p.resultado.tom).toBe('EM_OBRA')
    expect(p.casa.valor! - p.sobra.valor!).toBeCloseTo(p.resultado.valor!, 2)
  })

  it('⛔⛔ sem plano declarado: casa e resultado são "a apurar" — NUNCA R$ 0,00', () => {
    const p = montarPlacar(casaDe({ custoFixo: null }))
    expect(p.casa.valor).toBeNull()
    expect(p.resultado.valor).toBeNull()
    expect(p.resultado.tom).toBe('A_APURAR')
    // ⚠️ e a barra nem existe: desenhar 0% afirmaria que nada foi pago de uma casa sem valor
    expect(p.barra).toBeNull()
    expect(p.casa.sublinha).toContain('declare')
  })

  it('⛔⛔ a RESSALVA do veredito chega no cartão de resultado (o guard de v1 que não cai)', () => {
    // ⚠️ a cena é a de prod: cobertura 55%, ABAIXO do mínimo. A fixture dos 4 maiores tem 100%
    // de cobertura — então o fora-da-obra precisa entrar, senão este teste passaria por um
    // motivo que prod não tem (os 574 un dentro contra ~470 fora dão os 55% medidos).
    const casa = casaDe({
      custoFixo: 20_000,
      linhas: [...PROD, linha({ chave: 'f:x', nome: 'XIS COMPLETO', vendasQtd: 470, custoUnitario: null, componentesSemCusto: 1 })],
    })
    expect(casa.cobertura.pct!).toBeLessThan(COBERTURA_MINIMA)
    expect(casa.veredito.confiavel).toBe(false)
    const p = montarPlacar(casa)
    expect(p.resultado.ressalva).toBe(casa.veredito.ressalva)
    expect(p.resultado.ressalva).toContain('dá pra medir')
  })

  it('⭐ a sublinha da sobra DIZ a cobertura e o abatimento dos complementos', () => {
    const p = montarPlacar(casaDe({ custoFixo: 20_000, comp: 9_255.55 }))
    expect(p.sobra.sublinha).toMatch(/sobra medida em \d+% das vendas/)
    // ⚠️ REAPONTADO (v3): a palavra é a da REFERÊNCIA — *"já abatidos R$ 9.256 de
    // complementos"*. O texto da tela é lei do dono, inclusive no verbo.
    expect(p.sobra.sublinha).toContain('já abatidos')
  })

  it('⚠️ cobertura `null` (período sem venda) não vira "0% das vendas"', () => {
    const p = montarPlacar(casaDe({ custoFixo: 20_000, linhas: [] }))
    expect(p.sobra.sublinha).not.toContain('0% das vendas')
    expect(p.sobra.sublinha).toContain('nenhuma venda com custo conhecido')
  })

  it('⭐ a composição dos chips vai na sublinha da casa — nunca um total mudo', () => {
    const p = montarPlacar(casaDe({ custoFixo: 20_000 }))
    expect(p.casa.sublinha).toContain('casa + banco + compromissos')
  })
})

describe('⛔⛔ A BARRA — índigo até a bandeira, verde no transbordo, e os pedaços SOMAM 1', () => {
  it('⭐ com a casa paga, pago + transbordo = 1 e o rótulo diz o excedente', () => {
    // ⚠️ a cena de prod: sobra 152% da casa
    const casa = casaDe({ custoFixo: 20_000 })
    const real = casa.sobraLiquida / 20_000
    expect(real).toBeGreaterThan(1)
    const b = montarPlacar(casa).barra!
    expect(b.pago + b.transbordo).toBeCloseTo(1, 9)
    expect(b.bandeira).toBe(true)
    expect(b.rotuloTransbordo).toBe(`+${Math.round((real - 1) * 100)}%`)
    expect(b.rotuloParcial).toBeNull()
  })

  it('⭐ em obra: a barra é parcial, sem bandeira, e DIZ o percentual', () => {
    const b = montarPlacar(casaDe({ custoFixo: 200_000 }))!.barra!
    expect(b.bandeira).toBe(false)
    expect(b.transbordo).toBe(0)
    expect(b.pago).toBeLessThan(1)
    expect(b.rotuloParcial).toMatch(/^\d+% da casa$/)
  })

  it('⛔ a barra nunca passa de 1 nem fica negativa', () => {
    for (const cf of [1, 100, 20_000, 66_487, 1_000_000]) {
      const b = montarPlacar(casaDe({ custoFixo: cf }))!.barra!
      expect(b.pago).toBeGreaterThanOrEqual(0)
      expect(b.pago).toBeLessThanOrEqual(1)
      expect(b.pago + b.transbordo).toBeLessThanOrEqual(1.000001)
    }
  })
})

describe('⛔⛔ QUEM CARREGOU A CASA — o guard do dono sobrevive à lista', () => {
  it('⭐⭐ Σ(carregadores) == sobra BRUTA, com o agrupado desfeito em linhas', () => {
    const muitos = Array.from({ length: 14 }, (_, i) =>
      linha({ chave: `f:${i}`, nome: `P${i}`, vendasQtd: 14 - i, precoUsado: 50, custoUnitario: 10 }),
    )
    const casa = casaDe({ custoFixo: 1000, linhas: muitos })
    const l = montarCarregadores(casa, 95)
    const todos = [...l.visiveis, ...l.resto]
    // ⭐ o agrupado deixou de existir: cada produto é uma linha de verdade
    expect(todos).toHaveLength(14)
    expect(todos.some((x) => x.chave.startsWith('agrupado:'))).toBe(false)
    expect(todos.reduce((a, x) => a + x.sobraTotal, 0)).toBeCloseTo(casa.sobraTotal, 2)
  })

  it('⭐ top 6 visíveis e o resto atrás do "+N produtos"', () => {
    const muitos = Array.from({ length: 14 }, (_, i) =>
      linha({ chave: `f:${i}`, nome: `P${i}`, vendasQtd: 14 - i, precoUsado: 50, custoUnitario: 10 }),
    )
    const l = montarCarregadores(casaDe({ custoFixo: 1000, linhas: muitos }), 0)
    expect(l.visiveis).toHaveLength(CARREGADORES_VISIVEIS)
    expect(l.resto).toHaveLength(14 - CARREGADORES_VISIVEIS)
  })

  it('⭐ 👑 no maior contribuinte, e a lista desce por sobra', () => {
    const l = montarCarregadores(casaDe({ custoFixo: 20_000 }), 0)
    expect(l.visiveis[0].rei).toBe(true)
    expect(l.visiveis[0].nome).toBe('Combo Caçula')
    for (let i = 1; i < l.visiveis.length; i++) {
      expect(l.visiveis[i - 1].sobraTotal).toBeGreaterThanOrEqual(l.visiveis[i].sobraTotal)
    }
    expect(l.visiveis.filter((x) => x.rei)).toHaveLength(1)
  })

  it('⛔⛔ a barra da LINHA é relativa ao MAIOR, não à casa', () => {
    // ⚠️ com a casa paga, dividir pela casa faria metade das linhas encostar no fim da barra
    // e a comparação entre produtos — que é a pergunta desta lista — sumiria
    const l = montarCarregadores(casaDe({ custoFixo: 1000 }), 0)
    expect(l.visiveis[0].pctDaBarra).toBeCloseTo(1, 9)
    expect(l.visiveis[0].pctDaCasa!).toBeGreaterThan(1) // ele pagou MAIS que a casa inteira
    for (const x of l.visiveis) expect(x.pctDaBarra).toBeLessThanOrEqual(1)
  })

  it('⭐ o rodapé carrega o que destrava a cobertura', () => {
    const casa = casaDe({
      custoFixo: 20_000,
      linhas: [...PROD, linha({ chave: 'f:x', nome: 'XIS', custoUnitario: null, componentesSemCusto: 1 })],
    })
    const l = montarCarregadores(casa, 95)
    expect(l.rodape.foraDaObra).toBe(1)
    expect(l.rodape.saboresSemFicha).toBe(95)
    expect(l.rodape.cobertura).toBeCloseTo(casa.cobertura.pct!, 9)
    expect(COBERTURA_MINIMA).toBe(0.8)
  })

  it('⚠️ sem plano, o "% da casa" de cada linha é `null` — nunca 0%', () => {
    const l = montarCarregadores(casaDe({ custoFixo: null }), 0)
    expect(l.visiveis.every((x) => x.pctDaCasa === null)).toBe(true)
    // ⭐ mas a BARRA continua existindo: ela é relativa ao maior, não precisa da casa
    expect(l.visiveis[0].pctDaBarra).toBeCloseTo(1, 9)
  })
})

describe('⛔⛔ OS CANAIS — a taxa incide no PREÇO, e "a declarar" nunca é 0%', () => {
  const ifood: CanalDeVenda = { id: 'c1', nome: 'iFood', taxaPct: 0.2, ativo: true }
  const balcao: CanalDeVenda = { id: 'c2', nome: 'balcão', taxaPct: 0, ativo: true }
  const novo: CanalDeVenda = { id: 'c3', nome: 'Rappi', taxaPct: null, ativo: true }

  it('⭐ a conta: preço × (1 − taxa) − custo', () => {
    const r = sobraNoCanal(100, 30, ifood)
    expect(r.taxaValor).toBeCloseTo(20, 2)
    expect(r.sobra).toBeCloseTo(50, 2)
    expect(r.margemPct).toBeCloseTo(0.5, 9)
  })

  it('⛔⛔ a taxa é sobre o PREÇO, nunca sobre a sobra', () => {
    // ⚠️ sobre a sobra daria 70 − 14 = 56, e o erro cresce com a margem
    expect(sobraNoCanal(100, 30, ifood).sobra).toBeCloseTo(50, 2)
    expect(sobraNoCanal(100, 30, ifood).sobra).not.toBeCloseTo(56, 2)
  })

  it('⛔ no balcão (0%) a sobra é preço − custo', () => {
    expect(sobraNoCanal(100, 30, balcao).sobra).toBeCloseTo(70, 2)
  })

  it('⛔⛔ taxa "a declarar" devolve `null` com o PORQUÊ — nunca o preço cheio', () => {
    const r = sobraNoCanal(100, 30, novo)
    expect(r.sobra).toBeNull()
    expect(r.margemPct).toBeNull()
    expect(r.porque).toContain('taxa deste canal ainda não foi declarada')
  })

  it('⛔ sem custo ou sem preço, "a apurar" com o motivo certo', () => {
    expect(sobraNoCanal(100, null, ifood).porque).toContain('custo a apurar')
    expect(sobraNoCanal(null, 30, ifood).porque).toContain('sem preço')
  })

  it('⭐ sobra NEGATIVA é devolvida como negativa — o canal pode comer a margem inteira', () => {
    const r = sobraNoCanal(30, 28, ifood)
    expect(r.sobra).toBeCloseTo(-4, 2)
  })

  it('⚠️ "a declarar" vai pro FIM da lista — a tela não abre com coluna muda no lugar de honra', () => {
    const o = ordenarCanais([novo, ifood, balcao])
    expect(o.map((c) => c.nome)).toEqual(['balcão', 'iFood', 'Rappi'])
  })

  it('⭐ o seed é o que o dono ditou: balcão 0 · tele própria 0 · iFood 20%', () => {
    expect(CANAIS_SEMEADOS.map((c) => [c.nome, c.taxaPct])).toEqual([
      ['balcão', 0], ['tele-entrega própria', 0], ['iFood', 0.2],
    ])
    // ⛔ a taxa é FRAÇÃO: 20 em vez de 0,2 seria o canal levando 20× o preço
    for (const c of CANAIS_SEMEADOS) expect(c.taxaPct).toBeLessThan(TAXA_MAXIMA)
  })
})

describe('⛔⛔ OS TAMANHOS — os números do dono, e "PRECINHO segue o tamanho" é REGRA', () => {
  const regras = SABORES_SEMEADOS

  it('⭐ os números ditados: pequena 1 · grande 2 · família 3', () => {
    expect(saboresDoTamanho('PEQUENA', regras)!.sabores).toBe(1)
    expect(saboresDoTamanho('GRANDE', regras)!.sabores).toBe(2)
    expect(saboresDoTamanho('FAMILIA', regras)!.sabores).toBe(3)
  })

  it('⭐⭐ PRECINHO DERIVA do tamanho base — e a tela sabe de onde veio', () => {
    const g = saboresDoTamanho('GRANDE PRECINHO', regras)!
    expect(g.sabores).toBe(2)
    expect(g.derivadoDe).toBe('GRANDE')
    const f = saboresDoTamanho('FAMILIA PRECINHO', regras)!
    expect(f.sabores).toBe(3)
    expect(f.derivadoDe).toBe('FAMILIA')
  })

  it('⛔ a LINHA PRÓPRIA ganha da derivação — o dono pode declarar outro número pro precinho', () => {
    const r = [...regras, { tamanho: 'GRANDE PRECINHO', sabores: 1 }]
    const g = saboresDoTamanho('GRANDE PRECINHO', r)!
    expect(g.sabores).toBe(1)
    expect(g.derivadoDe).toBeNull()
  })

  it('⛔⛔ tamanho desconhecido devolve `null` — e o montador então NÃO desenha fatia nenhuma', () => {
    expect(saboresDoTamanho('BROTO', regras)).toBeNull()
    // ⚠️ chutar 1 faria uma família de 3 sabores entrar no sistema como 1
  })

  it('⛔ a lista de variações é FECHADA: "GRANDE CALABRESA" não herda o 2 do GRANDE', () => {
    expect(saboresDoTamanho('GRANDE CALABRESA', regras)).toBeNull()
  })

  it('⭐ PROMO também é variação de preço (prod tem "PIZZA GRANDE PROMO")', () => {
    expect(saboresDoTamanho('GRANDE PROMO', regras)!.sabores).toBe(2)
  })

  it('⚠️ normaliza caixa e espaço duplicado, como o CHECK do banco exige', () => {
    expect(normalizarTamanho('  grande   precinho ')).toBe('GRANDE PRECINHO')
    expect(saboresDoTamanho('grande precinho', regras)!.sabores).toBe(2)
  })

  it('⭐ montarTamanhos põe os PRONTOS primeiro e nomeia o que falta', () => {
    const t = montarTamanhos({
      regras,
      bases: [{ tamanho: 'GRANDE', fichaId: 'f1', nome: 'Pizza Grande (35cm)', custo: 8.16 }],
    })
    expect(t[0].tamanho).toBe('GRANDE')
    expect(t[0].base?.custo).toBeCloseTo(8.16, 2)
    // ⛔ os sem base NÃO desaparecem — o chip aparece marcado, senão o dono não sabe por quê
    expect(t.map((x) => x.tamanho).sort()).toEqual(['FAMILIA', 'GRANDE', 'PEQUENA'])
    expect(t.filter((x) => x.base == null)).toHaveLength(2)
  })

  it('⭐ base apontada pra um tamanho SEM regra de sabores entra com 0 e a tela PEDE', () => {
    const t = montarTamanhos({
      regras: [],
      bases: [{ tamanho: 'BROTO', fichaId: 'f9', nome: 'Broto', custo: 5 }],
    })
    expect(t[0].sabores).toBe(0)
  })
})

describe('⛔⛔⛔ O MONTADOR — 1 OCORRÊNCIA = 1 EXPLOSÃO, SEM FATOR (a regra de 02/09)', () => {
  const sabor = (nome: string, custo: number | null): SaborDisponivel => ({
    fichaId: `f:${nome}`, nome, custo, familia: 'rosa', icone: 'generico', temFicha: true,
  })
  /** ⭐ os sabores REAIS de prod */
  const FILE_BACON = sabor('FILE COM BACON', 13.18)
  const CALABRESA = sabor('CALABRESA', 4.23)
  const ifood: CanalDeVenda = { id: 'c1', nome: 'iFood', taxaPct: 0.2, ativo: true }
  const balcao: CanalDeVenda = { id: 'c2', nome: 'balcão', taxaPct: 0, ativo: true }

  /** a base real: `Pizza Grande (35cm)` = 2 × porção de queijo */
  const GRANDE = {
    tamanho: 'GRANDE', sabores: 2, derivadoDe: null,
    base: { fichaId: 'f:base', nome: 'Pizza Grande (35cm)', custo: 8.16 },
  }

  it('⭐⭐ grande de 2 sabores: base + ficha de CADA sabor, UMA vez cada', () => {
    const p = montarPizza({ tamanho: GRANDE, escolhas: [FILE_BACON, CALABRESA], precoVenda: 89.9, canais: [balcao, ifood] })
    expect(p.fatias).toHaveLength(2)
    expect(p.custoBase).toBeCloseTo(8.16, 2)
    expect(p.custoSabores).toBeCloseTo(13.18 + 4.23, 2)
    expect(p.custoTotal).toBeCloseTo(8.16 + 13.18 + 4.23, 2)
    expect(p.incompleto).toHaveLength(0)
  })

  it('⛔⛔ CONTRAFACTUAL DO FATOR QUE MORREU: dividir por 2 daria um custo MENOR e errado', () => {
    const p = montarPizza({ tamanho: GRANDE, escolhas: [FILE_BACON, CALABRESA], precoVenda: null, canais: [] })
    const comFator = 8.16 + (13.18 + 4.23) / 2
    // ⚠️ a diferença é de R$ 8,70 numa pizza só — e o relatório de complementos, que é quem
    // baixa o sabor de verdade, conta OCORRÊNCIA, nunca fração
    expect(p.custoTotal).toBeCloseTo(25.57, 2)
    expect(p.custoTotal).not.toBeCloseTo(comFator, 2)
    expect(p.custoTotal! - comFator).toBeCloseTo(8.705, 2)
  })

  it('⭐ a mesma pizza em 2 fatias do MESMO sabor soma duas vezes', () => {
    const p = montarPizza({ tamanho: GRANDE, escolhas: [CALABRESA, CALABRESA], precoVenda: null, canais: [] })
    expect(p.custoSabores).toBeCloseTo(4.23 * 2, 2)
  })

  it('⛔⛔ sem BASE apontada: total `null` e o motivo NOMEADO — nunca só os sabores', () => {
    const p = montarPizza({
      tamanho: { ...GRANDE, base: null },
      escolhas: [FILE_BACON, CALABRESA], precoVenda: 89.9, canais: [balcao],
    })
    expect(p.custoTotal).toBeNull()
    expect(p.incompleto.map((i) => i.motivo)).toContain('SEM_BASE')
    // ⭐ o parcial existe pra tela não ficar muda, mas ele é PISO
    expect(p.custoParcial).toBeCloseTo(13.18 + 4.23, 2)
    // ⛔ e a sobra por canal NÃO é calculada sobre o parcial — seria otimista
    expect(p.canais[0].sobra).toBeNull()
  })

  it('⛔ fatia vazia: total `null` dizendo quantas faltam', () => {
    const p = montarPizza({ tamanho: GRANDE, escolhas: [FILE_BACON, null], precoVenda: 89.9, canais: [balcao] })
    expect(p.custoTotal).toBeNull()
    expect(p.incompleto.find((i) => i.motivo === 'FATIA_VAZIA')!.frase).toContain('1 de 2')
    expect(p.canais[0].sobra).toBeNull()
  })

  it('⛔ sabor sem custo médio: total `null` NOMEANDO o sabor', () => {
    const p = montarPizza({
      tamanho: GRANDE, escolhas: [sabor('MUSSARELA', null), CALABRESA], precoVenda: 89.9, canais: [balcao],
    })
    expect(p.custoTotal).toBeNull()
    expect(p.incompleto.find((i) => i.motivo === 'SABOR_SEM_CUSTO')!.frase).toContain('MUSSARELA')
  })

  it('⛔⛔ tamanho sem nº de sabores declarado: ZERO fatias e a régua PEDE a declaração', () => {
    const p = montarPizza({
      tamanho: { ...GRANDE, sabores: 0 }, escolhas: [], precoVenda: null, canais: [],
    })
    expect(p.fatias).toHaveLength(0)
    expect(p.incompleto.map((i) => i.motivo)).toContain('SEM_SABORES_DECLARADOS')
    expect(p.custoTotal).toBeNull()
  })

  it('⭐⭐ a sobra por canal com os números reais: R$ 89,90 de grande de filé com bacon', () => {
    const p = montarPizza({ tamanho: GRANDE, escolhas: [FILE_BACON, CALABRESA], precoVenda: 89.9, canais: [balcao, ifood] })
    const b = p.canais.find((c) => c.canal === 'balcão')!
    const i = p.canais.find((c) => c.canal === 'iFood')!
    expect(b.sobra).toBeCloseTo(89.9 - 25.57, 2)
    expect(i.taxaValor).toBeCloseTo(17.98, 2)
    expect(i.sobra).toBeCloseTo(89.9 - 17.98 - 25.57, 2)
    // ⚠️ o iFood come R$ 17,98 da mesma pizza — é esta a pergunta da bancada
    expect(b.sobra! - i.sobra!).toBeCloseTo(17.98, 2)
  })

  it('⭐ a família de 3 fatias: três ocorrências somadas', () => {
    const FAMILIA = {
      tamanho: 'FAMILIA', sabores: 3, derivadoDe: null,
      base: { fichaId: 'f:b3', nome: 'Pizza Família (45cm)', custo: 12.24 },
    }
    const p = montarPizza({
      tamanho: FAMILIA, escolhas: [FILE_BACON, CALABRESA, CALABRESA], precoVenda: null, canais: [],
    })
    expect(p.fatias).toHaveLength(3)
    expect(p.custoTotal).toBeCloseTo(12.24 + 13.18 + 4.23 + 4.23, 2)
  })

  it('⚠️ escolha além do nº de fatias é IGNORADA — a conta segue o tamanho, não o array', () => {
    const p = montarPizza({
      tamanho: GRANDE, escolhas: [FILE_BACON, CALABRESA, FILE_BACON], precoVenda: null, canais: [],
    })
    expect(p.fatias).toHaveLength(2)
    expect(p.custoSabores).toBeCloseTo(13.18 + 4.23, 2)
  })

  it('⭐ a lista de sabores põe quem TEM ficha primeiro — o sem-ficha não é escondido', () => {
    const l = ordenarSabores([
      { ...sabor('ZZZ', 1), temFicha: false },
      sabor('AAA', 1),
      { ...sabor('BBB', null), temFicha: false },
      sabor('CCC', 2),
    ])
    expect(l.map((s) => s.nome)).toEqual(['AAA', 'CCC', 'BBB', 'ZZZ'])
  })
})

/* ═══════════ A LINHA DA COBERTURA (o pé do placar, v3 — a referência) ═══════════ */

describe('⛔⛔ A LINHA DA COBERTURA — é ela que impede o veredito de ficar seco', () => {
  const texto = (casa: ReturnType<typeof casaDe>) =>
    linhaDaCobertura(casa).map((x) => x.texto).join('')

  it('⭐ ela diz a cobertura, quantos estão na obra e quantos estão fora', () => {
    const casa = casaDe({ custoFixo: 20_000, comp: 9_255.55 })
    const t = texto(casa)
    expect(t).toContain('cobertura: ')
    expect(t).toContain('das unidades vendidas têm custo')
    expect(t).toContain(`${casa.cobertura.produtosDentro} na obra`)
    expect(t).toContain(`${casa.cobertura.produtosFora} fora`)
  })

  it('⛔⛔ cobertura ABAIXO do mínimo: ela diz o LIMIAR e o que ele destrava', () => {
    const casa = casaDe({
      custoFixo: 20_000,
      linhas: [...PROD, linha({ chave: 'f:x', nome: 'XIS COMPLETO', vendasQtd: 470, custoUnitario: null, componentesSemCusto: 1 })],
    })
    expect(casa.cobertura.pct!).toBeLessThan(COBERTURA_MINIMA)
    const t = texto(casa)
    // ⚠️ o limiar vem da CONSTANTE, nunca digitado: número solto em tela vira a 2ª régua
    expect(t).toContain(`acima de ${Math.round(COBERTURA_MINIMA * 100)}%`)
    expect(t).toContain('eu digo o dia em que a casa se pagou')
    // ⛔ e o que é FORTE é a cobertura e o limiar — o que o olho tem que pegar
    const fortes = linhaDaCobertura(casa).filter((x) => x.forte).map((x) => x.texto)
    expect(fortes.some((x) => x.includes('das unidades vendidas têm custo'))).toBe(true)
    expect(fortes).toContain(`${Math.round(COBERTURA_MINIMA * 100)}%`)
  })

  it('⭐ com o DIA do placar conhecido, a linha NOMEIA o dia (e não repete o limiar)', () => {
    const casa = casaDe({ custoFixo: 20_000 })
    expect(casa.cobertura.pct).toBe(1)
    const comDia = { ...casa, placar: { dia: '2026-10-03', porque: null } }
    const t = linhaDaCobertura(comDia).map((x) => x.texto).join('')
    expect(t).toContain('a casa se pagou no dia 03/10')
    expect(t).not.toContain('acima de')
  })

  it('⛔⛔ cobertura boa e ainda SEM dia: o motivo é o do placar, não o do limiar', () => {
    // ⚠️ repetir a frase do limiar aqui mandaria o dono atacar a fila de fichas pelo motivo
    // errado — a cobertura dele já está acima do mínimo
    const casa = casaDe({ custoFixo: 10_000_000 })
    expect(casa.cobertura.pct).toBe(1)
    expect(casa.placar.dia).toBeNull()
    const t = texto(casa)
    expect(t).toContain(casa.placar.porque!)
    expect(t).not.toContain('acima de')
  })

  it('⛔ período SEM VENDA não vira "0% de cobertura" — ausência não é zero', () => {
    const t = texto(casaDe({ custoFixo: 20_000, linhas: [] }))
    expect(t).toContain('nenhuma venda no período')
    expect(t).not.toContain('0% das unidades')
  })
})

/* ═══════════ O AGREGADO DOS CARREGADORES (a linha "+N produtos", v3) ═══════════ */

describe('⭐ O AGREGADO — a tela NÃO soma, quem soma é a lib', () => {
  const muitos = [
    ...PROD,
    ...Array.from({ length: 9 }, (_, i) =>
      linha({ chave: `f:p${i}`, nome: `PEQUENO ${i}`, vendasQtd: 2, precoUsado: 30, custoUnitario: 10 }),
    ),
  ]

  it('⭐ ele carrega quantos, a soma, o % da casa e a barra relativa ao MAIOR', () => {
    const casa = casaDe({ custoFixo: 20_000, linhas: muitos })
    const l = montarCarregadores(casa, 0)
    expect(l.visiveis).toHaveLength(CARREGADORES_VISIVEIS)
    expect(l.agregado).not.toBeNull()
    expect(l.agregado!.quantos).toBe(l.resto.length)
    // ⛔ a soma do agregado é EXATAMENTE a soma do resto — senão a linha mentiria o tamanho
    const soma = l.resto.reduce((s, x) => s + x.sobraTotal, 0)
    expect(l.agregado!.sobraTotal).toBeCloseTo(soma, 2)
    expect(l.agregado!.pctDaCasa!).toBeCloseTo(soma / casa.custoFixo!, 4)
    expect(l.agregado!.pctDaBarra).toBeGreaterThan(0)
    expect(l.agregado!.pctDaBarra).toBeLessThanOrEqual(1)
  })

  it('⛔ sem resto não existe agregado — botão que não faz nada é ruído', () => {
    expect(montarCarregadores(casaDe({ custoFixo: 20_000 }), 0).agregado).toBeNull()
  })

  it('⛔ sem plano declarado o % do agregado é `null`, nunca 0%', () => {
    const l = montarCarregadores(casaDe({ custoFixo: null, linhas: muitos }), 0)
    expect(l.agregado!.pctDaCasa).toBeNull()
  })
})

/* ═══════════ A TAXA DO CANAL VIAJA PRA A TELA (v3 — "no iFood (taxa 20%)") ═══════════ */

describe('⭐ A TAXA DO CANAL — a tela escreve o número que a config declarou', () => {
  it('⭐ a taxa chega na saída, pra a tela dizer "(taxa 20%)" sem digitar o 20', () => {
    const ifood: CanalDeVenda = { id: 'c1', nome: 'iFood', taxaPct: 0.2, ativo: true }
    const r = sobraNoCanal(89.9, 26.88, ifood)
    expect(r.taxaPct).toBe(0.2)
    expect(r.sobra).toBeCloseTo(89.9 * 0.8 - 26.88, 2)
  })

  it('⛔⛔ taxa "a declarar" chega como `null` — e NUNCA como 0%', () => {
    const r = sobraNoCanal(89.9, 26.88, { id: 'c2', nome: 'novo', taxaPct: null, ativo: true })
    expect(r.taxaPct).toBeNull()
    expect(r.sobra).toBeNull()
    expect(r.porque).toContain('não foi declarada')
  })

  it('⭐ sem preço/custo a taxa continua VISÍVEL — ela é a config, não o resultado', () => {
    const ifood: CanalDeVenda = { id: 'c1', nome: 'iFood', taxaPct: 0.2, ativo: true }
    expect(sobraNoCanal(null, 26.88, ifood).taxaPct).toBe(0.2)
    expect(sobraNoCanal(89.9, null, ifood).taxaPct).toBe(0.2)
  })
})
