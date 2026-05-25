// Sprint 5.0.2 — testes do comparison engine.

import { describe, it, expect } from 'vitest'
import { compareRegimes } from '@/lib/tax/comparison-engine'

describe('compareRegimes — Cacula Mix realista (Restaurante RS, R$ 100k/mês)', () => {
  it('recomenda Simples se aplicável (faturamento 600k anual)', () => {
    const r = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 500_000, // total anual ~600k ainda < 4.8M
      folha12m: 300_000, // 50%, dispara Fator R do Anexo III
      anexoSimples: 'ANEXO_III',
      atividade: 'SERVICOS',
      margemRealPercent: 15,
      estado: 'RS',
      hasICMS: false,
      hasISS: true,
    })

    expect(r.simples.aplicavel).toBe(true)
    expect(r.presumido.aplicavel).toBe(true)
    expect(r.real.aplicavel).toBe(true)
    expect(r.recomendacao).not.toBeNull()
    expect(r.recomendacao!.economiaAnual).toBeGreaterThan(0)
  })
})

describe('compareRegimes — quando Simples não aplicável', () => {
  it('Faturamento R$ 10M/ano → Simples sai (>4.8M)', () => {
    const r = compareRegimes({
      receitaBrutaMes: 800_000,
      rbaAcumulada: 9_000_000,
      folha12m: 1_000_000,
      anexoSimples: 'ANEXO_III',
      atividade: 'SERVICOS',
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.simples.aplicavel).toBe(false)
    expect(r.simples.motivoNaoAplicavel).toMatch(/4,8M|excede/i)
    expect(r.presumido.aplicavel).toBe(true)
    expect(r.real.aplicavel).toBe(true)
  })

  it('Anexo simples não informado → não aplicável', () => {
    const r = compareRegimes({
      receitaBrutaMes: 50_000,
      rbaAcumulada: 100_000,
      folha12m: 50_000,
      anexoSimples: null,
      atividade: 'SERVICOS',
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.simples.aplicavel).toBe(false)
  })
})

describe('compareRegimes — Lucro Presumido sai (>78M)', () => {
  it('Faturamento R$ 100M/ano só Real', () => {
    const r = compareRegimes({
      receitaBrutaMes: 8_400_000,
      rbaAcumulada: 92_000_000,
      folha12m: 10_000_000,
      anexoSimples: 'ANEXO_III',
      atividade: 'COMERCIO',
      margemRealPercent: 10,
      estado: 'SP',
      hasICMS: true,
      hasISS: false,
    })
    expect(r.simples.aplicavel).toBe(false)
    expect(r.presumido.aplicavel).toBe(false)
    expect(r.real.aplicavel).toBe(true)
    expect(r.recomendacao?.regime).toBe('LUCRO_REAL')
  })
})

describe('compareRegimes — recomendação contextual', () => {
  it('Serviço margem baixa: Presumido geralmente perde pra Real', () => {
    const r = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 500_000,
      folha12m: 0,
      anexoSimples: null,
      atividade: 'SERVICOS',
      margemRealPercent: 5, // margem real BAIXA
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    // Presumido força base 32% → IRPJ alto
    // Real declara 5% margem → IRPJ baixo
    // Real deve ganhar
    expect(r.recomendacao?.regime).toBe('LUCRO_REAL')
  })

  it('Justificativa contém economia em R$', () => {
    const r = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 500_000,
      folha12m: 300_000,
      anexoSimples: 'ANEXO_III',
      atividade: 'SERVICOS',
      margemRealPercent: 15,
      estado: 'RS',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.recomendacao?.justificativa).toMatch(/R\$/)
  })

  it('totalAnual = total × 12', () => {
    const r = compareRegimes({
      receitaBrutaMes: 100_000,
      rbaAcumulada: 500_000,
      folha12m: 200_000,
      anexoSimples: 'ANEXO_III',
      atividade: 'SERVICOS',
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    expect(r.presumido.totalAnual).toBe(r.presumido.total * 12)
    expect(r.real.totalAnual).toBe(r.real.total * 12)
  })
})
