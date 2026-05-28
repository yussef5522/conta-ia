// Sprint 5.0.4.0c1 — Testes de cálculo de custo e parser JSON do client AI.

import { describe, it, expect } from 'vitest'
import {
  calculateInsightCostCents,
  INSIGHTS_MODEL,
  callInsightsAPI,
} from '@/lib/ai/insights-client'
import type { InsightInputData } from '@/lib/ai/insights-types'

const MINIMAL_INPUT: InsightInputData = {
  empresaId: 'test',
  empresaName: 'Test',
  currentPeriod: '2026-05',
  basePeriod: '2026-04',
  currentLabel: 'Maio/2026',
  baseLabel: 'Abril/2026',
  currentTotals: { receita: 100, despesas: 50, lucro: 50, margem: 50 },
  baseTotals: { receita: 100, despesas: 50, lucro: 50, margem: 50 },
  variances: [],
  topCategoriesCurrent: [],
}

describe('calculateInsightCostCents', () => {
  it('Sonnet 4.6: 1M input + 1M output = 18 USD = 180.000 cents×100', () => {
    const cents = calculateInsightCostCents({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    // Input: $3 (300 cents × 100) + Output: $15 (1500 cents × 100) = 1800
    expect(cents).toBe(180_000)
  })

  it('chamada típica: 1500 input + 1200 output ≈ R$ 0,11 (~22 cents×100)', () => {
    const cents = calculateInsightCostCents({
      inputTokens: 1500,
      outputTokens: 1200,
    })
    // 1500/1M * $3 = $0.0045
    // 1200/1M * $15 = $0.018
    // Total = $0.0225 = 2.25 cents = 225 cents×100 (com round)
    expect(cents).toBe(225)
  })

  it('zero tokens = zero custo', () => {
    expect(
      calculateInsightCostCents({ inputTokens: 0, outputTokens: 0 }),
    ).toBe(0)
  })

  it('só input', () => {
    const cents = calculateInsightCostCents({
      inputTokens: 1_000_000,
      outputTokens: 0,
    })
    // $3 * 100 cents/USD * 100 = 30.000
    expect(cents).toBe(30_000)
  })

  it('só output', () => {
    const cents = calculateInsightCostCents({
      inputTokens: 0,
      outputTokens: 1_000_000,
    })
    // $15 * 100 * 100 = 150.000
    expect(cents).toBe(150_000)
  })
})

describe('callInsightsAPI — fetcher injection', () => {
  it('retorna disabled quando API key ausente', async () => {
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: '',
      fetcher: vi.fn() as never,
    })
    expect(r.kind).toBe('disabled')
  })

  it('retorna rate-limited em HTTP 429', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('', { status: 429 }),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('rate-limited')
  })

  it('retorna error em HTTP 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') {
      expect(r.status).toBe(500)
      // SANITIZE: mensagem não deve conter texto cru do body
      expect(r.message).not.toContain('boom')
    }
  })

  it('retorna invalid-json quando IA não retorna JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Esta é uma resposta sem JSON.' }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('invalid-json')
  })

  it('retorna success com JSON válido', async () => {
    const validOutput = {
      resumoExecutivo: 'Resumo de teste em PT-BR.',
      destaques: [
        {
          tipo: 'alerta',
          titulo: 'Folha disparou',
          descricao: 'Salários +96% vs mês anterior.',
        },
      ],
      recomendacoes: ['Revisar contratos de pessoal'],
    }
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(validOutput) }],
          usage: { input_tokens: 1500, output_tokens: 800 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.insights.resumoExecutivo).toBe('Resumo de teste em PT-BR.')
      expect(r.insights.destaques).toHaveLength(1)
      expect(r.tokensUsed?.input).toBe(1500)
      expect(r.tokensUsed?.output).toBe(800)
    }
  })

  it('valida shape — rejeita destaque sem tipo', async () => {
    const invalidOutput = {
      resumoExecutivo: 'Resumo.',
      destaques: [{ titulo: 'X', descricao: 'Y' }], // falta 'tipo'
      recomendacoes: [],
    }
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(invalidOutput) }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('invalid-json')
  })

  it('valida tipo enum (alerta|positivo|atencao)', async () => {
    const invalidOutput = {
      resumoExecutivo: 'Resumo.',
      destaques: [
        { tipo: 'INVALIDO', titulo: 'X', descricao: 'Y' }, // tipo errado
      ],
      recomendacoes: [],
    }
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(invalidOutput) }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('invalid-json')
  })

  it('aceita JSON com texto extra antes/depois (regex extrai)', async () => {
    const validOutput = {
      resumoExecutivo: 'Teste',
      destaques: [{ tipo: 'positivo', titulo: 'X', descricao: 'Y' }],
      recomendacoes: ['Z'],
    }
    const jsonWithText = `Aqui está sua análise:\n\n${JSON.stringify(validOutput)}\n\nEspero ter ajudado!`
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: jsonWithText }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('success')
  })

  it('usa modelo Sonnet 4.6 por padrão', () => {
    expect(INSIGHTS_MODEL).toBe('claude-sonnet-4-6')
  })

  it('chama com modelo customizado quando fornecido', async () => {
    const validOutput = {
      resumoExecutivo: 'X',
      destaques: [{ tipo: 'positivo', titulo: 'X', descricao: 'Y' }],
      recomendacoes: [],
    }
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify(validOutput) }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-test',
      fetcher: mockFetch as never,
      model: 'claude-sonnet-4-5',
    })
    const fetchArgs = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(fetchArgs[1].body)
    expect(body.model).toBe('claude-sonnet-4-5')
  })

  it('sanitize errors: erro de rede não vaza apiKey', async () => {
    const mockFetch = vi.fn().mockRejectedValue(
      new Error('Network error'),
    )
    const r = await callInsightsAPI(MINIMAL_INPUT, {
      apiKey: 'sk-ant-VERY-SECRET-KEY',
      fetcher: mockFetch as never,
    })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') {
      expect(r.message).not.toContain('sk-ant-')
      expect(r.message).not.toContain('VERY-SECRET-KEY')
    }
  })
})
