// Sprint Asaas FATIA 3A (31/05/2026) — Hierarquia de erros.
// ⚠️ NENHUMA classe carrega o api key. Mensagens são sanitizadas
// antes de virarem `message`/`stack`. Ver client.ts.

import type { AsaasErrorBody } from './types'

/** Erro de configuração — env var ausente/inválida. */
export class AsaasConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AsaasConfigError'
  }
}

/** Erro vindo do Asaas (status 4xx/5xx). */
export class AsaasApiError extends Error {
  /** Status HTTP da resposta Asaas. */
  readonly statusCode: number
  /** Body parseado do Asaas (errors[]). */
  readonly body: AsaasErrorBody | null
  /** Path REL do endpoint (sem baseUrl), pra log com contexto sem expor URL completa. */
  readonly path: string

  constructor(
    statusCode: number,
    path: string,
    body: AsaasErrorBody | null,
    summary: string,
  ) {
    super(summary)
    this.name = 'AsaasApiError'
    this.statusCode = statusCode
    this.body = body
    this.path = path
  }

  /** Helper pra UI: primeira descrição estruturada do Asaas, ou fallback. */
  firstErrorDescription(): string {
    return (
      this.body?.errors?.[0]?.description ??
      `Erro ${this.statusCode} no Asaas`
    )
  }
}

/** Erro de rede/timeout. NÃO carrega o body de request. */
export class AsaasNetworkError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(message)
    this.name = 'AsaasNetworkError'
    this.path = path
  }
}
