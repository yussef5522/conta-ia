// Sprint CSV Import (30/05/2026)

import { describe, it, expect } from 'vitest'
import {
  limparCategoria,
  detectarMultiCategoria,
} from '@/lib/csv-import/clean-categoria'

describe('limparCategoria', () => {
  it('"MATERIA PRIMA ( R$ 5.312,80 );" → "MATERIA PRIMA"', () => {
    expect(limparCategoria('MATERIA PRIMA ( R$ 5.312,80 );')).toBe(
      'MATERIA PRIMA',
    )
  })

  it('"ENERGIA ELETRICA ( R$ 129,68 );" → "ENERGIA ELETRICA"', () => {
    expect(limparCategoria('ENERGIA ELETRICA ( R$ 129,68 );')).toBe(
      'ENERGIA ELETRICA',
    )
  })

  it('"ENTREGADOR DELIVERY" → "ENTREGADOR DELIVERY" (sem embedded)', () => {
    expect(limparCategoria('ENTREGADOR DELIVERY')).toBe('ENTREGADOR DELIVERY')
  })

  it('"-" → ""', () => {
    expect(limparCategoria('-')).toBe('')
  })

  it('"" → ""', () => {
    expect(limparCategoria('')).toBe('')
  })

  it('null → ""', () => {
    expect(limparCategoria(null)).toBe('')
  })

  it('undefined → ""', () => {
    expect(limparCategoria(undefined)).toBe('')
  })

  it('whitespace → ""', () => {
    expect(limparCategoria('   ')).toBe('')
  })

  it('preserva acentos: "GRÁFICAS ESPECIAIS ( R$ 100,00 );" → "GRÁFICAS ESPECIAIS"', () => {
    expect(limparCategoria('GRÁFICAS ESPECIAIS ( R$ 100,00 );')).toBe(
      'GRÁFICAS ESPECIAIS',
    )
  })

  it('sem ";" no fim: "MATERIA PRIMA ( R$ 5,00 )" → "MATERIA PRIMA"', () => {
    expect(limparCategoria('MATERIA PRIMA ( R$ 5,00 )')).toBe('MATERIA PRIMA')
  })

  it('NUNCA mantém valor — só limpa texto', () => {
    const r = limparCategoria('OUTRO TESTE ( R$ -999.999,99 );')
    expect(r).toBe('OUTRO TESTE')
    expect(r).not.toContain('R$')
    expect(r).not.toContain('999')
  })
})

describe('detectarMultiCategoria', () => {
  it('simples "MATERIA PRIMA ( R$ 5,00 );" → contagem=1, temMultiplas=false', () => {
    const r = detectarMultiCategoria('MATERIA PRIMA ( R$ 5,00 );')
    expect(r.primeira).toBe('MATERIA PRIMA')
    expect(r.temMultiplas).toBe(false)
    expect(r.contagem).toBe(1)
    expect(r.todas).toEqual(['MATERIA PRIMA'])
  })

  it('multi: "MATERIA PRIMA ( R$ 1.144,08 );OUTRAS DESPESAS ACESSORIAS ( R$ 2,98 );"', () => {
    const raw = 'MATERIA PRIMA ( R$ 1.144,08 );OUTRAS DESPESAS ACESSORIAS ( R$ 2,98 );'
    const r = detectarMultiCategoria(raw)
    expect(r.primeira).toBe('MATERIA PRIMA')
    expect(r.temMultiplas).toBe(true)
    expect(r.contagem).toBe(2)
    expect(r.todas).toEqual(['MATERIA PRIMA', 'OUTRAS DESPESAS ACESSORIAS'])
  })

  it('3 categorias → todas=3, temMultiplas=true', () => {
    const raw = 'A ( R$ 1,00 );B ( R$ 2,00 );C ( R$ 3,00 );'
    const r = detectarMultiCategoria(raw)
    expect(r.contagem).toBe(3)
    expect(r.temMultiplas).toBe(true)
    expect(r.todas).toEqual(['A', 'B', 'C'])
  })

  it('sem embedded "ENTREGADOR DELIVERY" → contagem=0, primeira preserva texto', () => {
    const r = detectarMultiCategoria('ENTREGADOR DELIVERY')
    expect(r.primeira).toBe('ENTREGADOR DELIVERY')
    expect(r.temMultiplas).toBe(false)
    expect(r.contagem).toBe(0)
  })

  it('"-" → primeira="", contagem=0', () => {
    const r = detectarMultiCategoria('-')
    expect(r.primeira).toBe('')
    expect(r.temMultiplas).toBe(false)
    expect(r.contagem).toBe(0)
    expect(r.todas).toEqual([])
  })

  it('null/undefined → tudo vazio', () => {
    const r = detectarMultiCategoria(null)
    expect(r.primeira).toBe('')
    expect(r.contagem).toBe(0)
    expect(r.todas).toEqual([])
  })
})
