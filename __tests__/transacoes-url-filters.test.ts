import { describe, it, expect } from 'vitest'
import { parseTransacoesURLFilters } from '@/lib/transacoes/url-filters'

const EMPTY = {
  tipo: null,
  inicio: null,
  fim: null,
  categoryId: null,
  q: null,
  importId: null,
  conferencia: false,
  valorMin: null,
  valorMax: null,
}

describe('parseTransacoesURLFilters — Sprint 2 Dia 2', () => {
  it('drill-down de entrada: tipo=CREDIT + datas válidas', () => {
    const r = parseTransacoesURLFilters({
      tipo: 'CREDIT',
      inicio: '2026-05-01',
      fim: '2026-05-31',
    })
    expect(r).toEqual({
      ...EMPTY,
      tipo: 'CREDIT',
      inicio: '2026-05-01',
      fim: '2026-05-31',
    })
  })

  it('drill-down de saída: tipo=DEBIT', () => {
    const r = parseTransacoesURLFilters({ tipo: 'DEBIT', inicio: null, fim: null })
    expect(r.tipo).toBe('DEBIT')
  })

  it('params ausentes → tudo null', () => {
    expect(parseTransacoesURLFilters({})).toEqual(EMPTY)
  })

  it('tipo inválido → null graceful (não quebra)', () => {
    const r = parseTransacoesURLFilters({ tipo: 'HACKED', inicio: '2026-05-01' })
    expect(r.tipo).toBeNull()
    expect(r.inicio).toBe('2026-05-01')
  })

  it('data malformada → null graceful', () => {
    const r = parseTransacoesURLFilters({
      tipo: 'CREDIT',
      inicio: 'DROP TABLE',
      fim: '31/05/2026',
    })
    expect(r.tipo).toBe('CREDIT')
    expect(r.inicio).toBeNull()
    expect(r.fim).toBeNull()
  })

  it('input malicioso completo → tudo null, sem throw', () => {
    expect(() =>
      parseTransacoesURLFilters({
        tipo: '<script>',
        inicio: "' OR 1=1",
        fim: '../../etc/passwd',
        categoryId: '<img onerror=alert>',
        q: "' OR ''='",
        importId: 'NULL',
      }),
    ).not.toThrow()
    const r = parseTransacoesURLFilters({
      tipo: '<script>',
      inicio: "' OR 1=1",
      fim: '../../etc/passwd',
      categoryId: '<img onerror=alert>',
      q: '   ',
      importId: 'NULL',
    })
    expect(r).toEqual({ ...EMPTY, q: null })
  })

  it('data parcialmente válida (formato certo, valor absurdo) ainda passa o regex', () => {
    const r = parseTransacoesURLFilters({ inicio: '2026-99-99' })
    expect(r.inicio).toBe('2026-99-99')
  })
})

describe('parseTransacoesURLFilters — Sprint 3.0.2 (categoria, q, importId, conferencia)', () => {
  it('categoryId cuid válido passa', () => {
    const r = parseTransacoesURLFilters({ categoryId: 'cmpgc9kji00014ygrknoncasp' })
    expect(r.categoryId).toBe('cmpgc9kji00014ygrknoncasp')
  })

  it('categoryId formato errado → null', () => {
    expect(parseTransacoesURLFilters({ categoryId: 'short' }).categoryId).toBeNull()
    expect(parseTransacoesURLFilters({ categoryId: '<script>' }).categoryId).toBeNull()
  })

  it('q válida com texto', () => {
    expect(parseTransacoesURLFilters({ q: 'NETFLIX' }).q).toBe('NETFLIX')
    expect(parseTransacoesURLFilters({ q: 'cia da fruta' }).q).toBe('cia da fruta')
  })

  it('q whitespace puro → null', () => {
    expect(parseTransacoesURLFilters({ q: '   ' }).q).toBeNull()
    expect(parseTransacoesURLFilters({ q: '' }).q).toBeNull()
  })

  it('q acima de 200 chars → null', () => {
    expect(parseTransacoesURLFilters({ q: 'a'.repeat(201) }).q).toBeNull()
  })

  it('importId cuid válido passa', () => {
    const r = parseTransacoesURLFilters({ importId: 'cmpgbcoa2034g2006x8zj09dt' })
    expect(r.importId).toBe('cmpgbcoa2034g2006x8zj09dt')
  })

  it('conferencia aceita string "true" ou "1"', () => {
    expect(parseTransacoesURLFilters({ conferencia: 'true' }).conferencia).toBe(true)
    expect(parseTransacoesURLFilters({ conferencia: '1' }).conferencia).toBe(true)
    expect(parseTransacoesURLFilters({ conferencia: 'false' }).conferencia).toBe(false)
    expect(parseTransacoesURLFilters({ conferencia: null }).conferencia).toBe(false)
  })
})

describe('parseTransacoesURLFilters — Sprint 3.0.3 B4 (valorMin/valorMax)', () => {
  it('aceita número como string', () => {
    const r = parseTransacoesURLFilters({ valorMin: '100', valorMax: '1000' })
    expect(r.valorMin).toBe(100)
    expect(r.valorMax).toBe(1000)
  })

  it('aceita número direto (client com state numérico)', () => {
    const r = parseTransacoesURLFilters({ valorMin: 100, valorMax: 1000 })
    expect(r.valorMin).toBe(100)
    expect(r.valorMax).toBe(1000)
  })

  it('decimais aceitos', () => {
    const r = parseTransacoesURLFilters({ valorMin: '99.99', valorMax: '1234.56' })
    expect(r.valorMin).toBe(99.99)
    expect(r.valorMax).toBe(1234.56)
  })

  it('rejeita negativo → null', () => {
    expect(parseTransacoesURLFilters({ valorMin: '-10' }).valorMin).toBeNull()
    expect(parseTransacoesURLFilters({ valorMax: '-1' }).valorMax).toBeNull()
  })

  it('string vazia → null (clear do input)', () => {
    expect(parseTransacoesURLFilters({ valorMin: '' }).valorMin).toBeNull()
    expect(parseTransacoesURLFilters({ valorMax: '' }).valorMax).toBeNull()
  })

  it('texto qualquer → null (defesa)', () => {
    expect(parseTransacoesURLFilters({ valorMin: 'abc' }).valorMin).toBeNull()
    expect(parseTransacoesURLFilters({ valorMax: '<script>' }).valorMax).toBeNull()
  })

  it('zero válido (filtra ≥ 0)', () => {
    expect(parseTransacoesURLFilters({ valorMin: '0' }).valorMin).toBe(0)
  })

  it('Infinity bloqueado', () => {
    expect(parseTransacoesURLFilters({ valorMin: 'Infinity' }).valorMin).toBeNull()
  })
})
