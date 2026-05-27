// Sprint 5.0.2.0 — Detecta dinamicamente colunas de planilha Excel de
// Contas a Pagar usando Claude Haiku com tool use (input_schema validado
// server-side pela Anthropic = zero parsing frágil).
//
// Estratégia:
//   1. Cache hit por hash do header (AiAnalysisCache existente): mesma
//      planilha de mesmo contador → 100% cache, custo zero.
//   2. Claude Haiku 4.5 com input_schema JSON → SEMPRE retorna estrutura
//      válida (Anthropic rejeita server-side se inválido).
//   3. Caller decide o que fazer com confidence baixo.

import { prisma } from '@/lib/db'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const PRICE_INPUT_PER_1M = 0.8
const PRICE_OUTPUT_PER_1M = 4.0

export type CanonicalField =
  | 'favorecido'
  | 'beneficiario_tipo' // "Fornecedores" / "Colaboradores" / "Órgãos oficiais"
  | 'descricao'
  | 'centro_custo'
  | 'lancamento'
  | 'competencia'
  | 'vencimento'
  | 'pagamento'
  | 'valor'
  | 'valor_baixa'
  | 'nota'
  | 'status'

export interface ColumnMapping {
  /** Mapeia campo canônico → nome da coluna detectada na planilha. null = não encontrada. */
  fields: Partial<Record<CanonicalField, string | null>>
  /** Confidence agregada da detecção (0-1). */
  confidence: number
  /** Curtidíssima explicação pra debug/UI (1 frase). */
  reasoning: string
}

export interface DetectColumnsInput {
  headers: string[]
  /** 3-5 linhas amostra (header → valor) pra contexto. */
  sampleRows: Array<Record<string, string | number | null>>
  /** Sprint n style cache: hash dos headers ordenados. */
  headerHash: string
  /** Pra escopo de cache + audit log */
  companyId: string
}

export interface DetectColumnsResult {
  mapping: ColumnMapping
  /** true se veio do cache (AiAnalysisCache). */
  fromCache: boolean
  /** Custo desta chamada (0 se cache hit). */
  costUsd: number
  responseTimeMs: number
}

const SYSTEM_PROMPT = `Você é um especialista em planilhas de Contas a Pagar do Brasil. Sua tarefa é
mapear as colunas de uma planilha pra campos canônicos do sistema CAIXAOS.

Cada planilha de contador BR pode ter colunas com nomes diferentes pro mesmo
conceito. Exemplos:
- "Favorecido" / "Fornecedor" / "Para" / "Beneficiário" / "Pago a" → favorecido
- "Beneficiário" / "Tipo" / "Categoria do favorecido" → beneficiario_tipo
  (ATENÇÃO: se já usou "Beneficiário" como favorecido, NÃO usa de novo aqui)
- "Descrição" / "Histórico" / "Memo" → descricao
- "Centro de custo" / "Categoria" / "Conta" → centro_custo
- "Lançamento" / "Emissão" / "Data" → lancamento
- "Competência" / "Mês" → competencia
- "Vencimento" / "Data Vencimento" / "Venc" → vencimento
- "Pagamento" / "Data Pagamento" / "Baixa" → pagamento
- "Valor" / "Valor total" / "R$" → valor
- "Valor baixa" / "Valor pago" → valor_baixa
- "Nota" / "Nota Fiscal" / "NF" → nota
- "Status" / "Situação" → status

REGRAS:
1. Use APENAS nomes de colunas que aparecem nos headers fornecidos.
2. Se a planilha não tiver uma coluna, retorne null pra esse campo.
3. NUNCA invente nome de coluna que não está na lista.
4. Confidence: 0.95+ se todas colunas-chave (favorecido/valor/vencimento)
   foram identificadas inequivocadamente; 0.70-0.90 se há alguma ambiguidade;
   <0.70 se planilha é atípica/incompleta.
5. reasoning: 1 frase explicando casos ambíguos (ex: "Coluna 'Data' usada
   como vencimento; sem coluna de competência").

RESPOSTA: invoque a ferramenta map_columns com o resultado.`

// Schema dos campos disponíveis (Anthropic valida server-side)
const TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['favorecido', 'valor', 'confidence', 'reasoning'],
  properties: {
    favorecido: { type: ['string', 'null'] },
    beneficiario_tipo: { type: ['string', 'null'] },
    descricao: { type: ['string', 'null'] },
    centro_custo: { type: ['string', 'null'] },
    lancamento: { type: ['string', 'null'] },
    competencia: { type: ['string', 'null'] },
    vencimento: { type: ['string', 'null'] },
    pagamento: { type: ['string', 'null'] },
    valor: { type: ['string', 'null'] },
    valor_baixa: { type: ['string', 'null'] },
    nota: { type: ['string', 'null'] },
    status: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string', maxLength: 300 },
  },
} as const

const TOOLS = [
  {
    name: 'map_columns',
    description:
      'Mapeia colunas da planilha pra campos canônicos da Contas a Pagar.',
    input_schema: TOOL_INPUT_SCHEMA,
  },
]

interface AnthropicResponse {
  content: Array<{ type: string; input?: Record<string, unknown> }>
  usage: { input_tokens: number; output_tokens: number }
}

const CACHE_KIND = 'EXCEL_COLUMN_DETECTION'

/**
 * Cache reusa AiClaudeCache (Sprint i — modelo genérico cacheKey+suggestion).
 * description e normalizedKey ficam com valores que ajudam debug visual.
 */
async function lookupCache(
  companyId: string,
  headerHash: string,
  headers: string[],
): Promise<ColumnMapping | null> {
  const cacheKey = `${CACHE_KIND}:${headerHash}`
  const row = await prisma.aiClaudeCache.findUnique({
    where: { companyId_cacheKey: { companyId, cacheKey } },
  })
  if (!row) return null
  try {
    const parsed = JSON.parse(row.suggestion) as ColumnMapping
    if (parsed && typeof parsed === 'object' && parsed.fields) {
      // Incrementa usageCount best-effort
      await prisma.aiClaudeCache
        .update({
          where: { id: row.id },
          data: { usageCount: { increment: 1 } },
        })
        .catch(() => {
          /* ignore */
        })
      return parsed
    }
  } catch {
    /* ignore */
  }
  void headers
  return null
}

async function saveCache(
  companyId: string,
  headerHash: string,
  headers: string[],
  mapping: ColumnMapping,
): Promise<void> {
  const cacheKey = `${CACHE_KIND}:${headerHash}`
  const description = `EXCEL HEADERS: ${headers.slice(0, 6).join(' | ')}${headers.length > 6 ? ' …' : ''}`
  await prisma.aiClaudeCache.upsert({
    where: { companyId_cacheKey: { companyId, cacheKey } },
    create: {
      companyId,
      cacheKey,
      description,
      normalizedKey: `excel:${headerHash}`,
      suggestion: JSON.stringify(mapping),
    },
    update: {
      suggestion: JSON.stringify(mapping),
      updatedAt: new Date(),
    },
  })
}

export async function detectColumns(
  input: DetectColumnsInput,
): Promise<DetectColumnsResult> {
  const startTime = Date.now()

  // 1) Cache hit?
  const cached = await lookupCache(input.companyId, input.headerHash, input.headers)
  if (cached) {
    return {
      mapping: cached,
      fromCache: true,
      costUsd: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Fallback: heurística simples por nomes de headers (sem IA)
    return {
      mapping: heuristicFallback(input.headers),
      fromCache: false,
      costUsd: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  // 2) Monta prompt: headers + sample rows
  const sampleStr = input.sampleRows
    .slice(0, 5)
    .map(
      (row, idx) =>
        `Linha ${idx + 1}: ` +
        input.headers
          .map((h) => `${h}=${formatCellForPrompt(row[h])}`)
          .join(' | '),
    )
    .join('\n')

  const userPrompt = [
    'HEADERS DA PLANILHA:',
    input.headers.map((h, i) => `  ${String.fromCharCode(65 + i)}: "${h}"`).join('\n'),
    '',
    'AMOSTRA (5 primeiras linhas):',
    sampleStr,
    '',
    'Invoque map_columns com o mapeamento.',
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        tool_choice: { type: 'tool', name: 'map_columns' },
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      console.error('[DETECT_COLUMNS] HTTP', res.status, await res.text().catch(() => ''))
      return {
        mapping: heuristicFallback(input.headers),
        fromCache: false,
        costUsd: 0,
        responseTimeMs: Date.now() - startTime,
      }
    }

    const data = (await res.json()) as AnthropicResponse
    const toolUse = data.content.find((c) => c.type === 'tool_use')
    if (!toolUse?.input) {
      return {
        mapping: heuristicFallback(input.headers),
        fromCache: false,
        costUsd: 0,
        responseTimeMs: Date.now() - startTime,
      }
    }

    const parsed = toolUse.input as Record<string, unknown>
    const fields: ColumnMapping['fields'] = {}
    const FIELD_NAMES: CanonicalField[] = [
      'favorecido',
      'beneficiario_tipo',
      'descricao',
      'centro_custo',
      'lancamento',
      'competencia',
      'vencimento',
      'pagamento',
      'valor',
      'valor_baixa',
      'nota',
      'status',
    ]
    for (const k of FIELD_NAMES) {
      const v = parsed[k]
      fields[k] = typeof v === 'string' && input.headers.includes(v) ? v : null
    }
    const confidence = clamp01(Number(parsed.confidence) || 0.5)
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''

    const mapping: ColumnMapping = { fields, confidence, reasoning }

    const inputTok = data.usage?.input_tokens ?? 0
    const outputTok = data.usage?.output_tokens ?? 0
    const costUsd =
      (inputTok * PRICE_INPUT_PER_1M + outputTok * PRICE_OUTPUT_PER_1M) / 1_000_000

    // 3) Salva no cache se confidence aceitável
    if (confidence >= 0.6) {
      await saveCache(input.companyId, input.headerHash, input.headers, mapping).catch(() => {
        /* best-effort */
      })
    }

    return {
      mapping,
      fromCache: false,
      costUsd,
      responseTimeMs: Date.now() - startTime,
    }
  } catch (err) {
    console.error('[DETECT_COLUMNS] erro:', err)
    return {
      mapping: heuristicFallback(input.headers),
      fromCache: false,
      costUsd: 0,
      responseTimeMs: Date.now() - startTime,
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function formatCellForPrompt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '(vazio)'
  return String(v).slice(0, 80)
}

/**
 * Fallback heurístico quando Claude indisponível.
 * Match por contains case-insensitive em headers.
 */
export function heuristicFallback(headers: string[]): ColumnMapping {
  const HINTS: Record<CanonicalField, string[]> = {
    favorecido: ['favorecido', 'fornecedor', 'pago a', 'para', 'destinatario'],
    beneficiario_tipo: ['beneficiário', 'beneficiario', 'tipo do favorecido'],
    descricao: ['descrição', 'descricao', 'histórico', 'historico', 'memo'],
    centro_custo: ['centro de custo', 'categoria', 'conta'],
    lancamento: ['lançamento', 'lancamento', 'emissão', 'emissao', 'data'],
    competencia: ['competência', 'competencia', 'mês', 'mes'],
    vencimento: ['vencimento', 'venc'],
    pagamento: ['pagamento', 'baixa', 'data pagto'],
    valor: ['valor', 'r$', 'total'],
    valor_baixa: ['valor baixa', 'valor pago'],
    nota: ['nota', 'nf', 'documento'],
    status: ['status', 'situação', 'situacao'],
  }

  const fields: ColumnMapping['fields'] = {}
  const used = new Set<string>()
  let hits = 0

  for (const field of Object.keys(HINTS) as CanonicalField[]) {
    const hints = HINTS[field]
    const match = headers.find((h) => {
      if (used.has(h)) return false
      const lower = h.toLowerCase().trim()
      return hints.some((hint) => lower.includes(hint))
    })
    if (match) {
      fields[field] = match
      used.add(match)
      hits++
    } else {
      fields[field] = null
    }
  }

  // Confidence: % de campos essenciais identificados
  const essentials = (['favorecido', 'valor', 'vencimento'] as const).filter(
    (f) => fields[f],
  ).length
  const confidence = essentials === 3 ? 0.8 : essentials === 2 ? 0.6 : 0.4

  return {
    fields,
    confidence,
    reasoning: `Fallback heurístico (sem Claude): ${hits} campos identificados`,
  }
}
