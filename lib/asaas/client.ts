// Sprint Asaas FATIA 3A (31/05/2026) — Cliente HTTP do Asaas.
//
// 🛡️ REGRAS DE SEGURANÇA (não-negociáveis — testadas):
//   1. A `access_token` (chave da API) NUNCA aparece em log, erro,
//      stack, ou mensagem retornada pra cliente.
//   2. Logs de erro chamam SÓ `console.error` com (path, statusCode,
//      body Asaas) — nunca com `headers`, nunca com `apiKey`.
//   3. URL base é sempre logada como nome do ambiente ('sandbox' OR
//      'production'), nunca como URL completa.
//   4. Headers são montados localmente dentro do request — nenhuma
//      caller passa headers (impossível misturar credencial).

import { loadAsaasConfig, type AsaasEnvSource } from './config'
import { AsaasApiError, AsaasNetworkError } from './errors'
import type { AsaasErrorBody } from './types'

export interface AsaasRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Timeout em ms. Default 15s. */
  timeoutMs?: number
}

/**
 * fetch injetável pra testes. Default: global fetch.
 * Garante que os testes podem mockar sem mexer em globals.
 */
export type FetchLike = typeof fetch

interface AsaasRequestDeps {
  /** Override de process.env (pra testes determinísticos). */
  env?: AsaasEnvSource
  /** Override de fetch (pra mockar testes). */
  fetch?: FetchLike
}

/**
 * Faz uma chamada autenticada na API do Asaas e retorna o JSON parseado.
 *
 * @throws AsaasConfigError se ASAAS_API_KEY/ASAAS_ENV inválido
 * @throws AsaasApiError se Asaas retornar status >= 400
 * @throws AsaasNetworkError em timeout/network error
 */
export async function asaasRequest<T>(
  path: string,
  options: AsaasRequestOptions = {},
  deps: AsaasRequestDeps = {},
): Promise<T> {
  const config = loadAsaasConfig(deps.env)
  const fetchImpl = deps.fetch ?? fetch
  const method = options.method ?? 'GET'
  const timeoutMs = options.timeoutMs ?? 15_000

  if (!path.startsWith('/')) {
    throw new Error(`asaasRequest: path deve começar com / (recebido: '${path}')`)
  }
  const url = `${config.baseUrl}${path}`

  // Headers fixados localmente — caller NÃO injeta headers.
  // Isso garante que credential nunca leak via header customizado.
  const headers: Record<string, string> = {
    access_token: config.apiKey,
    accept: 'application/json',
  }
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json'
  }

  // Timeout via AbortController (sem dependência externa)
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetchImpl(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutHandle)
    // ⚠️ Sanitização: nunca logamos `err.message` cru porque alguns
    // ambientes incluem URL completa (com possíveis tokens em query).
    // Logamos só (path, env) — suficiente pra diagnóstico.
    console.error('[asaas] network error', { path, env: config.env })
    throw new AsaasNetworkError(
      path,
      err instanceof Error && err.name === 'AbortError'
        ? 'Timeout ao chamar Asaas'
        : 'Falha de rede ao chamar Asaas',
    )
  }
  clearTimeout(timeoutHandle)

  // Parse defensivo: 204 No Content / corpo vazio.
  let parsed: unknown = null
  const text = await response.text()
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text)
    } catch {
      // Body não-JSON em status 4xx/5xx: diagnóstico crítico
      // (ex: WAF Cloudflare retornando HTML, rate-limit page).
      // Logamos primeiros 300 chars do body, MAS REDACTING a apiKey
      // caso um proxy intermediário tenha ecoado headers no body.
      const sanitized = config.apiKey
        ? text.split(config.apiKey).join('[REDACTED]')
        : text
      console.error('[asaas] resposta não-JSON', {
        path,
        env: config.env,
        statusCode: response.status,
        bodyLength: text.length,
        contentType: response.headers.get('content-type'),
        bodyFirst300: sanitized.substring(0, 300),
      })
    }
  }

  if (!response.ok) {
    const body = (parsed ?? null) as AsaasErrorBody | null
    const firstErr = body?.errors?.[0]
    const summary = firstErr?.description ?? `Erro Asaas ${response.status}`
    // ⚠️ console.error sem headers, sem apiKey
    console.error('[asaas] http error', {
      path,
      env: config.env,
      statusCode: response.status,
      asaasError: firstErr?.code ?? 'unknown',
      // Em 4xx onde body PARSED existe, loga descrição (sem dado sensível
      // — Asaas só retorna code+description em errors[]).
      asaasErrorDescription: firstErr?.description ?? null,
    })
    throw new AsaasApiError(response.status, path, body, summary)
  }

  return (parsed ?? null) as T
}

/** Helper público pra UI saber qual ambiente está ativo (NÃO retorna a chave). */
export function getAsaasEnv(envOverride?: AsaasEnvSource): 'sandbox' | 'production' {
  return loadAsaasConfig(envOverride).env
}
