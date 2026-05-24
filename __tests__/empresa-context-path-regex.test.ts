// Sprint 4.0.5.a — testes da regex que extrai empresaId do path.

import { describe, it, expect } from 'vitest'
import { __test } from '@/lib/contexts/empresa-context'

const { PATH_EMPRESA_RE } = __test

describe('PATH_EMPRESA_RE', () => {
  it('extrai id de /empresas/<id>', () => {
    const m = '/empresas/cmpgapyt402pg2006sr8ozzz8'.match(PATH_EMPRESA_RE)
    expect(m?.[1]).toBe('cmpgapyt402pg2006sr8ozzz8')
  })

  it('extrai id de /empresas/<id>/dre', () => {
    const m = '/empresas/cmpgapyt402pg2006sr8ozzz8/dre'.match(PATH_EMPRESA_RE)
    expect(m?.[1]).toBe('cmpgapyt402pg2006sr8ozzz8')
  })

  it('extrai id de /empresas/<id>/contas/<contaId>', () => {
    const m = '/empresas/cmpgapyt402pg2006sr8ozzz8/contas/cmpgbcoa2034g2006x8zj09dt'.match(
      PATH_EMPRESA_RE,
    )
    expect(m?.[1]).toBe('cmpgapyt402pg2006sr8ozzz8')
  })

  it('NÃO bate em /empresas (lista)', () => {
    expect('/empresas'.match(PATH_EMPRESA_RE)).toBeNull()
  })

  it('NÃO bate em /empresas/nova (rota especial)', () => {
    const m = '/empresas/nova'.match(PATH_EMPRESA_RE)
    // "nova" tem só 4 chars, regex exige 20-30
    expect(m).toBeNull()
  })

  it('NÃO bate em /dashboard', () => {
    expect('/dashboard'.match(PATH_EMPRESA_RE)).toBeNull()
  })

  it('NÃO bate em /contas-a-pagar', () => {
    expect('/contas-a-pagar'.match(PATH_EMPRESA_RE)).toBeNull()
  })

  it('aceita id com letras maiúsculas (case insensitive)', () => {
    const m = '/empresas/CMPGAPYT402PG2006SR8OZZZ8'.match(PATH_EMPRESA_RE)
    expect(m?.[1]).toBe('CMPGAPYT402PG2006SR8OZZZ8')
  })

  it('NÃO bate quando id tem menos de 20 chars', () => {
    expect('/empresas/short123'.match(PATH_EMPRESA_RE)).toBeNull()
  })
})
