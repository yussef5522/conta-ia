// Sprint Empréstimos AI/Contrato (17/06/2026) — extração de contrato via Claude.
//
// Recebe PDF (bytes), manda pro Claude Vision com prompt estruturado pedindo
// JSON com campos do empréstimo + status atual + lista de parcelas a pagar.
//
// Princípio: PRE-PREENCHER. Caller mostra ao usuário pra revisar antes de
// salvar. Errar nada cego.

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_PDF_BYTES = 5 * 1024 * 1024
const MAX_OUTPUT_TOKENS = 8000
const DEFAULT_TIMEOUT_MS = 60_000

export type ContractRateType = 'PRE' | 'POS'
export type ContractIndexer = 'CDI' | 'SELIC' | 'IPCA' | null
export type ContractAmortizationSystem = 'PRICE' | 'SAC'

export interface ContractInstallmentToPay {
  number: number
  /** ISO YYYY-MM-DD */
  dueDate: string
  /** Valor da parcela (estimado quando pós-fixado) */
  payment: number
  /** Desconto se aplicado (opcional) */
  discount?: number | null
}

export interface ContractExtraction {
  /** Banco / instituição (lender) */
  bank: string | null
  /** Nº do contrato */
  contractNumber: string | null
  /** Sistema de amortização */
  amortizationSystem: ContractAmortizationSystem | null
  /** Pré-fixado ou pós-fixado */
  rateType: ContractRateType | null
  /** Indexador quando pós-fixado */
  indexer: ContractIndexer
  /** % do indexador (100 = 100% CDI) */
  indexerPercent: number | null
  /** Data da CONTRATAÇÃO do empréstimo (assinatura). YYYY-MM-DD */
  dataContratacao: string | null
  /** Data da LIBERAÇÃO do dinheiro (crédito caiu na conta). YYYY-MM-DD */
  dataLiberacao: string | null
  /** Valor inicial liberado (sem IOF) */
  principal: number | null
  /** Valor financiado total (principal + IOF + tarifas, opcional) */
  valorFinanciado: number | null
  iof: number | null
  tarifas: number | null
  /** Taxa pré mensal em decimal (0.0035 = 0,35% a.m.) */
  taxaPreMensal: number | null
  /** Total de parcelas do contrato */
  nParcelas: number | null
  parcelasPagas: number | null
  parcelasAPagar: number | null
  /** Data da primeira parcela */
  primeiraParcela: string | null
  vencimentoFinal: string | null
  /** Dia do mês de vencimento */
  diaVencimento: number | null
  /** SALDO DEVEDOR ATUAL — usado pra criar Loan em andamento */
  saldoDevedorAtual: number | null
  /** SAC: amortização constante */
  amortizacaoConstante: number | null
  /** N primeiras parcelas sem amortização */
  carencia: number | null
  /** Lista de parcelas A PAGAR (futuro) */
  parcelasAPagarLista: ContractInstallmentToPay[]
  /** Avisos do parser (string vazia quando OK) */
  warnings: string[]
}

export interface ContractExtractDeps {
  fetch?: typeof fetch
  apiKey?: string
  modelOverride?: string
  timeoutMs?: number
}

export class ContractExtractError extends Error {
  constructor(
    message: string,
    public code:
      | 'PDF_INVALID'
      | 'PDF_TOO_LARGE'
      | 'PDF_ENCRYPTED'
      | 'CLAUDE_API_ERROR'
      | 'CLAUDE_TIMEOUT'
      | 'JSON_PARSE_ERROR',
  ) {
    super(message)
    this.name = 'ContractExtractError'
  }
}

const PROMPT = `Você é um especialista em contratos de empréstimo bancário brasileiro.

Receba este PDF de contrato e extraia os campos abaixo em JSON. NÃO invente: se um campo não estiver no contrato, retorne null.

Estrutura exata:
{
  "bank": "Banrisul" | "Sicredi" | "Itaú" | ... | null,
  "contractNumber": string | null,
  "amortizationSystem": "PRICE" | "SAC" | null,
  "rateType": "PRE" | "POS" | null,
  "indexer": "CDI" | "SELIC" | "IPCA" | null,
  "indexerPercent": number | null,
  "dataContratacao": "YYYY-MM-DD" | null,
  "dataLiberacao": "YYYY-MM-DD" | null,
  "principal": number | null,
  "valorFinanciado": number | null,
  "iof": number | null,
  "tarifas": number | null,
  "taxaPreMensal": number | null,
  "nParcelas": number | null,
  "parcelasPagas": number | null,
  "parcelasAPagar": number | null,
  "primeiraParcela": "YYYY-MM-DD" | null,
  "vencimentoFinal": "YYYY-MM-DD" | null,
  "diaVencimento": number | null,
  "saldoDevedorAtual": number | null,
  "amortizacaoConstante": number | null,
  "carencia": number | null,
  "parcelasAPagarLista": [
    { "number": int, "dueDate": "YYYY-MM-DD", "payment": number, "discount": number | null }
  ],
  "warnings": [string]
}

Regras importantes:
1. taxaPreMensal: DECIMAL. 0,35% a.m. = 0.0035. NUNCA 0.35.
2. indexerPercent: 100 = 100% do indexador. 130 = 130%.
3. Se for CDC SAC/CDI = pós-fixado (POS) com indexer="CDI". Se for tabela PRICE pura = PRE.
4. dataContratacao: data de assinatura do contrato ("Data da Contratação", "Data Contratação"). YYYY-MM-DD.
5. dataLiberacao: data em que o dinheiro caiu na conta ("LIBERAÇÃO em DD/MM/AAAA", "Data Liberação", "Data Crédito"). Quando o contrato traz só 1 data, use a mesma pros dois campos. YYYY-MM-DD.
6. saldoDevedorAtual: PROCURE "Valor para Liquidação na Data" ou "Saldo Devedor Atual". É o valor que o cliente teria que pagar HOJE pra quitar.
5. amortizacaoConstante: SAC tem amortização fixa por parcela (ex: R$ 1.898,69). Se SAC, EXTRAIR.
6. parcelasAPagarLista: lista TODAS as parcelas A PAGAR (futuras). NÃO incluir as já pagas.
7. carencia: N primeiras parcelas SEM amortização (só juros). Em SAC com carência, primeiras N parcelas têm amort=0.
8. warnings: liste qualquer ambiguidade ou campo que precisou inferir.

Retorne APENAS o JSON, sem texto antes ou depois. Sem backticks.`

export async function extractContract(
  pdfBytes: Uint8Array,
  deps: ContractExtractDeps = {},
): Promise<ContractExtraction> {
  if (pdfBytes.length === 0) {
    throw new ContractExtractError('PDF vazio', 'PDF_INVALID')
  }
  if (pdfBytes.length > MAX_PDF_BYTES) {
    throw new ContractExtractError(
      `PDF muito grande (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB; máximo 5 MB)`,
      'PDF_TOO_LARGE',
    )
  }
  const headerSample = new TextDecoder('utf-8', { fatal: false }).decode(
    pdfBytes.slice(0, Math.min(2048, pdfBytes.length)),
  )
  if (!headerSample.startsWith('%PDF-')) {
    throw new ContractExtractError(
      'Arquivo não parece ser um PDF válido (sem header %PDF-).',
      'PDF_INVALID',
    )
  }
  if (/\/Encrypt\b/.test(headerSample)) {
    throw new ContractExtractError(
      'PDF está com senha. Remova a proteção e tente de novo.',
      'PDF_ENCRYPTED',
    )
  }

  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ContractExtractError(
      'ANTHROPIC_API_KEY não configurada no servidor.',
      'CLAUDE_API_ERROR',
    )
  }
  const model = deps.modelOverride ?? process.env.AI_CLAUDE_VISION_MODEL ?? DEFAULT_MODEL
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new ContractExtractError('Timeout esperando Claude', 'CLAUDE_TIMEOUT')
    }
    throw new ContractExtractError(`Falha de rede: ${(e as Error)?.message}`, 'CLAUDE_API_ERROR')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ContractExtractError(
      `Claude API ${res.status}: ${body.slice(0, 200)}`,
      'CLAUDE_API_ERROR',
    )
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = json.content?.find((c) => c.type === 'text')?.text ?? ''
  let parsed: unknown
  try {
    // Trim possíveis backticks de saída fora do esperado
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '')
    parsed = JSON.parse(clean)
  } catch {
    throw new ContractExtractError('Resposta não-JSON do Claude', 'JSON_PARSE_ERROR')
  }
  return normalizeExtraction(parsed)
}

/**
 * Normaliza a resposta crua do Claude pra shape ContractExtraction tipado.
 * Resiliente a campos ausentes / tipos errados.
 */
export function normalizeExtraction(raw: unknown): ContractExtraction {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.').replace(/[^\d.\-]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    return null
  }
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 ? v : null
  const sys = (v: unknown): ContractAmortizationSystem | null => {
    const s = (typeof v === 'string' ? v : '').toUpperCase()
    if (s === 'PRICE' || s === 'SAC') return s
    return null
  }
  const rt = (v: unknown): ContractRateType | null => {
    const s = (typeof v === 'string' ? v : '').toUpperCase()
    if (s === 'PRE' || s === 'POS') return s
    return null
  }
  const idx = (v: unknown): ContractIndexer => {
    const s = (typeof v === 'string' ? v : '').toUpperCase()
    if (s === 'CDI' || s === 'SELIC' || s === 'IPCA') return s
    return null
  }
  const list: ContractInstallmentToPay[] = Array.isArray(obj.parcelasAPagarLista)
    ? ((obj.parcelasAPagarLista as unknown[])
        .map((it): ContractInstallmentToPay | null => {
          const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
          const number = num(o.number)
          const dueDate = str(o.dueDate)
          const payment = num(o.payment)
          if (number === null || dueDate === null || payment === null) return null
          return { number, dueDate, payment, discount: num(o.discount) }
        })
        .filter((x) => x !== null) as ContractInstallmentToPay[])
    : []

  return {
    bank: str(obj.bank),
    contractNumber: str(obj.contractNumber),
    amortizationSystem: sys(obj.amortizationSystem),
    rateType: rt(obj.rateType),
    indexer: idx(obj.indexer),
    indexerPercent: num(obj.indexerPercent),
    dataContratacao: str(obj.dataContratacao),
    dataLiberacao: str(obj.dataLiberacao),
    principal: num(obj.principal),
    valorFinanciado: num(obj.valorFinanciado),
    iof: num(obj.iof),
    tarifas: num(obj.tarifas),
    taxaPreMensal: num(obj.taxaPreMensal),
    nParcelas: num(obj.nParcelas),
    parcelasPagas: num(obj.parcelasPagas),
    parcelasAPagar: num(obj.parcelasAPagar),
    primeiraParcela: str(obj.primeiraParcela),
    vencimentoFinal: str(obj.vencimentoFinal),
    diaVencimento: num(obj.diaVencimento),
    saldoDevedorAtual: num(obj.saldoDevedorAtual),
    amortizacaoConstante: num(obj.amortizacaoConstante),
    carencia: num(obj.carencia),
    parcelasAPagarLista: list,
    warnings: Array.isArray(obj.warnings)
      ? (obj.warnings as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
  }
}
