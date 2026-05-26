// Sprint 5.0.2.d — Claude Sonnet 4.6 analisa empresa com dados reais.
//
// Padrão do projeto: fetch DIRETO na API Anthropic (sem SDK) + fetcher
// injetável pra testes. Loop de tool use até MAX_ROUNDS iterações.
//
// Modelo: claude-sonnet-4-6 (qualidade de raciocínio pra análise complexa)
// Pricing 2026 (Sonnet 4.6): $3/MTok input, $15/MTok output.

import { TAX_EXPERT_SYSTEM_PROMPT } from '@/lib/tax/expert-prompt'
import {
  TAX_ANALYSIS_TOOLS,
  executeToolCall,
  SUBMIT_ANALYSIS_TOOL_NAME,
  type ToolInput,
} from './tools'
import type { CompanyTaxAnalysisData } from './data-aggregator'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_TOKENS = 4096
const MAX_TOOL_ROUNDS = 10

// Pricing Sonnet 4.6 (USD por 1M tokens)
const PRICE_INPUT_PER_M_USD = 3.0
const PRICE_OUTPUT_PER_M_USD = 15.0

export type FetchLike = typeof globalThis.fetch

export interface TaxAnalysisResult {
  resumoExecutivo: {
    cenarioAtual: string
    impostoPagoEstimado: number
    aliquotaEfetiva: number
    economiaPotencialAnual: number
  }
  oportunidades: Array<{
    prioridade: number
    titulo: string
    descricao: string
    economiaAnual: number
    baseLegal: string
    passosPraticos: string[]
    risco: 'BAIXO' | 'MEDIO' | 'ALTO'
  }>
  comparativoRegimes: {
    atual: { regime: string; total: number; aliquota: number }
    simples?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
    presumido?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
    real?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
    recomendacao: string
  }
  beneficiosEspecificos: Array<{
    tipo: string
    descricao: string
    economiaAnual: number
    aplicavel: boolean
    motivoAplicacao: string
  }>
  benchmarkRedes: Array<{
    rede: string
    regime: string
    estrategias: string[]
    aplicabilidade: string
  }>
  proximosPassos: Array<{
    ordem: number
    acao: string
    urgencia: 'IMEDIATA' | '30_DIAS' | '90_DIAS' | 'PROXIMO_ANO'
    impactoFinanceiro: number
  }>
}

export interface AnalysisMetadata {
  tokensInput: number
  tokensOutput: number
  modeloUsado: string
  duracaoMs: number
  costUSD: number
  toolRounds: number
}

export type AnalyzerResult =
  | { kind: 'success'; analysis: TaxAnalysisResult; metadata: AnalysisMetadata }
  | { kind: 'disabled'; reason: string }
  | { kind: 'timeout' }
  | { kind: 'error'; status?: number; message: string }
  | { kind: 'invalid-json'; rawText: string }
  | { kind: 'max-rounds-exceeded' }

export interface AnalyzerOptions {
  fetcher?: FetchLike
  timeoutMs?: number
  apiKey?: string
  model?: string
  enabled?: boolean
  /** Override do system prompt (pra testes) */
  systemPrompt?: string
}

export function isAnalyzerEnabled(): boolean {
  if (process.env.AI_CLAUDE_ENABLED === 'false') return false
  if (!process.env.ANTHROPIC_API_KEY) return false
  return true
}

interface AnthropicTextBlock {
  type: 'text'
  text: string
}

interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: ToolInput
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[] | unknown
}

interface AnthropicResponse {
  content: AnthropicContentBlock[]
  stop_reason: string
  usage: { input_tokens: number; output_tokens: number }
}

/**
 * Analisa empresa com Claude. Multi-round tool use até resposta final.
 */
export async function analyzeTaxOptimization(
  data: CompanyTaxAnalysisData,
  options: AnalyzerOptions = {},
): Promise<AnalyzerResult> {
  const enabled = options.enabled ?? isAnalyzerEnabled()
  if (!enabled) {
    return {
      kind: 'disabled',
      reason: !process.env.ANTHROPIC_API_KEY
        ? 'ANTHROPIC_API_KEY não configurada'
        : 'AI_CLAUDE_ENABLED=false',
    }
  }

  const start = Date.now()
  const fetcher = options.fetcher ?? globalThis.fetch
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? ''
  const model = options.model ?? process.env.AI_CLAUDE_MODEL ?? DEFAULT_MODEL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const systemPrompt =
    (options.systemPrompt ?? TAX_EXPERT_SYSTEM_PROMPT) +
    `\n\nIMPORTANTE: Após coletar os dados via get_knowledge / calculate_regime / get_benchmark_redes, você DEVE chamar a tool 'submit_analysis' com a análise final estruturada. NÃO escreva JSON em texto livre — use SEMPRE a tool submit_analysis pra retornar o resultado final.`

  const messages: AnthropicMessage[] = [
    { role: 'user', content: buildAnalysisContext(data) },
  ]

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let rounds = 0

  for (rounds = 0; rounds < MAX_TOOL_ROUNDS; rounds++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: AnthropicResponse
    try {
      const res = await fetcher(CLAUDE_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: systemPrompt,
          tools: TAX_ANALYSIS_TOOLS,
          messages,
        }),
      })
      clearTimeout(timer)

      if (!res.ok) {
        const text = await safeText(res)
        return {
          kind: 'error',
          status: res.status,
          message: text || `HTTP ${res.status}`,
        }
      }

      response = (await res.json()) as AnthropicResponse
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { kind: 'timeout' }
      }
      return {
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      }
    }

    totalInputTokens += response.usage.input_tokens
    totalOutputTokens += response.usage.output_tokens

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(
        (b): b is AnthropicToolUseBlock => b.type === 'tool_use',
      )
      if (toolUses.length === 0) break

      // Sprint 5.0.2.e — submit_analysis retorna estrutura GARANTIDA via tool input
      const submitCall = toolUses.find((t) => t.name === SUBMIT_ANALYSIS_TOOL_NAME)
      if (submitCall) {
        const costUSD =
          (totalInputTokens * PRICE_INPUT_PER_M_USD) / 1_000_000 +
          (totalOutputTokens * PRICE_OUTPUT_PER_M_USD) / 1_000_000
        return {
          kind: 'success',
          analysis: submitCall.input as unknown as TaxAnalysisResult,
          metadata: {
            tokensInput: totalInputTokens,
            tokensOutput: totalOutputTokens,
            modeloUsado: model,
            duracaoMs: Date.now() - start,
            costUSD,
            toolRounds: rounds,
          },
        }
      }

      // Tools "normais" (não-submit) — executa todas em paralelo e continua loop
      const toolResults = toolUses.map((tu) => ({
        type: 'tool_result' as const,
        tool_use_id: tu.id,
        content: executeToolCall(tu.name, tu.input),
      }))

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Fallback: Claude respondeu com texto em vez de chamar submit_analysis.
    // Parser tolerante em 4 estratégias.
    const textBlock = response.content.find(
      (b): b is AnthropicTextBlock => b.type === 'text',
    )
    if (!textBlock) {
      return { kind: 'invalid-json', rawText: JSON.stringify(response.content) }
    }

    const parsed = tryParseJson(textBlock.text)
    if (!parsed) {
      return { kind: 'invalid-json', rawText: textBlock.text }
    }

    const costUSD =
      (totalInputTokens * PRICE_INPUT_PER_M_USD) / 1_000_000 +
      (totalOutputTokens * PRICE_OUTPUT_PER_M_USD) / 1_000_000

    return {
      kind: 'success',
      analysis: parsed as TaxAnalysisResult,
      metadata: {
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
        modeloUsado: model,
        duracaoMs: Date.now() - start,
        costUSD,
        toolRounds: rounds,
      },
    }
  }

  return { kind: 'max-rounds-exceeded' }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

/**
 * Parser tolerante em 4 estratégias. Sprint 5.0.2.e — fallback caso
 * Claude não use a tool submit_analysis e responda em texto.
 */
export function tryParseJson(text: string): unknown {
  if (!text || typeof text !== 'string') return null

  // 1. JSON puro
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {}

  // 2. Remove markdown ```json e ```
  const noMarkdown = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  if (noMarkdown !== trimmed) {
    try {
      return JSON.parse(noMarkdown)
    } catch {}
  }

  // 3. Extrai primeiro objeto JSON balanceado (regex greedy)
  const match = noMarkdown.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {}
  }

  // 4. Trim de prosa antes/depois (último recurso)
  const fromBrace = noMarkdown.indexOf('{')
  const lastBrace = noMarkdown.lastIndexOf('}')
  if (fromBrace >= 0 && lastBrace > fromBrace) {
    try {
      return JSON.parse(noMarkdown.slice(fromBrace, lastBrace + 1))
    } catch {}
  }

  return null
}

/**
 * Monta o contexto user message com os dados financeiros REAIS da empresa.
 */
export function buildAnalysisContext(data: CompanyTaxAnalysisData): string {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fatorR =
    data.financial.receitaTotal > 0
      ? (data.financial.folhaIdentificada / data.financial.receitaTotal) * 100
      : 0

  const lines: string[] = [
    '# ANÁLISE TRIBUTÁRIA — DADOS REAIS DA EMPRESA',
    '',
    '## EMPRESA',
    `Nome: ${data.companyName}`,
    `CNPJ: ${data.cnpj || 'N/I'}`,
    data.cnae
      ? `CNAE: ${data.cnae.code} — ${data.cnae.name}`
      : 'CNAE: NÃO CADASTRADO (limita análise)',
    data.cnae ? `Ramo: ${data.cnae.ramo}` : '',
    '',
    '## REGIME TRIBUTÁRIO ATUAL',
    `Regime: ${data.taxProfile.regime}`,
    data.taxProfile.simplesAnexo ? `Anexo Simples: ${data.taxProfile.simplesAnexo}` : '',
    `Estado (UF): ${data.taxProfile.estado}`,
    `hasICMS: ${data.taxProfile.hasICMS} · hasISS: ${data.taxProfile.hasISS}`,
    `Folha 12m (declarada): ${fmt(data.taxProfile.folha12m)}`,
    `Pró-labore mensal (declarado): ${fmt(data.taxProfile.proLabore)}`,
    data.taxProfile.regime === 'LUCRO_REAL'
      ? `Margem real declarada: ${data.taxProfile.margemReal}%`
      : '',
    '',
    '## DADOS FINANCEIROS REAIS (últimos 12 meses)',
    `Período: ${data.financial.periodStart.toISOString().slice(0, 10)} a ${data.financial.periodEnd.toISOString().slice(0, 10)}`,
    '',
    '### RECEITA',
    `Total 12m: ${fmt(data.financial.receitaTotal)}`,
    `Mensal média: ${fmt(data.financial.receitaMensalMedia)}`,
    `Receita por mês (R$):`,
    ...data.financial.receitaPorMes.map((m) => `  ${m.mes}: ${fmt(m.valor)}`),
    '',
    '### DESPESAS',
    `Total 12m: ${fmt(data.financial.despesaTotal)}`,
    `Mensal média: ${fmt(data.financial.despesaMensalMedia)}`,
    `Margem bruta: ${(data.financial.margemBruta * 100).toFixed(1)}%`,
    `Margem líquida estimada: ${(data.financial.margemLiquidaEstimada * 100).toFixed(1)}%`,
    '',
    '### TOP 10 CATEGORIAS DE DESPESA',
    ...data.financial.despesasPorCategoria
      .slice(0, 10)
      .map(
        (c, i) =>
          `${i + 1}. ${c.category}: ${fmt(c.valor)} (${c.pct.toFixed(1)}%)`,
      ),
    '',
    '### FOLHA IDENTIFICADA NAS TRANSAÇÕES',
    `Valor 12m: ${fmt(data.financial.folhaIdentificada)}`,
    `Fator R (folha ÷ receita): ${fatorR.toFixed(1)}%${fatorR >= 28 ? ' ✓ acima 28%' : ' × abaixo 28%'}`,
    '',
    '### TOP FORNECEDORES (até 10)',
    ...data.financial.fornecedoresTop
      .slice(0, 10)
      .map(
        (f, i) =>
          `${i + 1}. ${f.nome} (${f.categoria}) — ${fmt(f.valor12m)} em ${f.transacoes} tx`,
      ),
    '',
    '### COMPRAS DETECTADAS (Sprint 5.0.2.f — geram créditos PIS/COFINS no Lucro Real)',
    `Total 12m: ${fmt(data.compras.total12m)}`,
    `Mensal média: ${fmt(data.compras.mensalMedia)}`,
    `% sobre receita: ${(data.compras.percentSobreReceita * 100).toFixed(1)}%`,
    `Fornecedores únicos: ${data.compras.fornecedoresDetectados}`,
    data.compras.total12m === 0
      ? '⚠️ Nenhuma compra detectada — usar `comprasMes: 0` no calculate_regime (Lucro Real ficará caro sem créditos).'
      : `✅ Use **comprasMes: ${Math.round(data.compras.mensalMedia)}** ao chamar calculate_regime para LUCRO_REAL.`,
    '',
    '## IMPOSTOS DETECTADOS NAS TRANSAÇÕES',
    data.impostosAtual.detectados.length === 0
      ? 'Nenhum imposto identificado pelas descrições/categorias das transações.'
      : data.impostosAtual.detectados
          .map((i) => `- ${i.tipo}: ${fmt(i.valor12m)} (${i.fonte})`)
          .join('\n'),
    `Total pago estimado: ${fmt(data.impostosAtual.totalPagoEstimado)}`,
    `Alíquota efetiva atual: ${data.impostosAtual.aliquotaEfetivaAtual.toFixed(2)}%`,
    '',
    '---',
    '',
    '# TAREFA',
    '',
    'Faça análise tributária COMPLETA dessa empresa usando os dados REAIS acima:',
    '',
    '1. RESUMO EXECUTIVO — cenário atual, imposto pago, alíquota efetiva, economia potencial total/ano',
    '2. COMPARATIVO 3 REGIMES — USE a tool `calculate_regime` pra Simples + Presumido + Real, baseado na receita média mensal. Para Lucro Real passe SEMPRE `comprasMes` (já detectado acima). Se receita anual projetada > R$ 4,8M, Simples é NÃO APLICÁVEL (LC 123/06 art. 3º) — não recomende. Se > R$ 78M, Presumido também é NÃO APLICÁVEL (Lei 9.718 art. 13).',
    '3. OPORTUNIDADES — use `get_knowledge` pra citar leis específicas. Quantifique CADA UMA em R$/ano.',
    '4. BENEFÍCIOS ESPECÍFICOS — use `get_knowledge` topic="beneficios-fiscais" + topic relevante ao ramo (ex: monofásico se restaurante). PERSE, ICMS-ST, Fator R.',
    '5. BENCHMARK GRANDES REDES — use `get_benchmark_redes` com o ramo. Mostre como Madero/Smart Fit/Renner fazem e adaptação prática pra ESSA empresa.',
    '6. PRÓXIMOS PASSOS — ordenados, com urgência e impacto em R$.',
    '',
    'REGRAS:',
    '- USE as tools. Não invente leis.',
    '- Cite artigos específicos (LC 123/2006 art. X, etc).',
    '- Valores SEMPRE em R$ (BRL, não % isolada).',
    '- Considere os dados REAIS fornecidos (não médias do setor).',
    '- Responda APENAS o JSON final (sem texto extra).',
  ]

  return lines.filter(Boolean).join('\n')
}

export function costFromUsage(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * PRICE_INPUT_PER_M_USD) / 1_000_000 +
    (outputTokens * PRICE_OUTPUT_PER_M_USD) / 1_000_000
  )
}
