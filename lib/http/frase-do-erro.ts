/**
 * ⛔⛔⛔ O CATCH QUE MENTIA — *"Falha de conexão"* sobre um defeito nosso (18/10/2026).
 *
 * **O caso:** o `JSON.stringify` do corpo estourava **dentro do try, antes do fetch**
 * (`Converting circular structure to JSON`), e o catch da tela dizia *"Falha de conexão ao
 * processar."*. O dono passou dois dias achando que era internet/servidor — com o nginx não
 * registrando UMA requisição. ***Catch que chama todo throw de "conexão" manda o dono caçar
 * no lugar errado.***
 *
 * ⛔⛔ **E NÃO DÁ PRA SEPARAR PELO TIPO DO ERRO: queda de rede TAMBÉM é `TypeError`.**
 * Medido nos três motores: Chrome `TypeError: Failed to fetch`, Firefox `TypeError:
 * NetworkError when attempting to fetch resource.`, Safari `TypeError: Load failed`. Logo
 * `e instanceof TypeError` **não distingue nada** — e foi por isso que a 1ª ideia (olhar a
 * classe do erro) foi descartada.
 *
 * ⭐ **A régua é ALLOWLIST DE MENSAGEM DE REDE, e o DEFAULT é dizer a causa.** Só a frase
 * conhecida de queda de rede recebe o texto de conexão; **qualquer outro throw mostra o que
 * realmente aconteceu**. A direção importa: o erro seguro é mostrar causa demais (o dono lê
 * uma frase técnica e me manda), não esconder causa (o dono perde dois dias).
 *
 * ⚠️ `AbortError` entra como rede de propósito — o tempo estourou ou a tela sumiu; ali a
 * frase de conexão com "tentar de novo" é a honesta, e é a mesma do `fetchComTimeout`.
 */

/**
 * ⚠️ minúsculas: a comparação é `includes` sobre a mensagem normalizada.
 *
 * ⭐⭐ **O `fetch failed` entrou porque o TESTE o achou, não porque eu lembrei.** Minha 1ª
 * lista era só de BROWSER; derrubando um `fetch` de verdade (porta fechada em localhost) o
 * Node/undici respondeu **`TypeError: fetch failed`** — frase que nenhum motor de browser usa
 * — e a frase honesta aparecia no lugar da de conexão. ***Lista de mensagem escrita de cabeça
 * nasce com furo; a que passa por queda real de rede, não.***
 */
const FRASES_DE_REDE = [
  'failed to fetch', // Chrome/Edge
  'networkerror', // Firefox
  'load failed', // Safari
  'fetch failed', // Node/undici (SSR, script, e a suíte)
  'network request failed', // React Native / webviews
  'the internet connection appears to be offline', // Safari offline
  'connection refused',
  'err_internet_disconnected',
] as const

/** ⚠️ o undici esconde a causa real num `cause` — ler só a mensagem de cima perderia o código */
const CODIGOS_DE_REDE = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'EHOSTUNREACH'])

export function ehQuedaDeRede(e: unknown): boolean {
  if (e && typeof e === 'object' && (e as Error).name === 'AbortError') return true
  const causa = (e as { cause?: { code?: unknown } } | null)?.cause
  if (causa && typeof causa === 'object' && typeof causa.code === 'string' && CODIGOS_DE_REDE.has(causa.code)) return true
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return FRASES_DE_REDE.some((f) => msg.includes(f))
}

export interface FrasesDoErro {
  /** o que a tela diz quando é MESMO a internet (pode oferecer "tentar de novo") */
  rede: string
  /** o gesto que não deu, em pt-BR e sem ponto final — ex: `'Não consegui processar'` */
  falhou: string
}

/**
 * A frase que vai pra TELA a partir do que foi lançado.
 *
 * ⛔ Nunca devolve string vazia: tela sem frase é o silêncio que este arquivo existe pra
 * matar (a família do *"spinner eterno é a ausência fingindo progresso"*).
 */
export function fraseDoErro(e: unknown, f: FrasesDoErro): string {
  if (ehQuedaDeRede(e)) return f.rede
  const causa = e instanceof Error ? `${e.name}: ${e.message}` : String(e ?? 'erro desconhecido')
  // ⚠️ a 2ª metade não é enfeite: sem ela o dono lê uma frase técnica e volta a achar que é
  // a internet dele. Dizer que NÃO é conexão é o que o catch antigo escondia.
  return `${f.falhou} — ${causa}. Isto NÃO é problema de conexão: é defeito nosso, me manda esta frase.`
}
