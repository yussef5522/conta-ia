// ⭐ A RÉGUA DO NOME LIMPO, contra os nomes REAIS que estão em prod (09/09/2026).
//
// ⚠️ Cada caso abaixo é um item que existe hoje na Posição da Caçula — nada inventado.

import { describe, it, expect } from 'vitest'
import { sugerirNomeLimpo, pareceNomeDeNota } from '../nome-limpo'

const limpo = (n: string) => sugerirNomeLimpo(n).sugestao

describe('⭐ os nomes reais da Posição', () => {
  it('⭐ expande a sigla da marca e tira embalagem+pack', () => {
    expect(limpo('CC 600 PET 12')).toBe('COCA COLA 600')
    expect(limpo('CC Zero PET 2L 8U FL')).toBe('COCA COLA ZERO 2L')
    expect(limpo('CC Zero PET 600ml 12U FL')).toBe('COCA COLA ZERO 600ML')
  })

  it('⭐ DV vira DEL VALLE e LT vira LATA — sem perder o sabor', () => {
    // ⚠️ o nome do CARDÁPIO aqui é "SUCO DELL VALE", que PERDE o UVA. Por isso a régua
    // mecânica manda, e o cardápio é só atalho.
    expect(limpo('DV UVA LT 290ML 6U FL')).toBe('DEL VALLE UVA LATA 290ML')
    expect(limpo('DV PESSEGO LT 290ML 6U FL')).toBe('DEL VALLE PESSEGO LATA 290ML')
  })

  it('⭐⭐ o caso do código do fornecedor + litro fracionado', () => {
    // 0.60GFA é como a cervejaria escreve 600ml
    expect(limpo('0000903482 - CERV HEINEKEN PIL 0.60GFA RT 24UN')).toBe('CERVEJA HEINEKEN PILSEN 600ML')
  })

  it('⭐ espaço duplo do sistema do fornecedor some', () => {
    expect(limpo('COCA-COLA  2L')).toBe('COCA COLA 2L')
    expect(limpo('ORIGINAL  cerveja 600ML')).toBe('ORIGINAL CERVEJA 600ML')
  })

  it('⭐ o bloco de embalagem do fim sai inteiro', () => {
    expect(limpo('COPO PET TRANSP F9240 400ML [1 / 10 / 50 / 400]')).toBe('COPO TRANSP F9240 400ML')
    expect(limpo('KID CASCAO MARVI C/ 10 UN [1 / 12]')).toBe('KID CASCAO MARVI')
  })

  it('⭐ LIGHT ZERO vira só ZERO (o dono fala um)', () => {
    expect(limpo('FRUKI GUARANA LIGHT ZERO 350ML LATA 12UN')).toBe('FRUKI GUARANA ZERO 350ML LATA')
  })

  it('⛔ NUNCA devolve vazio — nome que a régua zeraria volta como veio', () => {
    expect(limpo('12UN')).toBeTruthy()
    expect(limpo('PET')).toBeTruthy()
  })

  it('⭐ e diz o QUE fez — a tela mostra pra ele saber se confia', () => {
    const r = sugerirNomeLimpo('0000903482 - CERV HEINEKEN PIL 0.60GFA RT 24UN')
    expect(r.porque).toContain('tirou o código do fornecedor')
    expect(r.porque).toContain('normalizou o tamanho')
  })

  it('⭐ o nome do cardápio vem junto, como ATALHO — nunca por cima', () => {
    const r = sugerirNomeLimpo('DV UVA LT 290ML 6U FL', { doCardapio: 'SUCO DELL VALE' })
    expect(r.sugestao).toBe('DEL VALLE UVA LATA 290ML') // a régua manda
    expect(r.doCardapio).toBe('SUCO DELL VALE') // e o atalho fica disponível
  })
})

describe('⭐ o filtro da tela erra pro lado de INCLUIR', () => {
  it('pega as marcas de nome-de-nota', () => {
    for (const n of [
      '0000903482 - CERV HEINEKEN', 'CC Zero PET 2L 8U FL', 'SACO LIXO ITO 200LT C/5',
      'COPO PET TRANSP 400ML [1 / 10]', 'COCA-COLA  2L',
    ]) expect(pareceNomeDeNota(n), n).toBe(true)
  })

  it('⛔ e deixa em paz o que já está limpo', () => {
    for (const n of ['Coxão Mole', 'FANTA UVA 2L', 'beef de xis', 'porcao bacon 80 grama']) {
      expect(pareceNomeDeNota(n), n).toBe(false)
    }
  })
})

describe('⚠️ as duas armadilhas que só o dado REAL de prod mostrou', () => {
  it('⛔⛔ LT é LATA **ou** LITRO — o ML na linha é quem decide', () => {
    // a lata de suco: tem 290ML ao lado → LT é LATA
    expect(limpo('DV UVA LT 290ML 6U FL')).toBe('DEL VALLE UVA LATA 290ML')
    // ⛔ a caixa de leite: NÃO tem ML → "1 LT" é 1 LITRO, e virar "1 LATA" seria mentira
    expect(limpo('LEITE UHT INTEGRAL DALIA EDGE CX 12 X 1 LT')).toContain('1 LT')
    expect(limpo('LEITE UHT INTEGRAL DALIA EDGE CX 12 X 1 LT')).not.toContain('LATA')
    // e o LT grudado no número (200LT = 200 litros) nunca foi tocado
    expect(limpo('SACO LIXO ITO 200LT C/5')).toBe('SACO LIXO ITO 200LT')
  })

  it('⛔ a barra órfã que sobra quando o CX sai', () => {
    // "CX/08 PC" → o CX some e deixava " /08 " no meio do nome
    expect(limpo('PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC')).toBe('PREPARO SABOR CHEDDAR 2,27KG')
  })
})
