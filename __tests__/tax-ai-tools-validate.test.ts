// Sprint 5.0.2.g — Testes da tool validate_recommendation.

import { describe, it, expect } from 'vitest'
import {
  TAX_ANALYSIS_TOOLS,
  executeToolCall,
} from '@/lib/tax/ai-analysis/tools'

describe('TAX_ANALYSIS_TOOLS — schema expandido Sprint 5.0.2.g', () => {
  it('agora tem 5 tools (submit, get_knowledge, calculate_regime, get_benchmark_redes, validate_recommendation)', () => {
    expect(TAX_ANALYSIS_TOOLS).toHaveLength(5)
  })

  it('validate_recommendation existe', () => {
    expect(TAX_ANALYSIS_TOOLS.some((t) => t.name === 'validate_recommendation')).toBe(true)
  })

  it('get_knowledge tem 20 tópicos no enum (10 originais + 10 deep)', () => {
    const t = TAX_ANALYSIS_TOOLS.find((t) => t.name === 'get_knowledge')!
    const enums = (t.input_schema.properties.topic as { enum: string[] }).enum
    expect(enums.length).toBe(20)
    expect(enums).toContain('restaurantes-deep')
    expect(enums).toContain('grandes-redes')
    expect(enums).toContain('jurisprudencia-deep')
  })
})

describe('validate_recommendation — Simples acima do limite', () => {
  it('Receita R$ 450k/mês (projeção 5.4M) bloqueia Simples', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'SIMPLES_NACIONAL',
      receitaBrutaMes: 450_000,
      rbaAcumulada12m: 0,
      cnaeCode: '5611-2/01',
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(false)
    expect(data.motivoNaoAplicavel).toContain('5,4M')
    expect(data.baseLegal).toContain('LC 123/2006')
  })

  it('Receita R$ 100k/mês (projeção 1.2M) → Simples aplicável', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'SIMPLES_NACIONAL',
      receitaBrutaMes: 100_000,
      cnaeCode: '5611-2/01',
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(true)
  })
})

describe('validate_recommendation — CNAEs vedados', () => {
  it('Bancário 6422-1/00 bloqueia Simples', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'SIMPLES_NACIONAL',
      receitaBrutaMes: 50_000,
      cnaeCode: '6422-1/00',
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(false)
    expect(data.motivoNaoAplicavel).toMatch(/vedado/i)
  })

  it('Bancário 6422-1/00 obriga Lucro Real (Presumido vedado)', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'LUCRO_PRESUMIDO',
      receitaBrutaMes: 50_000,
      cnaeCode: '6422-1/00',
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(false)
    expect(data.motivoNaoAplicavel).toMatch(/Lucro Real/i)
  })
})

describe('validate_recommendation — Lucro Real sempre aplicável', () => {
  it('LUCRO_REAL aplicável independente de limite', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'LUCRO_REAL',
      receitaBrutaMes: 10_000_000, // 120M/ano
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(true)
  })
})

describe('validate_recommendation — outras vedações', () => {
  it('hasSocioPJ bloqueia Simples', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'SIMPLES_NACIONAL',
      receitaBrutaMes: 50_000,
      hasSocioPJ: true,
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(false)
    expect(data.motivoNaoAplicavel).toMatch(/sócio.*jurídica/i)
  })

  it('hasDebitos bloqueia Simples', () => {
    const json = executeToolCall('validate_recommendation', {
      regime: 'SIMPLES_NACIONAL',
      receitaBrutaMes: 50_000,
      hasDebitos: true,
    })
    const data = JSON.parse(json)
    expect(data.aplicavel).toBe(false)
    expect(data.motivoNaoAplicavel).toMatch(/débitos/i)
  })
})

describe('get_knowledge — tópicos deep', () => {
  it('topic restaurantes-deep retorna RESTAURANTES_KB', () => {
    const json = executeToolCall('get_knowledge', { topic: 'restaurantes-deep' })
    const data = JSON.parse(json)
    expect(data.lc192_2022).toBeDefined()
    expect(data.combo_mc_bk).toBeDefined()
    expect(data.perse).toBeDefined()
  })

  it('topic academias-deep retorna ACADEMIAS_KB', () => {
    const json = executeToolCall('get_knowledge', { topic: 'academias-deep' })
    const data = JSON.parse(json)
    expect(data.fator_r).toBeDefined()
    expect(data.benchmark_grandes_redes.smart_fit).toBeDefined()
  })

  it('topic grandes-redes retorna mapa consolidado', () => {
    const json = executeToolCall('get_knowledge', { topic: 'grandes-redes' })
    const data = JSON.parse(json)
    expect(data.restaurantes.mcdonalds).toBeDefined()
    expect(data.academias.smartfit).toBeDefined()
    expect(data.comercio_roupa.renner).toBeDefined()
  })

  it('topic jurisprudencia-deep retorna Tema 69 + Tema 1067', () => {
    const json = executeToolCall('get_knowledge', { topic: 'jurisprudencia-deep' })
    const data = JSON.parse(json)
    expect(data.stf.re_574706.tese).toContain('Tema 69')
    expect(data.stf.re_1187264.tese).toContain('Tema 1067')
  })
})
