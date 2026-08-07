// Sprint Rede-Anti-Falha-Silenciosa (06/08/2026) — Etapa 1.
//
// `fetchJson` = fetch + readJsonResponse num só, pra MATAR o padrão que fazia
// funcionalidade quebrar sem ninguém ver:
//   - `if (res.ok) { ... }` SEM else → falha silenciosa, tela "parece pronta"
//   - `.catch(() => {})` → erro de rede/403 engolido
//   - `await res.json()` antes de checar ok → SyntaxError do WebKit vaza
//
// Contrato: SEMPRE retorna { ok, data, message } — nunca lança. O call-site vira:
//   const { ok, data, message } = await fetchJson<Meu>(url)
//   if (!ok) { toast(message); return }   // <- obrigatório e óbvio
//   usa data.xxx (garantido não-null quando ok=true)
//
// `aborted`: true quando um AbortController cancelou (troca de filtro rápida).
// NÃO é erro — o call-site deve IGNORAR (não dar toast). Ver conciliacao/page.

import { readJsonResponse, type SafeJsonOptions } from './safe-json'

export interface FetchJsonResult<T> {
  /** true só quando 2xx E corpo JSON parseável. */
  ok: boolean
  status: number
  /** JSON parseado (não-null garantido quando ok=true), ou null. */
  data: T | null
  /** Mensagem pt-BR pronta pra tela quando ok=false. null quando ok=true. */
  message: string | null
  /** true quando a request foi CANCELADA (AbortController) — não é erro real. */
  aborted: boolean
}

export interface FetchJsonInit extends RequestInit {
  /** Mensagem custom pra timeout (408/504) — repassada ao friendlyHttpMessage. */
  timeoutHint?: string
}

/**
 * fetch seguro que nunca lança e sempre diz o que aconteceu.
 * `credentials: 'include'` por padrão (a maioria das rotas exige cookie de auth);
 * o caller pode sobrescrever passando `credentials` no init.
 */
export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init: FetchJsonInit = {},
): Promise<FetchJsonResult<T>> {
  const { timeoutHint, ...rest } = init
  const opts: SafeJsonOptions = timeoutHint ? { timeoutHint } : {}
  try {
    const resp = await fetch(input, { credentials: 'include', ...rest })
    const r = await readJsonResponse<T>(resp, opts)
    return { ...r, aborted: false }
  } catch (err) {
    // fetch() em si só lança em: rede caiu / offline / DNS / CORS / abort.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, status: 0, data: null, message: null, aborted: true }
    }
    return {
      ok: false,
      status: 0,
      data: null,
      message: 'Falha de conexão. Verifica sua internet e tenta de novo.',
      aborted: false,
    }
  }
}
