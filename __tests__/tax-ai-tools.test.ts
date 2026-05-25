// Sprint 5.0.2.d — Tests das tools Claude.

import { describe, it, expect } from 'vitest'
import { TAX_ANALYSIS_TOOLS, executeToolCall } from '@/lib/tax/ai-analysis/tools'
import { BENCHMARK_REDES } from '@/lib/tax/ai-analysis/benchmarks'

describe('TAX_ANALYSIS_TOOLS — schema', () => {
  it('tem 4 tools definidas (3 lookup + submit_analysis Sprint 5.0.2.e)', () => {
    expect(TAX_ANALYSIS_TOOLS).toHaveLength(4)
  })

  it('todas têm name + description + input_schema', () => {
    for (const t of TAX_ANALYSIS_TOOLS) {
      expect(t.name).toBeTruthy()
      expect(t.description.length).toBeGreaterThan(20)
      expect(t.input_schema.type).toBe('object')
    }
  })

  it('nomes únicos', () => {
    const names = TAX_ANALYSIS_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('executeToolCall — get_knowledge', () => {
  it('retorna conhecimento simples-nacional', () => {
    const json = executeToolCall('get_knowledge', { topic: 'simples-nacional' })
    const data = JSON.parse(json)
    expect(data.limites?.globalAnual).toBe(4_800_000)
  })

  it('retorna conhecimento reforma-tributaria', () => {
    const json = executeToolCall('get_knowledge', { topic: 'reforma-tributaria' })
    const data = JSON.parse(json)
    expect(data.baseLegal?.emenda).toContain('132/2023')
  })

  it('erro com topic vazio', () => {
    const json = executeToolCall('get_knowledge', {})
    expect(JSON.parse(json).error).toBeTruthy()
  })
})

describe('executeToolCall — calculate_regime', () => {
  it('SIMPLES_NACIONAL Anexo I retorna total/aliquota', () => {
    const json = executeToolCall('calculate_regime', {
      regime: 'SIMPLES_NACIONAL',
      anexoSimples: 'ANEXO_I',
      receitaMensal: 100_000,
      rbaAcumulada: 1_200_000,
      folha12m: 0,
    })
    const data = JSON.parse(json)
    expect(data.regime).toBe('SIMPLES_NACIONAL')
    expect(data.total).toBeGreaterThan(0)
    expect(data.aliquotaEfetiva).toBeGreaterThan(0)
  })

  it('LUCRO_PRESUMIDO comércio RS com ICMS', () => {
    const json = executeToolCall('calculate_regime', {
      regime: 'LUCRO_PRESUMIDO',
      receitaMensal: 100_000,
      atividade: 'COMERCIO',
      estado: 'RS',
      hasICMS: true,
      hasISS: false,
    })
    const data = JSON.parse(json)
    expect(data.regime).toBe('LUCRO_PRESUMIDO')
    expect(data.breakdown.icms).toBeGreaterThan(0)
  })

  it('LUCRO_REAL margem 15 SP', () => {
    const json = executeToolCall('calculate_regime', {
      regime: 'LUCRO_REAL',
      receitaMensal: 100_000,
      margemRealPercent: 15,
      estado: 'SP',
      hasICMS: false,
      hasISS: true,
    })
    const data = JSON.parse(json)
    expect(data.regime).toBe('LUCRO_REAL')
    expect(data.breakdown.iss).toBeGreaterThan(0)
  })

  it('Simples sem rbaAcumulada usa receita × 12', () => {
    const json = executeToolCall('calculate_regime', {
      regime: 'SIMPLES_NACIONAL',
      anexoSimples: 'ANEXO_III',
      receitaMensal: 50_000,
      folha12m: 200_000, // Fator R OK
    })
    const data = JSON.parse(json)
    expect(data.total).toBeGreaterThan(0)
  })
})

describe('executeToolCall — get_benchmark_redes', () => {
  it('RESTAURANTE retorna Madero + Outback + Girafas', () => {
    const json = executeToolCall('get_benchmark_redes', { ramo: 'RESTAURANTE' })
    const data = JSON.parse(json)
    expect(data.ramo).toBe('RESTAURANTE')
    expect(data.redes).toHaveLength(3)
    const nomes = data.redes.map((r: { rede: string }) => r.rede)
    expect(nomes).toContain('Madero')
  })

  it('ACADEMIA retorna Smart Fit + Bodytech + Bio Ritmo', () => {
    const json = executeToolCall('get_benchmark_redes', { ramo: 'ACADEMIA' })
    const data = JSON.parse(json)
    expect(data.redes.some((r: { rede: string }) => r.rede === 'Smart Fit')).toBe(true)
  })

  it('COMERCIO_ROUPA retorna Renner + Riachuelo + C&A', () => {
    const json = executeToolCall('get_benchmark_redes', { ramo: 'COMERCIO_ROUPA' })
    const data = JSON.parse(json)
    expect(data.redes.some((r: { rede: string }) => r.rede === 'Renner')).toBe(true)
  })

  it('ramo inválido retorna lista vazia', () => {
    const json = executeToolCall('get_benchmark_redes', { ramo: 'OUTRO' })
    const data = JSON.parse(json)
    expect(data.redes).toEqual([])
  })
})

describe('executeToolCall — tool desconhecida', () => {
  it('retorna error em JSON', () => {
    const json = executeToolCall('not_a_real_tool', {})
    expect(JSON.parse(json).error).toContain('desconhecida')
  })
})

describe('Benchmarks — qualidade dos dados', () => {
  it('cada rede tem rede/regime/estrategias[]', () => {
    for (const ramo of Object.keys(BENCHMARK_REDES) as Array<keyof typeof BENCHMARK_REDES>) {
      for (const r of BENCHMARK_REDES[ramo]) {
        expect(r.rede).toBeTruthy()
        expect(r.regime).toBeTruthy()
        expect(r.estrategias.length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
