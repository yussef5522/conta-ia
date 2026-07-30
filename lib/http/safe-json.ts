// Sprint Correção Import PDF (30/07/2026) — leitura segura de resposta HTTP.
//
// Problema que resolve: `await resp.json()` chamado ANTES de checar `resp.ok`
// estoura quando o corpo NÃO é JSON (HTML de 504 do nginx, 502/503, 413,
// timeout). No Safari isso vira `SyntaxError: The string did not match the
// expected pattern.` — string enigmática que mascara o erro real e vaza pra
// tela. Ver cadeia de 3 falhas no relatório do bug "Importar extrato (PDF)".
//
// Regras:
//  - Lê o corpo como TEXTO primeiro (nunca joga).
//  - Só tenta JSON.parse se der; se não for JSON, devolve mensagem útil por status.
//  - NUNCA devolve HTML cru nem o err.message bruto do navegador.
//  - Prefere a mensagem `erro`/`error`/`message` do backend quando o corpo é JSON.

export interface SafeJsonResult<T> {
  /** true só quando 2xx E corpo JSON parseável. */
  ok: boolean
  status: number
  /** JSON parseado (mesmo em erro, se o backend mandou JSON), ou null. */
  data: T | null
  /** Mensagem pt-BR pronta pra tela quando ok=false. null quando ok=true. */
  message: string | null
}

export interface SafeJsonOptions {
  /**
   * Mensagem custom pra timeout (408/504). Ex numa tela de PDF:
   * "A leitura do PDF demorou mais que o esperado. Tenta de novo ou usa OFX."
   */
  timeoutHint?: string
}

/** Mensagem amigável derivada do status HTTP quando não há JSON útil do backend. */
export function friendlyHttpMessage(status: number, opts: SafeJsonOptions = {}): string {
  switch (status) {
    case 408:
    case 504:
      return (
        opts.timeoutHint ??
        'O processamento demorou mais que o esperado. Tenta de novo em instantes.'
      )
    case 502:
    case 503:
      return 'Servidor indisponível no momento. Tenta de novo em instantes.'
    case 413:
      return 'Arquivo grande demais.'
    default:
      return `Erro inesperado (HTTP ${status}).`
  }
}

/**
 * Lê uma Response de forma segura, sem nunca lançar sobre corpo não-JSON.
 * Uso:
 *   const { ok, data, message } = await readJsonResponse<Meu>(resp, { timeoutHint })
 *   if (!ok) { setError(message); return }
 *   // usa data.xxx (garantido JSON parseado em 2xx)
 */
export async function readJsonResponse<T = unknown>(
  resp: Response,
  opts: SafeJsonOptions = {},
): Promise<SafeJsonResult<T>> {
  const raw = await resp.text().catch(() => '')
  let parsed: unknown = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (resp.ok) {
    if (parsed !== null) {
      return { ok: true, status: resp.status, data: parsed as T, message: null }
    }
    // 2xx mas corpo não-JSON (raro): trata como erro de servidor, sem vazar HTML.
    return {
      ok: false,
      status: resp.status,
      data: null,
      message: friendlyHttpMessage(resp.status, opts),
    }
  }

  // Não-ok: usa `erro`/`error`/`message` do backend se veio JSON, senão status.
  const backendMsg =
    parsed && typeof parsed === 'object'
      ? ((parsed as Record<string, unknown>).erro ??
        (parsed as Record<string, unknown>).error ??
        (parsed as Record<string, unknown>).message)
      : null

  return {
    ok: false,
    status: resp.status,
    data: (parsed as T) ?? null,
    message:
      typeof backendMsg === 'string' && backendMsg.trim()
        ? backendMsg
        : friendlyHttpMessage(resp.status, opts),
  }
}
