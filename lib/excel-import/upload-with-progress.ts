// Sprint 5.0.2.3 — Helper de upload com progress bar real (XHR) + timeout
// explícito + retry com backoff em erros de rede.
//
// Por que XHR e não fetch: fetch() NÃO expõe progress events nativamente em
// 2026 — única forma de saber "quantos bytes já subiram" é XMLHttpRequest
// (vai mudar com fetch streaming + Compression APIs no futuro, ainda não
// universal em prod). Mantemos a API moderna na superfície (Promise + types).

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing' // upload completo, esperando server processar
  | 'success'
  | 'error'

export interface UploadProgress {
  /** 0-100 — só faz sentido com status='uploading' */
  percent: number
  loaded: number
  total: number
}

export interface UploadResult<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  /** Code retornado pelo backend OU mapeado do HTTP status. */
  errorCode?: string
  /** Mensagem técnica do backend (não traduzida — UI deve usar errorInfo()). */
  errorMessage?: string
  /** Métricas — útil pra log. */
  elapsedMs: number
  retried: boolean
}

export interface UploadOptions {
  url: string
  file: File
  onProgress?: (p: UploadProgress) => void
  /** Disparado quando upload terminou (100%) mas server ainda processa. */
  onProcessing?: () => void
  /** Disparado ANTES de cada retry. */
  onRetry?: (attempt: number) => void
  /** Timeout total por tentativa em ms. Default 90s. */
  timeoutMs?: number
  /** Quantas vezes retentar em erro de rede/timeout. Default 1. */
  maxRetries?: number
}

const DEFAULT_TIMEOUT_MS = 90_000
const DEFAULT_MAX_RETRIES = 1
const RETRY_BACKOFF_MS = 2_000

/**
 * Faz upload multipart com progress. Resolve sempre — nunca rejeita.
 * Caller verifica `result.ok` antes de usar `result.data`.
 *
 * Retorna `errorCode` em todos os casos de falha:
 *   - 'NETWORK_ERROR' — erro de conexão / DNS / etc
 *   - 'TIMEOUT' — request demorou mais que `timeoutMs`
 *   - code do backend (se response JSON tem `.code`)
 *   - 'INTERNAL_ERROR' — fallback
 */
export async function uploadWithProgress<T = unknown>(
  opts: UploadOptions,
): Promise<UploadResult<T>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  const t0 = Date.now()

  let attempt = 0
  let lastResult: UploadResult<T> | null = null

  while (attempt <= maxRetries) {
    if (attempt > 0) {
      opts.onRetry?.(attempt)
      await sleep(RETRY_BACKOFF_MS)
    }
    const result = await singleAttempt<T>(opts, timeoutMs, t0, attempt > 0)
    lastResult = result

    // Sucesso → retorna imediatamente
    if (result.ok) return result

    // Erros não-retriáveis → retorna imediatamente
    if (
      result.errorCode !== 'NETWORK_ERROR' &&
      result.errorCode !== 'TIMEOUT'
    ) {
      return result
    }

    attempt++
  }

  // Esgotou retries
  return lastResult!
}

function singleAttempt<T>(
  opts: UploadOptions,
  timeoutMs: number,
  t0: number,
  isRetry: boolean,
): Promise<UploadResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', opts.file)

    let processingCalled = false

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100)
        opts.onProgress({
          percent: Math.min(percent, 99), // reserva 100% pra quando server responde
          loaded: e.loaded,
          total: e.total,
        })
      }
    }

    xhr.upload.onload = () => {
      // Upload terminou, server agora processa
      if (!processingCalled && opts.onProcessing) {
        processingCalled = true
        opts.onProcessing()
      }
    }

    xhr.timeout = timeoutMs

    xhr.ontimeout = () => {
      resolve({
        ok: false,
        status: 0,
        data: null,
        errorCode: 'TIMEOUT',
        errorMessage: `Request demorou mais que ${Math.round(timeoutMs / 1000)}s`,
        elapsedMs: Date.now() - t0,
        retried: isRetry,
      })
    }

    xhr.onerror = () => {
      resolve({
        ok: false,
        status: 0,
        data: null,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'XMLHttpRequest network error',
        elapsedMs: Date.now() - t0,
        retried: isRetry,
      })
    }

    xhr.onload = () => {
      // Status 0 nunca cai aqui (onerror cobre)
      const elapsedMs = Date.now() - t0

      let parsed: unknown = null
      let parseError = false
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        parseError = true
      }

      const status = xhr.status

      if (status >= 200 && status < 300) {
        if (parseError) {
          resolve({
            ok: false,
            status,
            data: null,
            errorCode: 'INTERNAL_ERROR',
            errorMessage:
              'Servidor respondeu 2xx mas com body não-JSON (provável crash)',
            elapsedMs,
            retried: isRetry,
          })
          return
        }
        // 100% sinaliza completo
        opts.onProgress?.({ percent: 100, loaded: 1, total: 1 })
        resolve({
          ok: true,
          status,
          data: parsed as T,
          elapsedMs,
          retried: isRetry,
        })
        return
      }

      // Erro HTTP 4xx/5xx
      const obj = (parsed as Record<string, unknown>) ?? {}
      const code =
        typeof obj.code === 'string'
          ? obj.code
          : codeFromHttpStatus(status)
      const errMsg =
        typeof obj.erro === 'string'
          ? obj.erro
          : typeof obj.error === 'string'
            ? obj.error
            : `HTTP ${status}`
      resolve({
        ok: false,
        status,
        data: parsed as T,
        errorCode: code,
        errorMessage: errMsg,
        elapsedMs,
        retried: isRetry,
      })
    }

    xhr.open('POST', opts.url, true)
    xhr.withCredentials = true
    xhr.send(formData)
  })
}

function codeFromHttpStatus(status: number): string {
  if (status === 401) return 'NOT_AUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'BATCH_NOT_FOUND'
  if (status === 409) return 'BATCH_ALREADY_CONFIRMED'
  if (status === 413) return 'FILE_TOO_LARGE'
  if (status === 415) return 'FILE_TYPE_INVALID'
  if (status === 422) return 'PARSE_FAILED'
  if (status >= 500) return 'INTERNAL_ERROR'
  return 'INTERNAL_ERROR'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
