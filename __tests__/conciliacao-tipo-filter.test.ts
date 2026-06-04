// Sprint A-effected Fase A — testes do helper de tipo de conciliação.

import { describe, it, expect } from 'vitest'
import {
  getTipoFilter,
  defaultTipoForCompany,
  parseTipoParam,
} from '@/lib/conciliacao/tipo-filter'

describe('getTipoFilter', () => {
  it('apenas-pagamentos → { type: DEBIT }', () => {
    expect(getTipoFilter('apenas-pagamentos')).toEqual({ type: 'DEBIT' })
  })

  it('apenas-recebimentos → { type: CREDIT }', () => {
    expect(getTipoFilter('apenas-recebimentos')).toEqual({ type: 'CREDIT' })
  })

  it('todos → objeto vazio (sem filtro)', () => {
    expect(getTipoFilter('todos')).toEqual({})
  })
})

describe('defaultTipoForCompany — heurística por tipo de empresa', () => {
  it('restaurant (Cacula Mix) → apenas-pagamentos', () => {
    expect(defaultTipoForCompany('restaurant')).toBe('apenas-pagamentos')
  })

  it('retail (lojas) → apenas-pagamentos', () => {
    expect(defaultTipoForCompany('retail')).toBe('apenas-pagamentos')
  })

  it('industry (indústrias) → apenas-pagamentos', () => {
    expect(defaultTipoForCompany('industry')).toBe('apenas-pagamentos')
  })

  it('service (academia) → todos (mensalidade é AR cadastrada)', () => {
    expect(defaultTipoForCompany('service')).toBe('todos')
  })

  it('mixed → todos (não esconde nada)', () => {
    expect(defaultTipoForCompany('mixed')).toBe('todos')
  })

  it('other → todos', () => {
    expect(defaultTipoForCompany('other')).toBe('todos')
  })

  it('null/undefined/empty → todos (defesa em profundidade)', () => {
    expect(defaultTipoForCompany(null)).toBe('todos')
    expect(defaultTipoForCompany(undefined)).toBe('todos')
    expect(defaultTipoForCompany('')).toBe('todos')
  })

  it('tipo desconhecido → todos (defesa em profundidade)', () => {
    expect(defaultTipoForCompany('agronegocio')).toBe('todos')
  })

  it('case-insensitive: "RESTAURANT" === "restaurant"', () => {
    // Schema BR salvou alguns tipos em uppercase historicamente (caso real
    // da Cacula Mix em prod). Normalizar previne bug de fallback silencioso.
    expect(defaultTipoForCompany('RESTAURANT')).toBe('apenas-pagamentos')
    expect(defaultTipoForCompany('Restaurant')).toBe('apenas-pagamentos')
    expect(defaultTipoForCompany('RETAIL')).toBe('apenas-pagamentos')
    expect(defaultTipoForCompany('SERVICE')).toBe('todos')
  })
})

describe('parseTipoParam — segurança do query string', () => {
  it('aceita os 3 valores válidos', () => {
    expect(parseTipoParam('apenas-pagamentos')).toBe('apenas-pagamentos')
    expect(parseTipoParam('apenas-recebimentos')).toBe('apenas-recebimentos')
    expect(parseTipoParam('todos')).toBe('todos')
  })

  it('rejeita valores inválidos → todos', () => {
    expect(parseTipoParam('foo')).toBe('todos')
    expect(parseTipoParam('DEBIT')).toBe('todos')
    expect(parseTipoParam('credito')).toBe('todos')
  })

  it('null/undefined/empty → todos', () => {
    expect(parseTipoParam(null)).toBe('todos')
    expect(parseTipoParam(undefined)).toBe('todos')
    expect(parseTipoParam('')).toBe('todos')
  })
})
