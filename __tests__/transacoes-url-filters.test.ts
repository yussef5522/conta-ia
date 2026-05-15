import { describe, it, expect } from 'vitest'
import { parseTransacoesURLFilters } from '@/lib/transacoes/url-filters'

describe('parseTransacoesURLFilters — Sprint 2 Dia 2', () => {
  it('drill-down de entrada: tipo=CREDIT + datas válidas', () => {
    const r = parseTransacoesURLFilters({
      tipo: 'CREDIT',
      inicio: '2026-05-01',
      fim: '2026-05-31',
    })
    expect(r).toEqual({ tipo: 'CREDIT', inicio: '2026-05-01', fim: '2026-05-31' })
  })

  it('drill-down de saída: tipo=DEBIT', () => {
    const r = parseTransacoesURLFilters({ tipo: 'DEBIT', inicio: null, fim: null })
    expect(r.tipo).toBe('DEBIT')
  })

  it('params ausentes → tudo null', () => {
    expect(parseTransacoesURLFilters({})).toEqual({
      tipo: null,
      inicio: null,
      fim: null,
    })
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
      }),
    ).not.toThrow()
    const r = parseTransacoesURLFilters({
      tipo: '<script>',
      inicio: "' OR 1=1",
      fim: '../../etc/passwd',
    })
    expect(r).toEqual({ tipo: null, inicio: null, fim: null })
  })

  it('data parcialmente válida (formato certo, valor absurdo) ainda passa o regex', () => {
    // Validação é de FORMATO (YYYY-MM-DD), não de data real — aceitável,
    // a API faz a validação semântica depois.
    const r = parseTransacoesURLFilters({ inicio: '2026-99-99' })
    expect(r.inicio).toBe('2026-99-99')
  })
})
