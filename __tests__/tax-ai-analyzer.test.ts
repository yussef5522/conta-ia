// Sprint 5.0.2.d — Tests do Claude analyzer com fetcher mockado.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  analyzeTaxOptimization,
  buildAnalysisContext,
  costFromUsage,
  type FetchLike,
} from '@/lib/tax/ai-analysis/claude-analyzer'
import type { CompanyTaxAnalysisData } from '@/lib/tax/ai-analysis/data-aggregator'

function makeData(overrides?: Partial<CompanyTaxAnalysisData>): CompanyTaxAnalysisData {
  return {
    companyId: 'co-test',
    companyName: 'Cacula Mix',
    cnpj: '12.345.678/0001-90',
    cnae: {
      code: '5611-2/01',
      name: 'Restaurantes e similares',
      ramo: 'RESTAURANTE',
      anexoSimples: 'ANEXO_I',
    },
    taxProfile: {
      regime: 'LUCRO_REAL',
      estado: 'RS',
      folha12m: 300_000,
      proLabore: 8_000,
      hasICMS: false,
      hasISS: true,
      margemReal: 15,
    },
    financial: {
      periodStart: new Date('2025-05-25T00:00:00Z'),
      periodEnd: new Date('2026-05-25T00:00:00Z'),
      receitaTotal: 1_200_000,
      receitaMensalMedia: 100_000,
      receitaPorMes: [{ mes: '2026-01', valor: 100_000 }],
      despesaTotal: 900_000,
      despesaMensalMedia: 75_000,
      despesasPorCategoria: [{ category: 'Alimentos', valor: 500_000, pct: 55.5 }],
      folhaIdentificada: 300_000,
      proLaboreIdentificado: 0,
      fornecedoresTop: [{ nome: 'Ambev', categoria: 'Bebidas', valor12m: 80_000, transacoes: 24 }],
      margemBruta: 0.25,
      margemLiquidaEstimada: 0.175,
    },
    impostosAtual: {
      detectados: [{ tipo: 'DAS Simples', valor12m: 144_000, fonte: 'TRANSACAO_DIRETA' }],
      totalPagoEstimado: 144_000,
      aliquotaEfetivaAtual: 12,
    },
    ...overrides,
  }
}

const ORIG_API_KEY = process.env.ANTHROPIC_API_KEY
const ORIG_ENABLED = process.env.AI_CLAUDE_ENABLED

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-test'
  process.env.AI_CLAUDE_ENABLED = 'true'
})

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIG_API_KEY
  process.env.AI_CLAUDE_ENABLED = ORIG_ENABLED
})

describe('buildAnalysisContext', () => {
  it('inclui nome, CNAE, ramo, regime', () => {
    const ctx = buildAnalysisContext(makeData())
    expect(ctx).toContain('Cacula Mix')
    expect(ctx).toContain('5611-2/01')
    expect(ctx).toContain('RESTAURANTE')
    expect(ctx).toContain('LUCRO_REAL')
    expect(ctx).toContain('RS')
  })

  it('inclui receita e despesa formatadas em BRL', () => {
    const ctx = buildAnalysisContext(makeData())
    expect(ctx).toContain('1.200.000')
  })

  it('inclui Fator R calculado (300k folha / 1.2M = 25%)', () => {
    const ctx = buildAnalysisContext(makeData())
    expect(ctx).toMatch(/25\.0%/)
    expect(ctx).toContain('abaixo 28%')
  })

  it('inclui top fornecedores', () => {
    const ctx = buildAnalysisContext(makeData())
    expect(ctx).toContain('Ambev')
  })

  it('inclui impostos detectados', () => {
    const ctx = buildAnalysisContext(makeData())
    expect(ctx).toContain('DAS Simples')
  })

  it('CNAE ausente → mensagem de aviso', () => {
    const ctx = buildAnalysisContext(makeData({ cnae: undefined }))
    expect(ctx).toContain('NÃO CADASTRADO')
  })

  it('lista tools no prompt', () => {
    const ctx = buildAnalysisContext(makeData())
    expect(ctx).toContain('calculate_regime')
    expect(ctx).toContain('get_knowledge')
    expect(ctx).toContain('get_benchmark_redes')
  })
})

describe('analyzeTaxOptimization — disabled', () => {
  it('retorna disabled quando AI_CLAUDE_ENABLED=false', async () => {
    process.env.AI_CLAUDE_ENABLED = 'false'
    const r = await analyzeTaxOptimization(makeData())
    expect(r.kind).toBe('disabled')
  })

  it('retorna disabled sem API key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const r = await analyzeTaxOptimization(makeData())
    expect(r.kind).toBe('disabled')
  })
})

describe('analyzeTaxOptimization — sucesso direto sem tool use', () => {
  it('parseia JSON e retorna analysis', async () => {
    const finalAnalysis = {
      resumoExecutivo: {
        cenarioAtual: 'Lucro Real R$ 100k/mês',
        impostoPagoEstimado: 144_000,
        aliquotaEfetiva: 12,
        economiaPotencialAnual: 50_000,
      },
      oportunidades: [],
      comparativoRegimes: { atual: { regime: 'LUCRO_REAL', total: 0, aliquota: 0 }, recomendacao: 'Migrar' },
      beneficiosEspecificos: [],
      benchmarkRedes: [],
      proximosPassos: [],
    }
    const fetcher: FetchLike = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(finalAnalysis) }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1000, output_tokens: 500 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )

    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.analysis.resumoExecutivo.impostoPagoEstimado).toBe(144_000)
      expect(r.metadata.tokensInput).toBe(1000)
      expect(r.metadata.toolRounds).toBe(0)
    }
  })
})

describe('analyzeTaxOptimization — tool use loop', () => {
  it('processa tool_use e finaliza no segundo round', async () => {
    let call = 0
    const finalAnalysis = {
      resumoExecutivo: {
        cenarioAtual: 'OK',
        impostoPagoEstimado: 0,
        aliquotaEfetiva: 0,
        economiaPotencialAnual: 0,
      },
      oportunidades: [],
      comparativoRegimes: { atual: { regime: 'X', total: 0, aliquota: 0 }, recomendacao: '' },
      beneficiosEspecificos: [],
      benchmarkRedes: [],
      proximosPassos: [],
    }
    const fetcher: FetchLike = async () => {
      call++
      if (call === 1) {
        return new Response(
          JSON.stringify({
            content: [
              { type: 'tool_use', id: 'tu-1', name: 'get_knowledge', input: { topic: 'simples-nacional' } },
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 500, output_tokens: 50 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(finalAnalysis) }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 800, output_tokens: 400 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.metadata.toolRounds).toBe(1)
      expect(r.metadata.tokensInput).toBe(500 + 800)
    }
  })
})

describe('analyzeTaxOptimization — erros', () => {
  it('retorna error com HTTP 500', async () => {
    const fetcher: FetchLike = async () =>
      new Response('Internal error', { status: 500 })
    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.status).toBe(500)
  })

  it('retorna invalid-json quando texto não é JSON', async () => {
    const fetcher: FetchLike = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'isso nao eh json valido' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 10 },
        }),
        { status: 200 },
      )
    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('invalid-json')
  })

  it('extrai JSON envolto em markdown ```json', async () => {
    const final = {
      resumoExecutivo: { cenarioAtual: 'x', impostoPagoEstimado: 0, aliquotaEfetiva: 0, economiaPotencialAnual: 0 },
      oportunidades: [],
      comparativoRegimes: { atual: { regime: 'X', total: 0, aliquota: 0 }, recomendacao: '' },
      beneficiosEspecificos: [],
      benchmarkRedes: [],
      proximosPassos: [],
    }
    const fetcher: FetchLike = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(final) + '\n```' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 10 },
        }),
        { status: 200 },
      )
    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('success')
  })
})

describe('costFromUsage — Sonnet 4.6 pricing', () => {
  it('1M input + 1M output = $3 + $15 = $18', () => {
    expect(costFromUsage(1_000_000, 1_000_000)).toBeCloseTo(18)
  })

  it('5k input + 2k output ≈ $0.045', () => {
    const c = costFromUsage(5_000, 2_000)
    expect(c).toBeCloseTo(0.045)
  })

  it('zero tokens = $0', () => {
    expect(costFromUsage(0, 0)).toBe(0)
  })
})
