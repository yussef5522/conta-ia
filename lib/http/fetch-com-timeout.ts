// ⭐⭐⭐ SPINNER ETERNO É A AUSÊNCIA FINGINDO PROGRESSO (14/09/2026).
//
// **O dono, com a tela de vendas pendurada:** *"carregando pra sempre e erro são estados
// diferentes; o spinner eterno é a ausência fingindo progresso."*
//
// ⛔ **DECLARAÇÃO HONESTA: isto NÃO teria pego o defeito de hoje.** O que pendurou a tela
// foi um LAÇO de render (20 `POST /preview` por segundo) que saturou o limite de ~6
// conexões do browser — **as requisições eram 200 e rápidas**; as outras ficaram na FILA.
// O timeout não impede o laço; ele impede a **mentira**: em vez de girar pra sempre, a tela
// diz *"não consegui carregar — tentar de novo"* e o dono descobre em 12 s em vez de nunca.
//
// ⚠️ E ele NÃO substitui o `fetchJson` da casa (06/08), que é o padrão anti-falha-silenciosa
// de TODO fetch de tela. Este é a camada de cima pros fetches que alimentam um SPINNER —
// onde "ainda carregando" precisa virar "não deu" sozinho.

/** ⚠️ 12 s: acima disso o dono já concluiu que travou. Abaixo, mata 3G ruim de celular. */
export const TIMEOUT_PADRAO_MS = 12_000

export class TempoEsgotado extends Error {
  constructor(public readonly ms: number) {
    super(`Não consegui carregar (passou de ${Math.round(ms / 1000)}s). Tentar de novo?`)
    this.name = 'TempoEsgotado'
  }
}

export interface RespostaComTimeout<T> {
  ok: boolean
  data: T | null
  /** ⛔ a frase que VAI PRA TELA — nunca `null` quando `ok` é false */
  erro: string | null
  /** o tempo estourou (≠ de erro do servidor) — a tela pode oferecer "tentar de novo" */
  timeout: boolean
  /**
   * ⭐ O CORPO DA RECUSA (19/09) — aditivo, só preenchido quando `ok` é false.
   *
   * ⛔ Antes a falha carregava só a FRASE, e uma recusa que oferece caminho (*"estes 2
   * itens barraram; dá pra baixar os outros 56"*) chegava na tela como texto morto: a lista
   * dos réus se perdia. ***Recusa acionável precisa dos dados, não só da frase.***
   * ⚠️ Quem já lê `erro` não muda em nada.
   */
  corpo?: unknown
}

/**
 * `fetch` que SEMPRE termina: devolve dado, erro do servidor, ou tempo esgotado.
 *
 * ⛔ Nunca lança — a régua do `fetchJson` da casa: quem chama trata um objeto, e um `throw`
 * solto dentro de um `useEffect` vira spinner eterno com o erro só no console.
 */
export async function fetchComTimeout<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<RespostaComTimeout<T>> {
  const ms = init?.timeoutMs ?? TIMEOUT_PADRAO_MS
  const ctrl = new AbortController()
  // ⚠️ o sinal de quem chama continua valendo (desmontou o componente → aborta): os dois
  // abortam, e o primeiro que falar ganha.
  const externo = init?.signal
  const aoAbortar = () => ctrl.abort()
  externo?.addEventListener('abort', aoAbortar)
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal })
    const j = await r.json().catch(() => null)
    if (!r.ok) return { ok: false, data: null, erro: (j as { erro?: string } | null)?.erro ?? 'Não consegui carregar.', timeout: false, corpo: j }
    return { ok: true, data: j as T, erro: null, timeout: false }
  } catch (e) {
    // ⚠️ abortado pelo NOSSO relógio = timeout; abortado por fora = a tela sumiu, e aí
    // mostrar erro seria ruído num componente que nem existe mais.
    const abortou = (e as Error)?.name === 'AbortError'
    if (abortou && externo?.aborted) return { ok: false, data: null, erro: null, timeout: false }
    if (abortou) return { ok: false, data: null, erro: new TempoEsgotado(ms).message, timeout: true }
    return { ok: false, data: null, erro: 'Falha de conexão. Tentar de novo?', timeout: false }
  } finally {
    clearTimeout(t)
    externo?.removeEventListener('abort', aoAbortar)
  }
}
