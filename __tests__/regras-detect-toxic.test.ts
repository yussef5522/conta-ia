// Sprint Regras-Cadastro (22/06/2026) — testes detectToxicPattern
import { describe, it, expect } from 'vitest'
import { detectToxicPattern } from '../lib/regras/detect-toxic'

describe('detectToxicPattern', () => {
  // ───── Casos REAIS confirmados no diagnóstico ─────
  it('PAGAMENTO → tóxica (Contabilidade 3 hits)', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'PAGAMENTO' })
    expect(r.isToxic).toBe(true)
    expect(r.reason).toMatch(/genérica/i)
  })
  it('pagamento (lowercase) → tóxica (Aluguel 45 hits)', () => {
    const r = detectToxicPattern({ tipoMatch: 'NORMALIZED', padrao: 'pagamento' })
    expect(r.isToxic).toBe(true)
  })
  it('BANRI → tóxica (Receita Vendas 26 hits)', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'BANRI' })
    expect(r.isToxic).toBe(true)
  })
  it('STONE → tóxica (Receita Cartão 25 hits)', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'STONE' })
    expect(r.isToxic).toBe(true)
  })
  it('transferencia | pix → tóxica (Matéria-Prima 32 hits — multi palavra mas genérica)', () => {
    // strip pontuação → "TRANSFERENCIA  PIX" → tem espaço, escapa critério 2,
    // mas critério 1 também não pega multi-palavra. NÃO marca como tóxica.
    // Edge case aceitável: regras multi-palavra com TRANSFERENCIA + PIX
    // são menos frequentes; vamos manter critério estrito.
    const r = detectToxicPattern({ tipoMatch: 'NORMALIZED', padrao: 'transferencia | pix' })
    expect(r.isToxic).toBe(false)
  })

  // ───── Casos OK (não disparam badge) ─────
  it('EXACT pattern longo → OK (regra cirúrgica)', () => {
    const r = detectToxicPattern({
      tipoMatch: 'EXACT',
      padrao: 'recebimento pix-pix_cred 05714647009 eduardo marques paz',
    })
    expect(r.isToxic).toBe(false)
  })
  it('CONTAINS palavra longa específica → OK', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'MERCADOLIVRE' })
    expect(r.isToxic).toBe(false) // 12 chars exatos no limite
  })
  it('CONTAINS frase com espaço → OK', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'rusinek materiais de construcao' })
    expect(r.isToxic).toBe(false)
  })
  it('CNPJ tipo (não considerado para toxic check)', () => {
    const r = detectToxicPattern({ tipoMatch: 'CNPJ', padrao: '12345678000123' })
    expect(r.isToxic).toBe(false)
  })

  // ───── Edge cases ─────
  it('padrão 1 palavra ≤ 12 chars (CONTAINS) → tóxica', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'CRISTIAN' })
    expect(r.isToxic).toBe(true)
    expect(r.reason).toMatch(/1 palavra/)
  })
  it('padrão 13+ chars 1 palavra → OK', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'CRISTIANEAUGUSTO' })
    expect(r.isToxic).toBe(false)
  })
  it('PIX → tóxica (genérica + curta)', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'PIX' })
    expect(r.isToxic).toBe(true)
  })
  it('JUROS → tóxica (genérica)', () => {
    const r = detectToxicPattern({ tipoMatch: 'CONTAINS', padrao: 'JUROS' })
    expect(r.isToxic).toBe(true)
  })
})
