import { describe, it, expect } from 'vitest'
import { sugerirCategoria, sugerirUnidade, sugerirNome } from '../sugestoes'

describe('sugerirCategoria', () => {
  it('palavra-chave manda (o golden OLEO DE SOJA → matéria-prima)', () => {
    expect(sugerirCategoria('OLEO DE SOJA SOYA PET 900ML', '15079011')).toBe('MATERIA_PRIMA')
    expect(sugerirCategoria('REFRIGERANTE COLA 2L', '22021000')).toBe('REVENDA')
    expect(sugerirCategoria('DETERGENTE NEUTRO 500ML', '34022000')).toBe('LIMPEZA')
    expect(sugerirCategoria('SACO PLASTICO 5KG', '39232990')).toBe('EMBALAGEM')
    expect(sugerirCategoria('QUEIJO MUSSARELA', '04061010')).toBe('MATERIA_PRIMA')
  })
  it('NCM desempata quando não tem palavra conhecida', () => {
    expect(sugerirCategoria('PRODUTO XYZ', '22030000')).toBe('REVENDA') // cap 22 = bebida
    expect(sugerirCategoria('PRODUTO XYZ', '04000000')).toBe('MATERIA_PRIMA')
  })
  it('sem pista → USO_INTERNO (o dono decide, nunca inventa comida)', () => {
    expect(sugerirCategoria('ITEM DESCONHECIDO', '84713012')).toBe('USO_INTERNO')
  })
})

describe('sugerirUnidade', () => {
  it('mapeia uCom pra KG|UN|LT', () => {
    expect(sugerirUnidade('UN')).toBe('UN')
    expect(sugerirUnidade('KG')).toBe('KG')
    expect(sugerirUnidade('L')).toBe('LT')
    expect(sugerirUnidade('CX')).toBe('UN')
  })
  it('desconhecida → null (a definir, o dono escolhe)', () => {
    expect(sugerirUnidade('SC')).toBe(null)
    expect(sugerirUnidade(null)).toBe(null)
  })
})

describe('sugerirNome', () => {
  it('colapsa espaços do xProd', () => {
    expect(sugerirNome('OLEO DE SOJA SOYA PET          UND 900ML')).toBe('OLEO DE SOJA SOYA PET UND 900ML')
  })
  it('tira o prefixo numérico do código do fornecedor (bug do frigorífico)', () => {
    expect(sugerirNome('5 COXAO MOLE RESF BOV S/O (S/CAPA)')).toBe('COXAO MOLE RESF BOV S/O (S/CAPA)')
    expect(sugerirNome('4 ACEM C/PESC RESF BB BOV S/O (IND)')).toBe('ACEM C/PESC RESF BB BOV S/O (IND)')
  })
  it('NÃO tira número quando ele faz parte do nome (ex: sem letra depois)', () => {
    expect(sugerirNome('900ML SUCO')).toBe('900ML SUCO') // "900ML" não é só dígitos+espaço
    expect(sugerirNome('2 LITROS REFRIGERANTE')).toBe('LITROS REFRIGERANTE') // "2 " prefixo → tira (aceitável; dono renomeia)
  })
})
