// ⭐⭐ O CARDÁPIO POR SEÇÕES (08/09/2026) — as seções são do dono, a régua é config.
//
// *"A classificação inicial não pode ser 156 cliques meus (…) heurística sugere, eu bato o
// martelo — mas num gesto, não em 156."*
//
// ⛔ O que este arquivo mais protege é a FRONTEIRA da régua: palavra que não bate **não
// vira palpite**. Nome desconhecido em Outros é 1 clique; nome na seção errada é um número
// errado no relatório de cobertura — e ninguém desconfia de número.

import { describe, it, expect } from 'vitest'
import {
  sugerirSecao, agruparPorSecao, montarLote, SECOES_SEED, SECAO_PADRAO,
} from '../secoes'

describe('⭐ a régua de palavras, ditada pelo dono', () => {
  const casos: [string, string][] = [
    ['XIS SALADA', 'XIS'],
    ['xis coração', 'XIS'],
    ['X-BURGER ARTESANAL', 'BURGERS'],
    ['SMASH BURGER DUPLO', 'BURGERS'],
    ['PIZZA CALABRESA GRANDE', 'PIZZAS'],
    ['PROMO PIZZAS 2 SABORES', 'PIZZAS'],
    ['COCA COLA 2L', 'BEBIDAS'],
    ['FRUKI GUARANA 600ML', 'BEBIDAS'],
    ['SPRITE LATA', 'BEBIDAS'],
    ['CACHORRO QUENTE SIMPLES', 'LANCHES'],
    ['HOT DOG ESPECIAL', 'LANCHES'],
    ['TORRADA COMPLETA', 'LANCHES'],
    ['PORCAO DE FRITAS', 'PORCOES'],
    ['MINI FRITAS', 'PORCOES'],
    ['BATATA FRITA GRANDE', 'PORCOES'],
    ['POLENTA FRITA', 'PORCOES'],
    ['FRANGO FRITO INTEIRO', 'FRANGO_FRITO'],
    ['FRANGO A PASSARINHO', 'FRANGO_FRITO'],
    ['A LA MINUTA DE FILE', 'PRATOS'],
    ['PUDIM DE LEITE', 'DOCES'],
  ]
  it.each(casos)('"%s" → %s', (nome, secao) => {
    expect(sugerirSecao(nome).secao).toBe(secao)
  })

  // ⚠️⚠️ ESTE TESTE FOI REESCRITO PORQUE NÃO MORDIA (REGRA 11, 08/09). A versão anterior
  // dizia "FRANGO FRITO vem antes de FRITAS senão cairia em Porções pelo FRIT" — repus o
  // defeito movendo a regra pro fim da lista e **nenhum teste ficou vermelho**: a borda de
  // palavra já separa FRITO de FRITAS, então a ordem não fazia diferença ali.
  //
  // ⭐ Onde a ordem MORDE é no nome que casa em DUAS regras INTEIRAS.
  it('⛔⛔ A ORDEM DAS REGRAS É A REGRA: o específico ganha do genérico', () => {
    // "PORCAO DE FRANGO FRITO" bate em FRANGO FRITO **e** em PORCAO — a primeira decide
    expect(sugerirSecao('PORCAO DE FRANGO FRITO').secao).toBe('FRANGO_FRITO')
    expect(sugerirSecao('PORCAO DE FRANGO FRITO').porQue).toBe('FRANGO FRITO')
    // e o genérico sozinho continua indo pra Porções
    expect(sugerirSecao('PORCAO DE FRITAS').secao).toBe('PORCOES')
  })

  it('⭐ a sugestão diz QUAL palavra decidiu — sugestão sem motivo é adivinhação', () => {
    expect(sugerirSecao('COCA COLA 2L').porQue).toBe('COCA')
    expect(sugerirSecao('XIS SALADA').porQue).toBe('XIS')
  })
})

describe('⛔⛔ A FRONTEIRA: palavra que não bate NÃO vira palpite', () => {
  it('nome desconhecido cai em Outros, com porquê NULO', () => {
    const s = sugerirSecao('COMBO ESPECIAL DA CASA')
    expect(s.secao).toBe(SECAO_PADRAO)
    expect(s.porQue).toBeNull()
  })

  it('⛔ a borda de PALAVRA é o que separa regra de acaso', () => {
    // sem a borda, "AGUA" casaria dentro de GUARDANAPO e "LATA" dentro de SALATA
    expect(sugerirSecao('GUARDANAPO').secao).toBe(SECAO_PADRAO)
    expect(sugerirSecao('SALATA MISTA').secao).not.toBe('BEBIDAS')
    // e a palavra inteira continua casando
    expect(sugerirSecao('AGUA MINERAL').secao).toBe('BEBIDAS')
    expect(sugerirSecao('COCA LATA').secao).toBe('BEBIDAS')
  })

  it('nome vazio não explode — cai em Outros', () => {
    expect(sugerirSecao('').secao).toBe(SECAO_PADRAO)
  })
})

// ────────────────────────────────────────────────────────────────

const l = (o: Partial<Parameters<typeof agruparPorSecao>[0][number]> & { chave: string; secao: string }) => ({
  nome: o.chave, nomesSuitable: [o.chave], sugerida: false, temFicha: false, vendasQtd: 0, ...o,
})

describe('⭐ o header de cada seção soma CERTO', () => {
  const grupos = agruparPorSecao([
    l({ chave: 'XIS SALADA', secao: 'XIS', temFicha: true, vendasQtd: 40 }),
    l({ chave: 'XIS BACON', secao: 'XIS', temFicha: true, vendasQtd: 30 }),
    l({ chave: 'XIS TUDO', secao: 'XIS', temFicha: false, vendasQtd: 10 }),
    l({ chave: 'COCA 2L', secao: 'BEBIDAS', temFicha: true, vendasQtd: 5 }),
  ], SECOES_SEED)

  it('⛔ comFicha + semFicha === total, sempre', () => {
    for (const g of grupos) expect(g.comFicha + g.semFicha).toBe(g.total)
  })

  it('a cobertura é a fração de quem tem ficha', () => {
    const xis = grupos.find((g) => g.secao === 'XIS')!
    expect(xis).toMatchObject({ total: 3, comFicha: 2, semFicha: 1, vendasQtd: 80 })
    expect(xis.cobertura).toBeCloseTo(2 / 3)
  })

  it('⚠️ seção VAZIA aparece com zero — e cobertura NULL, não 0%', () => {
    const doces = grupos.find((g) => g.secao === 'DOCES')!
    expect(doces.total).toBe(0)
    // 0% afirmaria "nada coberto"; a resposta honesta é "não há o que cobrir"
    expect(doces.cobertura).toBeNull()
  })

  it('⭐ vem na ORDEM DO DONO, não em ordem alfabética nem por tamanho', () => {
    expect(grupos.map((g) => g.secao).slice(0, 4)).toEqual(['XIS', 'BURGERS', 'LANCHES', 'PORCOES'])
    expect(grupos[grupos.length - 1].secao).toBe(SECAO_PADRAO)
  })

  it('⛔ seção que não existe mais na lista do dono cai em Outros — nunca some', () => {
    const g = agruparPorSecao([l({ chave: 'ORFAO', secao: 'SECAO_APAGADA' })], SECOES_SEED)
    expect(g.find((x) => x.secao === SECAO_PADRAO)!.total).toBe(1)
    expect(g.reduce((s, x) => s + x.total, 0)).toBe(1)   // ninguém sumiu no caminho
  })
})

describe('⭐⭐ o LOTE de revisão: um gesto, não 156', () => {
  const produtos = [
    { chave: 'a', nome: 'XIS SALADA', nomesSuitable: ['XIS SALADA'], vendasQtd: 40 },
    { chave: 'b', nome: 'XIS BACON', nomesSuitable: ['XIS BACON'], vendasQtd: 30 },
    { chave: 'c', nome: 'COCA COLA 2L', nomesSuitable: ['COCA COLA 2L'], vendasQtd: 20 },
    { chave: 'd', nome: 'COMBO DA CASA', nomesSuitable: ['COMBO DA CASA'], vendasQtd: 90 },
    { chave: 'e', nome: 'MINI FRITAS', nomesSuitable: ['MINI FRITAS'], vendasQtd: 165 },
  ]

  it('agrupa pela sugestão, com o motivo de cada um', () => {
    const lote = montarLote(produtos, new Set())
    expect(lote.total).toBe(5)
    const xis = lote.grupos.find((g) => g.secao === 'XIS')!
    expect(xis.itens.map((i) => i.nome)).toEqual(['XIS SALADA', 'XIS BACON'])
    expect(xis.itens[0].porQue).toBe('XIS')
  })

  it('⚠️ OUTROS por último, mesmo sendo grande — é a pilha do "não sei"', () => {
    const lote = montarLote(produtos, new Set())
    expect(lote.grupos[lote.grupos.length - 1].secao).toBe(SECAO_PADRAO)
    // ⛔ e o número honesto do trabalho que sobra fica à vista
    expect(lote.semRegra).toBe(1)
  })

  it('⛔ quem o dono JÁ confirmou não volta pro lote — decisão pronta não se reabre', () => {
    const lote = montarLote(produtos, new Set(['a', 'b']))
    expect(lote.total).toBe(3)
    expect(lote.grupos.some((g) => g.secao === 'XIS')).toBe(false)
  })

  it('dentro do grupo, o que mais vende vem primeiro', () => {
    const lote = montarLote(produtos, new Set())
    const porcoes = lote.grupos.find((g) => g.secao === 'PORCOES')!
    expect(porcoes.itens[0].nome).toBe('MINI FRITAS')   // 165 — o caso do banner
  })

  it('lista vazia é lista vazia, não erro', () => {
    expect(montarLote([], new Set())).toEqual({ grupos: [], total: 0, semRegra: 0 })
  })
})

// ────────────────────────────────────────────────────────────────
// ⭐ A RESOLUÇÃO DA SEÇÃO DE UMA LINHA — a decisão do dono ganha da sugestão
// ────────────────────────────────────────────────────────────────

import { secaoDaLinha } from '../secoes-db'

describe('a seção vigente de uma linha do hub', () => {
  const g = (m: Record<string, { secao: string; sugerida: boolean }>) =>
    new Map(Object.entries(m).map(([k, v]) => [k, { ...v, porQue: null }]))

  it('⛔⛔ a CONFIRMADA ganha de qualquer sugestão, venha em que apelido vier', () => {
    // o apelido novo chegou com sugestão automática; a decisão do dono está no outro
    const r = secaoDaLinha(['XIS NOVO', 'XIS SALADA'],
      g({ 'XIS NOVO': { secao: 'OUTROS', sugerida: true }, 'XIS SALADA': { secao: 'XIS', sugerida: false } }),
      'XIS SALADA')
    expect(r).toMatchObject({ secao: 'XIS', sugerida: false })
  })

  it('só sugestões: vale a primeira', () => {
    const r = secaoDaLinha(['A', 'B'],
      g({ A: { secao: 'BEBIDAS', sugerida: true }, B: { secao: 'XIS', sugerida: true } }), 'A')
    expect(r).toMatchObject({ secao: 'BEBIDAS', sugerida: true })
  })

  it('⚠️ nada gravado: a régua sugere na hora, mas a leitura NÃO escreve', () => {
    const r = secaoDaLinha(['COCA COLA 2L'], new Map(), 'COCA COLA 2L')
    expect(r).toMatchObject({ secao: 'BEBIDAS', sugerida: true, porQue: 'COCA' })
  })

  it('nome que a régua não conhece cai em Outros, como proposta', () => {
    expect(secaoDaLinha(['ZZZ'], new Map(), 'ZZZ')).toMatchObject({ secao: 'OUTROS', sugerida: true })
  })
})
