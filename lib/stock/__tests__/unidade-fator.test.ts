// ESTOQUE — sugestão do fator de conversão. Caso real que motivou o composto (23/08):
// "PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC · 1 CX · R$ 683,76/CX" — caixa com 8 peças
// de 2,27 KG. O parser antigo não pegava NADA ("CX/08" não casa com `CX\d+`, a barra
// quebra) e o campo ficava vazio e mudo.

import { describe, it, expect } from 'vitest'
import { sugerirFator, placeholderFator } from '../unidade-fator'

const CHEDDAR = 'PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC'
const PRECO_CX = 683.76

describe('COMPOSTO — o caso real do cheddar, nos dois caminhos', () => {
  it('controle em KG: sugere 8 × 2,27 = 18,16 e MOSTRA a conta', () => {
    const s = sugerirFator({ xProd: CHEDDAR, unidadeControle: 'KG', uCom: 'CX', vUnCom: PRECO_CX })
    expect(s.fator).toBe(18.16)
    expect(s.origem).toBe('composto')
    expect(s.explicacao).toContain('8 pç')
    expect(s.explicacao).toContain('2,27')
    expect(s.explicacao).toContain('18,16 KG')
    expect(s.explicacao).toContain('37,65') // 683,76 / 18,16 = R$ 37,65/KG
  })

  it('controle em UN (peça): sugere 8 e mostra o preço por peça', () => {
    const s = sugerirFator({ xProd: CHEDDAR, unidadeControle: 'UN', uCom: 'CX', vUnCom: PRECO_CX })
    expect(s.fator).toBe(8)
    expect(s.origem).toBe('composto')
    expect(s.explicacao).toContain('8 peças')
    expect(s.explicacao).toContain('85,47') // 683,76 / 8 = R$ 85,47/peça
  })

  it('sem preço na mão, a conta aparece igual (só sem o R$)', () => {
    const s = sugerirFator({ xProd: CHEDDAR, unidadeControle: 'KG', uCom: 'CX' })
    expect(s.fator).toBe(18.16)
    expect(s.explicacao).toContain('18,16 KG')
    expect(s.explicacao).not.toContain('R$')
  })
})

describe('COMPOSTO — variantes de escrita', () => {
  it.each([
    ['CAIXA MUSSARELA 3 KG CX/04 PC', 'KG', 12],
    ['QUEIJO PRATO C/6 PC 1,5KG', 'KG', 9],
    ['MANTEIGA 8 PC X 500 G', 'KG', 4], // 500 G = 0,5 KG → 8 × 0,5
    ['REQUEIJAO CX/12 PECAS 0,4 KG', 'KG', 4.8],
  ])('%s (controle %s) → fator %s', (nome, un, esperado) => {
    expect(sugerirFator({ xProd: nome, unidadeControle: un }).fator).toBe(esperado)
  })

  it('peças em ML com controle em LT converte certo', () => {
    const s = sugerirFator({ xProd: 'CREME DE LEITE CX/12 PC 200 ML', unidadeControle: 'LT' })
    expect(s.fator).toBe(2.4) // 12 × 0,2 L
  })

  it('mesmo composto, controle em UN ignora o peso', () => {
    expect(sugerirFator({ xProd: 'CAIXA MUSSARELA 3 KG CX/04 PC', unidadeControle: 'UN' }).fator).toBe(4)
  })
})

describe('PRIORIDADE — qTrib/uTrib da nota ganha de tudo', () => {
  it('nota bem preenchida manda, mesmo com composto no nome', () => {
    const s = sugerirFator({ xProd: CHEDDAR, unidadeControle: 'KG', uCom: 'CX', fatorNota: 18.16, vUnCom: PRECO_CX })
    expect(s.fator).toBe(18.16)
    expect(s.origem).toBe('nota')
    expect(s.explicacao).toContain('a nota diz')
  })

  it('e ganha mesmo quando discorda do nome (a nota é a fonte)', () => {
    const s = sugerirFator({ xProd: CHEDDAR, unidadeControle: 'KG', fatorNota: 20 })
    expect(s.fator).toBe(20)
    expect(s.origem).toBe('nota')
  })
})

describe('PACK SIMPLES — o que já funcionava continua', () => {
  it.each([
    ['FRUKI GUARANA 600ML PET 12UN', 12],
    ['REFRIGERANTE C/6', 6],
    ['CERVEJA CX24', 24],
    ['AGUA FD 12', 12],
  ])('%s (controle UN) → %s', (nome, esperado) => {
    expect(sugerirFator({ xProd: nome, unidadeControle: 'UN' }).fator).toBe(esperado)
  })

  it('pack simples com controle em KG NÃO chuta (12UN não diz quantos KG)', () => {
    expect(sugerirFator({ xProd: 'FRUKI GUARANA 600ML PET 12UN', unidadeControle: 'KG' }).fator).toBeNull()
  })
})

describe('NÃO CHUTA quando não há sinal claro', () => {
  it.each([
    ['CERV SKOL 600ML', 'UN'], // o dono digita 20/24 — chutar aqui foi o bug da Skol
    ['PIZZA FAMILIA 45CM', 'UN'], // 45CM não é pack
    ['OLEO DE SOJA 900ML', 'KG'],
  ])('%s → null', (nome, un) => {
    expect(sugerirFator({ xProd: nome, unidadeControle: un }).fator).toBeNull()
  })

  it('achou as peças mas não o peso: em KG prefere PERGUNTAR a multiplicar errado', () => {
    const s = sugerirFator({ xProd: 'QUEIJO CX/08 PC', unidadeControle: 'KG' })
    expect(s.fator).toBeNull()
    // ...mas em UN a mesma nota resolve, porque o peso não importa
    expect(sugerirFator({ xProd: 'QUEIJO CX/08 PC', unidadeControle: 'UN' }).fator).toBe(8)
  })

  it('nome vazio não estoura', () => {
    expect(sugerirFator({ xProd: '', unidadeControle: 'KG' }).fator).toBeNull()
  })
})

describe('placeholderFator — campo vazio PERGUNTA em vez de ficar mudo', () => {
  it('monta a pergunta com as duas unidades', () => {
    expect(placeholderFator('KG', 'CX')).toBe('quantas KG tem 1 CX?')
    expect(placeholderFator('UN', 'FD')).toBe('quantas UN tem 1 FD?')
  })
  it('sem a unidade da nota, assume CX', () => {
    expect(placeholderFator('KG')).toBe('quantas KG tem 1 CX?')
  })
})
