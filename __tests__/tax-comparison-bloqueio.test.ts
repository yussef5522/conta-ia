// Sprint 5.0.2.f — Comparison engine bloqueia regimes inviáveis ANTES de calcular.

import { describe, it, expect } from 'vitest'
import { compareRegimes } from '@/lib/tax/comparison-engine'

describe('compareRegimes — Caso Cacula Mix (5,4M anual)', () => {
  it('Receita 450k/mês (5,4M/ano) → Simples NÃO aplicável', () => {
    const r = compareRegimes({
      receitaBrutaMes: 450_000,
      rbaAcumulada: 0, // simulação, banco vazio
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      cnaeCode: '5611-2/01',
      estado: 'RS',
      hasICMS: false,
      hasISS: true,
    })

    expect(r.simples.aplicavel).toBe(false)
    expect(r.simples.motivoNaoAplicavel).toContain('4,8M')
    expect(r.simples.baseLegal).toContain('LC 123/2006')
  })

  it('Simples não aplicável → recomendação NÃO é Simples', () => {
    const r = compareRegimes({
      receitaBrutaMes: 450_000,
      rbaAcumulada: 0,
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      cnaeCode: '5611-2/01',
      estado: 'RS',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.recomendacao?.regime).not.toBe('SIMPLES_NACIONAL')
  })

  it('Receita 100k (cabe Simples) + comprasMes 30k → Real com créditos é considerado', () => {
    const r = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 0,
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      cnaeCode: '5611-2/01',
      estado: 'RS',
      hasICMS: false,
      hasISS: true,
      comprasMes: 30_000,
    })
    expect(r.simples.aplicavel).toBe(true)
    expect(r.presumido.aplicavel).toBe(true)
    expect(r.real.aplicavel).toBe(true)
    // Real com créditos PIS/COFINS reduzidos
    expect((r.real.detalhes as { pisCreditos: number }).pisCreditos).toBe(495) // 30k × 1,65%
  })
})

describe('compareRegimes — RBA projetada usa max(histórico, receita×12)', () => {
  it('RBA histórico 1M + receita 500k/mês → projeção 6M bloqueia Simples', () => {
    const r = compareRegimes({
      receitaBrutaMes: 500_000,
      rbaAcumulada: 1_000_000, // histórico baixo
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      estado: 'RS',
      hasICMS: true,
      hasISS: false,
    })
    expect(r.simples.aplicavel).toBe(false) // projeção 6M > 4,8M
  })

  it('RBA histórico ≥ projeção → usa histórico real', () => {
    const r = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 5_000_000, // histórico ALTO
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      estado: 'RS',
      hasICMS: true,
      hasISS: false,
    })
    expect(r.simples.aplicavel).toBe(false) // histórico 5M já bloqueia
    expect(r.simples.motivoNaoAplicavel).toContain('5,0M')
  })
})

describe('compareRegimes — CNAE vedado bloqueia Simples', () => {
  it('CNAE bancário + faturamento baixo → Simples vedado por CNAE, não por limite', () => {
    const r = compareRegimes({
      receitaBrutaMes: 50_000,
      rbaAcumulada: 0,
      folha12m: 0,
      anexoSimples: 'ANEXO_III',
      atividade: 'SERVICOS',
      margemRealPercent: 15,
      cnaeCode: '6422-1/00',
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.simples.aplicavel).toBe(false)
    expect(r.simples.motivoNaoAplicavel).toContain('vedado')
    expect(r.presumido.aplicavel).toBe(false) // atividade financeira → obrigada Real
    expect(r.real.aplicavel).toBe(true)
    expect(r.recomendacao?.regime).toBe('LUCRO_REAL')
  })
})

describe('compareRegimes — comprasMes flui pro Real', () => {
  it('comprasMes 60k em receita 100k reduz PIS+COFINS', () => {
    const semCompras = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 0,
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: false,
      comprasMes: 0,
    })
    const comCompras = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 0,
      folha12m: 0,
      anexoSimples: 'ANEXO_I',
      atividade: 'COMERCIO',
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: false,
      comprasMes: 60_000,
    })
    expect(comCompras.real.total).toBeLessThan(semCompras.real.total)
  })
})
