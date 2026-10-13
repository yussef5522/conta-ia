/**
 * ⭐⭐ "ESCOLHA UM PRODUTO" — os vermelhos do dono (13/10/2026).
 *
 * *"produto sem ficha mostrando um número de custo/ideal = vermelho · busca de produto sem
 * casaBusca (includes/toLowerCase cru) = vermelho"* — mais a régua dele do teto por
 * categoria num mapa único e o *"sem venda no período"* com campo vazio.
 */
import { describe, it, expect } from 'vitest'
import type { LinhaCardapio } from '@/lib/stock/cardapio/hub'
import type { SecaoDoNome } from '@/lib/stock/cardapio/secoes-db'
import {
  filtrarProdutosDoVeredito,
  montarProdutosDoVeredito,
} from '../produto-do-veredito'
import { farolDoPreco, precosIdeais } from '../veredito-de-preco'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo'

function linha(p: Partial<LinhaCardapio> & { nome: string }): LinhaCardapio {
  return {
    chave: `ficha:${p.nome}`,
    nomesSuitable: [p.nome.toUpperCase()],
    destinoTipo: 'FICHA',
    fichaId: `f-${p.nome}`,
    itemId: null,
    baixaItemId: null,
    status: 'FICHA_OK' as LinhaCardapio['status'],
    vendasQtd: 10,
    vendasValor: 299,
    custoUnitario: 13.4,
    componentesSemCusto: 0,
    custoParcial: 13.4,
    precoCardapio: null,
    precoPraticado: 29.9,
    precoUsado: 29.9,
    precoOrigem: 'praticado',
    margem: null,
    ...p,
  } as LinhaCardapio
}

const semSecoes = new Map<string, SecaoDoNome>()

describe('⭐ A LISTA — tradução, com a seção e a régua de cada um', () => {
  it('ordena pelo que mais vendeu — é o que move o bolso', () => {
    const ps = montarProdutosDoVeredito(
      [
        linha({ nome: 'prato alaminuta', vendasQtd: 4 }),
        linha({ nome: 'xis completo', vendasQtd: 137 }),
        linha({ nome: 'porcao frango', vendasQtd: 51 }),
      ],
      semSecoes,
      EMPRESA,
    )
    expect(ps.map((p) => p.nome)).toEqual(['xis completo', 'porcao frango', 'prato alaminuta'])
  })

  it('⭐ a seção vem da régua do CARDÁPIO e o teto do mapa único', () => {
    const ps = montarProdutosDoVeredito(
      [
        linha({ nome: 'XIS COMPLETO' }),
        linha({ nome: 'PIZZA GRANDE 35CM' }),
        linha({ nome: 'PORCAO DE FRANGO FRITO' }),
        linha({ nome: 'PRATO ALAMINUTA' }),
      ],
      semSecoes,
      EMPRESA,
    )
    const por = (n: string) => ps.find((p) => p.nome === n)!

    expect(por('XIS COMPLETO').secao).toBe('XIS')
    expect(por('XIS COMPLETO').regua.tetoPct).toBe(35)
    expect(por('PIZZA GRANDE 35CM').secao).toBe('PIZZAS')
    expect(por('PIZZA GRANDE 35CM').regua.tetoPct).toBe(33)
    // ⭐ o específico ganha do genérico: "FRANGO FRITO" vem antes de "PORCAO" na régua
    expect(por('PORCAO DE FRANGO FRITO').secao).toBe('FRANGO_FRITO')
    expect(por('PORCAO DE FRANGO FRITO').regua.tetoPct).toBe(40)
    expect(por('PRATO ALAMINUTA').regua.tetoPct).toBe(40)
  })

  it('⚠️ a seção CONFIRMADA pelo dono ganha da sugestão da régua', () => {
    const gravadas = new Map<string, SecaoDoNome>([
      ['XIS COMPLETO', { secao: 'LANCHES', sugerida: false, porQue: null }],
    ])
    const [p] = montarProdutosDoVeredito([linha({ nome: 'XIS COMPLETO' })], gravadas, EMPRESA)
    expect(p.secao).toBe('LANCHES')
    expect(p.secaoSugerida, 'decisão do dono não é proposta').toBe(false)
  })

  it('a sugestão não confirmada vem MARCADA — a tela mostra que é proposta', () => {
    const [p] = montarProdutosDoVeredito([linha({ nome: 'XIS COMPLETO' })], semSecoes, EMPRESA)
    expect(p.secaoSugerida).toBe(true)
  })

  it('⭐ o toque abre a FICHA — cartão que cobra sem dar o caminho é cobrança', () => {
    const [p] = montarProdutosDoVeredito([linha({ nome: 'xis' })], semSecoes, EMPRESA)
    expect(p.href).toBe(`/empresas/${EMPRESA}/estoque/fichas/f-xis`)
  })
})

describe('⛔⛔ SEM FICHA — zero número inventado', () => {
  const semFicha = linha({
    nome: 'porcao frango frito',
    custoUnitario: null,
    custoParcial: 0,
    componentesSemCusto: 2,
  })

  it('⛔ VERMELHO DO DONO: custo `null`, nunca 0 — e o porquê está DITO', () => {
    const [p] = montarProdutosDoVeredito([semFicha], semSecoes, EMPRESA)
    expect(p.custo).toBeNull()
    expect(p.temFicha).toBe(false)
    expect(p.porque).toContain('2 componente(s)')
  })

  it('⛔ VERMELHO DO DONO: o farol fica NEUTRO e os canais ficam "a apurar"', () => {
    const [p] = montarProdutosDoVeredito([semFicha], semSecoes, EMPRESA)

    const f = farolDoPreco(p.custo, p.preco, p.regua.tetoPct)
    expect(f.tom).toBe('neutro')
    expect(f.rotulo, 'número de CMV num produto sem ficha é palpite obedecido').not.toMatch(/\d/)

    const canais = precosIdeais(p.custo, p.regua.alvosPct[1], [
      { canal: 'balcão', taxaPct: 0 },
      { canal: 'iFood', taxaPct: 0.2 },
    ])
    expect(canais.every((c) => c.preco === null && c.sobra === null)).toBe(true)
  })

  it('produto sem ficha mas com custo PARCIAL guarda o piso — nunca no lugar do total', () => {
    const [p] = montarProdutosDoVeredito(
      [linha({ nome: 'xis', custoUnitario: null, custoParcial: 8.58, componentesSemCusto: 1 })],
      semSecoes,
      EMPRESA,
    )
    expect(p.custo, 'o fechado continua a apurar').toBeNull()
    expect(p.custoParcial).toBe(8.58)
  })
})

describe('⛔ SEM VENDA NO PERÍODO — campo vazio, nunca R$ 0,00', () => {
  it('preço `null` e o porquê escrito', () => {
    const [p] = montarProdutosDoVeredito(
      [linha({ nome: 'xis novo', vendasQtd: 0, vendasValor: 0, precoPraticado: null, precoUsado: null })],
      semSecoes,
      EMPRESA,
    )
    expect(p.preco).toBeNull()
    expect(p.porque).toBe('sem venda no período')
    expect(farolDoPreco(p.custo, p.preco, p.regua.tetoPct).tom).toBe('neutro')
  })

  it('⚠️ sem venda MAS com preço de cardápio, o preço do cardápio vale — e a origem DIZ', () => {
    const [p] = montarProdutosDoVeredito(
      [
        linha({
          nome: 'xis sazonal',
          vendasQtd: 0,
          vendasValor: 0,
          precoPraticado: null,
          precoCardapio: 31.9,
          precoUsado: 31.9,
          precoOrigem: 'cardapio',
        }),
      ],
      semSecoes,
      EMPRESA,
    )
    expect(p.preco).toBe(31.9)
    expect(p.precoOrigem, 'a tela tem que poder dizer que não é média real do PDV').toBe('cardapio')
    expect(p.porque).toBeNull()
  })
})

describe('⛔⛔ A BUSCA — pela casaBusca, nunca includes cru', () => {
  const ps = montarProdutosDoVeredito(
    [
      linha({ nome: 'porçao frango 100 grama' }),
      linha({ nome: 'XIS COMPLETO', nomesSuitable: ['XIS - COMPLETO', 'XIS COMPLETO'] }),
      linha({ nome: 'Coxão mole acebolado' }),
    ],
    semSecoes,
    EMPRESA,
  )

  it('⛔ VERMELHO DO DONO: "porcao" SEM acento acha "porçao" COM acento', () => {
    expect(filtrarProdutosDoVeredito(ps, 'porcao').map((p) => p.nome)).toEqual([
      'porçao frango 100 grama',
    ])
    // o contrafactual: a régua crua acharia ZERO — é o bug de 08/09
    expect('porçao frango 100 grama'.toLowerCase().includes('porcao')).toBe(false)
  })

  it('caixa não separa nada, nos dois sentidos', () => {
    expect(filtrarProdutosDoVeredito(ps, 'COXAO')).toHaveLength(1)
    expect(filtrarProdutosDoVeredito(ps, 'xis')).toHaveLength(1)
  })

  it('palavra em QUALQUER ordem — o nome vem do PDV, não da cabeça do dono', () => {
    expect(filtrarProdutosDoVeredito(ps, 'frango porcao')).toHaveLength(1)
  })

  it('⭐ acha pelo APELIDO do PDV também', () => {
    expect(filtrarProdutosDoVeredito(ps, 'xis - completo')).toHaveLength(1)
  })

  it('termo vazio devolve a lista inteira; termo que não casa devolve vazio', () => {
    expect(filtrarProdutosDoVeredito(ps, '')).toHaveLength(3)
    expect(filtrarProdutosDoVeredito(ps, 'zzz')).toHaveLength(0)
  })
})
