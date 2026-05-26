// Sprint 5.0.2.e — Tests do submit_analysis tool + parser fallback robusto.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  analyzeTaxOptimization,
  tryParseJson,
  type FetchLike,
} from '@/lib/tax/ai-analysis/claude-analyzer'
import {
  TAX_ANALYSIS_TOOLS,
  SUBMIT_ANALYSIS_TOOL_NAME,
} from '@/lib/tax/ai-analysis/tools'
import type { CompanyTaxAnalysisData } from '@/lib/tax/ai-analysis/data-aggregator'

function makeData(): CompanyTaxAnalysisData {
  return {
    companyId: 'co-test',
    companyName: 'Test Co',
    cnpj: '12.345.678/0001-90',
    cnae: { code: '5611-2/01', name: 'Restaurantes', ramo: 'RESTAURANTE' },
    taxProfile: {
      regime: 'SIMPLES_NACIONAL',
      simplesAnexo: 'ANEXO_I',
      estado: 'RS',
      folha12m: 100_000,
      proLabore: 5_000,
      hasICMS: true,
      hasISS: false,
      margemReal: 15,
    },
    financial: {
      periodStart: new Date('2025-05-25'),
      periodEnd: new Date('2026-05-25'),
      receitaTotal: 1_200_000,
      receitaMensalMedia: 100_000,
      receitaPorMes: [],
      despesaTotal: 900_000,
      despesaMensalMedia: 75_000,
      despesasPorCategoria: [],
      folhaIdentificada: 100_000,
      proLaboreIdentificado: 0,
      fornecedoresTop: [],
      margemBruta: 0.25,
      margemLiquidaEstimada: 0.175,
    },
    impostosAtual: {
      detectados: [],
      totalPagoEstimado: 0,
      aliquotaEfetivaAtual: 0,
    },
    compras: {
      total12m: 0,
      mensalMedia: 0,
      percentSobreReceita: 0,
      fornecedoresDetectados: 0,
    },
  }
}

const SAMPLE_ANALYSIS = {
  resumoExecutivo: {
    cenarioAtual: 'Simples Anexo I',
    impostoPagoEstimado: 144_000,
    aliquotaEfetiva: 12,
    economiaPotencialAnual: 24_000,
  },
  oportunidades: [],
  comparativoRegimes: {
    atual: { regime: 'SIMPLES_NACIONAL', total: 12_000, aliquota: 12 },
    recomendacao: 'Manter Simples',
  },
  beneficiosEspecificos: [],
  benchmarkRedes: [],
  proximosPassos: [],
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

describe('submit_analysis — tool schema', () => {
  it('está registrada em TAX_ANALYSIS_TOOLS', () => {
    expect(TAX_ANALYSIS_TOOLS.some((t) => t.name === SUBMIT_ANALYSIS_TOOL_NAME)).toBe(true)
  })

  it('tem 5 tools no total (submit + 4 lookups Sprint 5.0.2.g)', () => {
    expect(TAX_ANALYSIS_TOOLS).toHaveLength(5)
  })

  it('SUBMIT_ANALYSIS_TOOL_NAME === "submit_analysis"', () => {
    expect(SUBMIT_ANALYSIS_TOOL_NAME).toBe('submit_analysis')
  })

  it('schema exige 6 campos no resultado', () => {
    const submitTool = TAX_ANALYSIS_TOOLS.find((t) => t.name === SUBMIT_ANALYSIS_TOOL_NAME)!
    const required = submitTool.input_schema.required as string[]
    expect(required).toContain('resumoExecutivo')
    expect(required).toContain('oportunidades')
    expect(required).toContain('comparativoRegimes')
    expect(required).toContain('beneficiosEspecificos')
    expect(required).toContain('benchmarkRedes')
    expect(required).toContain('proximosPassos')
  })
})

describe('analyzer — submit_analysis tool call retorna input direto', () => {
  it('quando Claude chama submit_analysis, extrai input sem JSON parsing', async () => {
    const fetcher: FetchLike = async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              id: 'tu-final',
              name: 'submit_analysis',
              input: SAMPLE_ANALYSIS,
            },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 2000, output_tokens: 800 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )

    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.analysis.resumoExecutivo.impostoPagoEstimado).toBe(144_000)
      expect(r.metadata.toolRounds).toBe(0)
    }
  })

  it('submit_analysis preempts outras tools no mesmo turn', async () => {
    // Mesmo se Claude chamar get_knowledge + submit_analysis juntos, submit ganha
    const fetcher: FetchLike = async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              id: 'tu-knowledge',
              name: 'get_knowledge',
              input: { topic: 'simples-nacional' },
            },
            {
              type: 'tool_use',
              id: 'tu-submit',
              name: 'submit_analysis',
              input: SAMPLE_ANALYSIS,
            },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 1000, output_tokens: 500 },
        }),
        { status: 200 },
      )

    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('success')
  })

  it('submit_analysis depois de N rounds de tool use também funciona', async () => {
    let call = 0
    const fetcher: FetchLike = async () => {
      call++
      if (call === 1) {
        return new Response(
          JSON.stringify({
            content: [
              {
                type: 'tool_use',
                id: 'tu-1',
                name: 'get_knowledge',
                input: { topic: 'reforma-tributaria' },
              },
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 500, output_tokens: 50 },
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          content: [
            { type: 'tool_use', id: 'tu-2', name: 'submit_analysis', input: SAMPLE_ANALYSIS },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 800, output_tokens: 400 },
        }),
        { status: 200 },
      )
    }

    const r = await analyzeTaxOptimization(makeData(), { fetcher })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.metadata.toolRounds).toBe(1)
    }
  })
})

describe('tryParseJson — 4 estratégias de fallback', () => {
  it('1. JSON puro', () => {
    expect(tryParseJson('{"a": 1}')).toEqual({ a: 1 })
  })

  it('2. Remove markdown ```json', () => {
    expect(tryParseJson('```json\n{"a": 2}\n```')).toEqual({ a: 2 })
  })

  it('2b. Remove markdown ``` sem json hint', () => {
    expect(tryParseJson('```\n{"b": 3}\n```')).toEqual({ b: 3 })
  })

  it('3. Extrai primeiro objeto JSON (texto antes/depois)', () => {
    const text = 'Aqui está a análise:\n{"resultado": 42}\nEspero que ajude!'
    expect(tryParseJson(text)).toEqual({ resultado: 42 })
  })

  it('4. Trim de prosa antes/depois', () => {
    const text = 'bla bla {"x": 1} mais bla'
    const r = tryParseJson(text)
    expect(r).toEqual({ x: 1 })
  })

  it('retorna null para texto sem JSON', () => {
    expect(tryParseJson('no json here at all')).toBe(null)
  })

  it('retorna null para string vazia', () => {
    expect(tryParseJson('')).toBe(null)
  })

  it('retorna null pra null input', () => {
    expect(tryParseJson(null as unknown as string)).toBe(null)
  })

  it('parseia array no top-level se vier', () => {
    // Estratégia 1 cobre arrays também
    expect(tryParseJson('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('parseia objeto aninhado complexo', () => {
    const obj = { a: { b: [1, { c: 'd' }] } }
    expect(tryParseJson(JSON.stringify(obj))).toEqual(obj)
  })
})
