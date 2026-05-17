// Cliente BrasilAPI — Camada 2B do Pipeline IA Contadora. Fase 3 Etapa 2.
//
// Consulta https://brasilapi.com.br/api/cnpj/v1/{cnpj} pra resolver:
//   - razao_social
//   - nome_fantasia
//   - cnae_fiscal (numérico)
//   - cnae_fiscal_descricao
//   - situacao_cadastral
//
// Estratégia de robustez:
//   1. Timeout 3s (não pode travar import; chamada normalmente é lazy)
//   2. Rate-limit guard EM MEMÓRIA: se receber 429, bloqueia chamadas por 60s
//   3. Cache external em Supplier (não cabe aqui — caller persiste)
//   4. Erros 404/5xx/timeout → retorna null (degrade gracioso)
//
// FETCHER injetável (pra testes mockarem sem internet real).

export interface BrasilApiCompany {
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  cnae_fiscal: number | string | null
  cnae_fiscal_descricao: string | null
  situacao_cadastral: number | null
  // ... outros campos da BrasilAPI ignorados; deixamos genérico pra futuro
}

export type BrasilApiResult =
  | { kind: 'success'; data: BrasilApiCompany }
  | { kind: 'not-found' } // CNPJ inválido / inexistente
  | { kind: 'rate-limited' } // 429
  | { kind: 'timeout' }
  | { kind: 'error'; status?: number; message: string }

// ============================================================
// Rate limit guard (em memória, instância única do server)
// ============================================================

const RATE_LIMIT_COOLDOWN_MS = 60_000
let rateLimitBlockedUntil = 0

export function isBrasilApiBlocked(): boolean {
  return Date.now() < rateLimitBlockedUntil
}

export function blockBrasilApi(durationMs = RATE_LIMIT_COOLDOWN_MS): void {
  rateLimitBlockedUntil = Date.now() + durationMs
}

export function unblockBrasilApi(): void {
  rateLimitBlockedUntil = 0
}

// ============================================================
// Fetcher principal (com fetch injetável pros testes)
// ============================================================

export const BRASILAPI_BASE_URL = 'https://brasilapi.com.br/api/cnpj/v1/'
const DEFAULT_TIMEOUT_MS = 3000

// Fetcher type alinhado com fetch global, mas aceitando timeout custom.
export type FetchLike = typeof globalThis.fetch

export interface FetchCNPJOptions {
  timeoutMs?: number
  fetcher?: FetchLike
  // Quando true, ignora rate-limit guard (uso interno em retry controlado)
  forceBypassRateLimit?: boolean
}

export async function fetchCNPJ(
  cnpj: string,
  options: FetchCNPJOptions = {},
): Promise<BrasilApiResult> {
  const cleanCnpj = cnpj.replace(/\D/g, '')
  if (cleanCnpj.length !== 14) {
    return { kind: 'error', message: 'CNPJ deve ter 14 dígitos' }
  }

  if (!options.forceBypassRateLimit && isBrasilApiBlocked()) {
    return { kind: 'rate-limited' }
  }

  const fetcher = options.fetcher ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetcher(`${BRASILAPI_BASE_URL}${cleanCnpj}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)

    if (res.status === 404) {
      return { kind: 'not-found' }
    }
    if (res.status === 429) {
      // Bloqueia futuras chamadas por 60s
      blockBrasilApi()
      return { kind: 'rate-limited' }
    }
    if (!res.ok) {
      return {
        kind: 'error',
        status: res.status,
        message: `BrasilAPI retornou ${res.status}`,
      }
    }

    const data = (await res.json()) as BrasilApiCompany
    if (!data || !data.razao_social) {
      return { kind: 'error', message: 'Resposta sem razao_social' }
    }
    return { kind: 'success', data }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      return { kind: 'timeout' }
    }
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}
