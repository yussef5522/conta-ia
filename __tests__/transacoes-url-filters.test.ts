import { describe, it, expect } from 'vitest'
import { parseTransacoesURLFilters, buildTransacoesURLParams } from '@/lib/transacoes/url-filters'

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
  // Sprint 3.0.4 C4 — URL persistente completa
  status: null,
  contaId: null,
  page: null,
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

describe('parseTransacoesURLFilters — Sprint 3.0.4 C4 (status, contaId, page)', () => {
  it('status enum válido passa', () => {
    expect(parseTransacoesURLFilters({ status: 'PENDING' }).status).toBe('PENDING')
    expect(parseTransacoesURLFilters({ status: 'RECONCILED' }).status).toBe('RECONCILED')
    expect(parseTransacoesURLFilters({ status: 'IGNORED' }).status).toBe('IGNORED')
  })

  it('status inválido → null', () => {
    expect(parseTransacoesURLFilters({ status: 'HACKED' }).status).toBeNull()
    expect(parseTransacoesURLFilters({ status: 'pending' }).status).toBeNull()
  })

  it('contaId cuid válido passa', () => {
    expect(parseTransacoesURLFilters({ contaId: 'cmpgc9kji00014ygrknoncasp' }).contaId)
      .toBe('cmpgc9kji00014ygrknoncasp')
  })

  it('contaId malformado → null', () => {
    expect(parseTransacoesURLFilters({ contaId: 'short' }).contaId).toBeNull()
  })

  it('page string numérica passa', () => {
    expect(parseTransacoesURLFilters({ page: '3' }).page).toBe(3)
  })

  it('page número direto passa', () => {
    expect(parseTransacoesURLFilters({ page: 5 }).page).toBe(5)
  })

  it('page zero ou negativo → null', () => {
    expect(parseTransacoesURLFilters({ page: '0' }).page).toBeNull()
    expect(parseTransacoesURLFilters({ page: '-1' }).page).toBeNull()
  })

  it('page acima de 10000 → null (defesa)', () => {
    expect(parseTransacoesURLFilters({ page: '999999' }).page).toBeNull()
  })

  it('page texto → null', () => {
    expect(parseTransacoesURLFilters({ page: 'abc' }).page).toBeNull()
  })

  it('page decimal → null (só inteiro)', () => {
    expect(parseTransacoesURLFilters({ page: '1.5' }).page).toBeNull()
  })
})

describe('buildTransacoesURLParams — Sprint 3.0.4 C4', () => {
  it('input vazio → URLSearchParams vazio', () => {
    expect(buildTransacoesURLParams({}).toString()).toBe('')
  })

  it('TODOS / TODAS / vazio são ignorados', () => {
    const p = buildTransacoesURLParams({
      tipo: 'TODOS',
      status: 'TODOS',
      contaFiltro: 'TODAS',
      categoryId: 'TODAS',
      q: '',
      valorMin: '',
      valorMax: '',
    })
    expect(p.toString()).toBe('')
  })

  it('valores significativos vão pra URL', () => {
    const p = buildTransacoesURLParams({
      tipo: 'CREDIT',
      status: 'PENDING',
      contaFiltro: 'cmpgc9kji00014ygrknoncasp',
      categoryId: 'cmpgbcoa2034g2006x8zj09dt',
      q: 'NETFLIX',
      valorMin: '100',
      valorMax: '500',
      inicio: '2026-05-01',
      fim: '2026-05-31',
      page: 3,
      empresaId: 'cmpgapyt402pg2006sr8ozzz8',
    })
    expect(p.get('tipo')).toBe('CREDIT')
    expect(p.get('status')).toBe('PENDING')
    expect(p.get('contaId')).toBe('cmpgc9kji00014ygrknoncasp')
    expect(p.get('categoryId')).toBe('cmpgbcoa2034g2006x8zj09dt')
    expect(p.get('q')).toBe('NETFLIX')
    expect(p.get('valorMin')).toBe('100')
    expect(p.get('valorMax')).toBe('500')
    expect(p.get('inicio')).toBe('2026-05-01')
    expect(p.get('fim')).toBe('2026-05-31')
    expect(p.get('page')).toBe('3')
    expect(p.get('empresaId')).toBe('cmpgapyt402pg2006sr8ozzz8')
  })

  it('page=1 é ignorada (default)', () => {
    expect(buildTransacoesURLParams({ page: 1 }).has('page')).toBe(false)
  })

  it('q com whitespace é trimado antes de salvar', () => {
    const p = buildTransacoesURLParams({ q: '  NETFLIX  ' })
    expect(p.get('q')).toBe('NETFLIX')
  })

  it('conferencia=true vai pra URL como string', () => {
    expect(buildTransacoesURLParams({ conferencia: true }).get('conferencia')).toBe('true')
  })

  it('conferencia=false ignorado', () => {
    expect(buildTransacoesURLParams({ conferencia: false }).has('conferencia')).toBe(false)
  })

  it('round-trip: build → parse devolve mesmos valores', () => {
    const input = {
      tipo: 'CREDIT' as const,
      status: 'PENDING' as const,
      contaFiltro: 'cmpgc9kji00014ygrknoncasp',
      categoryId: 'cmpgbcoa2034g2006x8zj09dt',
      q: 'NETFLIX',
      valorMin: '100',
      valorMax: '500',
      inicio: '2026-05-01',
      fim: '2026-05-31',
      page: 3,
    }
    const p = buildTransacoesURLParams(input)
    const parsed = parseTransacoesURLFilters({
      tipo: p.get('tipo'),
      status: p.get('status'),
      contaId: p.get('contaId'),
      categoryId: p.get('categoryId'),
      q: p.get('q'),
      valorMin: p.get('valorMin'),
      valorMax: p.get('valorMax'),
      inicio: p.get('inicio'),
      fim: p.get('fim'),
      page: p.get('page'),
    })
    expect(parsed.tipo).toBe('CREDIT')
    expect(parsed.status).toBe('PENDING')
    expect(parsed.contaId).toBe('cmpgc9kji00014ygrknoncasp')
    expect(parsed.categoryId).toBe('cmpgbcoa2034g2006x8zj09dt')
    expect(parsed.q).toBe('NETFLIX')
    expect(parsed.valorMin).toBe(100)
    expect(parsed.valorMax).toBe(500)
    expect(parsed.inicio).toBe('2026-05-01')
    expect(parsed.fim).toBe('2026-05-31')
    expect(parsed.page).toBe(3)
  })
})
