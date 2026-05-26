// Sprint 5.0.2.n — Consulta ao Claude Haiku pra identificar vendor BR.
//
// Usado APENAS quando:
//   1. Cache global não tem o vendor
//   2. BrasilAPI não retornou (ou descrição não tem CNPJ)
//
// Salva o resultado no cache global pra próximas consultas.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

// Pricing aproximado Haiku 4.5 (USD per 1M tokens)
const PRICE_INPUT_PER_1M = 0.8
const PRICE_OUTPUT_PER_1M = 4.0

export interface ClaudeVendorResult {
  vendorName: string
  razaoSocial: string | null
  nomeFantasia: string | null
  ramoAtividade: string
  categoriaSugerida: string
  confidence: number
  description: string
  custoApi: number
  rawJson?: unknown
}

export interface ClaudeVendorInput {
  vendorName: string
  cnpj?: string | null
  transactionDescription: string
  transactionType: 'DEBIT' | 'CREDIT'
}

const SYSTEM_PROMPT = `Você é um especialista em categorização contábil de transações bancárias brasileiras.

Sua tarefa: identificar quem é um vendor (fornecedor/cliente) que apareceu em uma transação bancária brasileira e sugerir a categoria contábil adequada.

REGRAS CRÍTICAS:
1. Use APENAS conhecimento verificado. Se não souber, retorne confidence baixo (<0.7).
2. NUNCA invente informações. Melhor admitir incerteza.
3. Empresas brasileiras conhecidas: use dados públicos (CNAE, ramo).
4. Categorias devem usar padrões contábeis BR.

CATEGORIAS COMUNS:
- Software/Tecnologia
- Fornecedor Bebidas, Fornecedor Carnes, Fornecedor Alimentos
- Compras Mercadoria
- Energia Elétrica, Água e Esgoto, Telefonia e Internet, Gás
- Tarifas Bancárias, Taxa Cartão
- Salários, Vale Alimentação, Vale Refeição, Vale Transporte
- Aluguel, Condomínio
- Combustível, Frete
- Marketing Digital
- Honorários Contábeis, Honorários Jurídicos
- Assinaturas/Streaming
- Refeições/Alimentação, Receita Delivery
- Saúde/Clínica, Educação/Cursos

RESPOSTA: JSON puro, sem markdown.`

function buildUserPrompt(input: ClaudeVendorInput): string {
  const tipo =
    input.transactionType === 'DEBIT' ? 'pagamento (despesa)' : 'recebimento (receita)'
  return [
    `Identifique este vendor que apareceu em ${tipo} bancário brasileiro:`,
    '',
    `Nome detectado: ${input.vendorName}`,
    input.cnpj ? `CNPJ: ${input.cnpj}` : '',
    `Descrição completa: ${input.transactionDescription}`,
    '',
    'Retorne JSON:',
    '{',
    '  "vendor_existe": true|false,',
    '  "razao_social": "...",',
    '  "nome_fantasia": "...",',
    '  "ramo_atividade": "descrição curta do que faz",',
    '  "categoria_sugerida": "uma das categorias da lista",',
    '  "confidence": 0.0-1.0,',
    '  "description": "explicação curta pro usuário"',
    '}',
    '',
    'Se NÃO conhecer o vendor, retorne confidence < 0.5.',
  ]
    .filter(Boolean)
    .join('\n')
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>
  usage: { input_tokens: number; output_tokens: number }
}

/**
 * Pergunta ao Claude. Timeout 8s. Falha → retorna confidence 0.3.
 *
 * Caller é responsável por:
 *  - decidir se chama (não tem cache, não tem brasilapi)
 *  - persistir resultado no cache global se confidence ≥ threshold
 */
export async function askClaudeAboutVendor(
  input: ClaudeVendorInput,
): Promise<ClaudeVendorResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return fallbackResult(input.vendorName)
  }

  const userPrompt = buildUserPrompt(input)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

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
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      console.error('[CLAUDE_VENDOR] HTTP', res.status)
      return fallbackResult(input.vendorName)
    }

    const data = (await res.json()) as AnthropicResponse
    const text = data.content.find((c) => c.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean) as {
      razao_social?: string
      nome_fantasia?: string
      ramo_atividade?: string
      categoria_sugerida?: string
      confidence?: number | string
      description?: string
    }

    const inputTok = data.usage?.input_tokens ?? 0
    const outputTok = data.usage?.output_tokens ?? 0
    const custoApi =
      (inputTok * PRICE_INPUT_PER_1M + outputTok * PRICE_OUTPUT_PER_1M) / 1_000_000

    const confidenceNum =
      typeof parsed.confidence === 'number'
        ? parsed.confidence
        : parseFloat(String(parsed.confidence ?? '0.5'))

    return {
      vendorName: parsed.nome_fantasia || parsed.razao_social || input.vendorName,
      razaoSocial: parsed.razao_social ?? null,
      nomeFantasia: parsed.nome_fantasia ?? null,
      ramoAtividade: parsed.ramo_atividade ?? 'Desconhecido',
      categoriaSugerida: parsed.categoria_sugerida ?? 'A Categorizar',
      confidence: Math.max(0, Math.min(1, confidenceNum || 0.5)),
      description: parsed.description ?? '',
      custoApi,
      rawJson: parsed,
    }
  } catch (err) {
    console.error('[CLAUDE_VENDOR] erro:', err)
    return fallbackResult(input.vendorName)
  } finally {
    clearTimeout(timeout)
  }
}

function fallbackResult(vendorName: string): ClaudeVendorResult {
  return {
    vendorName,
    razaoSocial: null,
    nomeFantasia: null,
    ramoAtividade: 'Desconhecido',
    categoriaSugerida: 'A Categorizar',
    confidence: 0.3,
    description: 'Não consegui identificar este vendor.',
    custoApi: 0,
  }
}
