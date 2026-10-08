/**
 * ⭐⭐ QUANTOS SABORES CADA TAMANHO OBRIGA — e QUAL FICHA É A BASE dele (v2, 07/10/2026).
 *
 * ⛔⛔ É DECLARAÇÃO DO DONO, NUNCA MEDIÇÃO. A razão sabores/pizza medida em prod oscila de
 * **0,37 a 7,03** em 31 dias — derivar o número do dado daria um valor diferente por semana,
 * e foi exatamente por isso que o FATOR por tamanho morreu em 07/10. Os números abaixo são os
 * que ele ditou: *"pequena=1 · grande=2 · família=3 · PRECINHO segue o tamanho"*.
 *
 * ⭐ "PRECINHO SEGUE O TAMANHO" É REGRA, NÃO CÓPIA. `GRANDE PRECINHO` não ganha uma linha de
 * config repetindo o 2 do `GRANDE`: ele **deriva**, e a linha própria só existe se o dono
 * quiser um número diferente — aí ela ganha. ⛔ Duplicar os cinco no seed faria o dono mudar
 * o `GRANDE` e o precinho ficar atrás, calado, com a pizza desenhada errada.
 */

export type RegraDeSabores = { tamanho: string; sabores: number }

/** ⭐ o seed: só os tamanhos BASE — precinho deriva (ver `saboresDoTamanho`) */
export const SABORES_SEMEADOS: readonly RegraDeSabores[] = [
  { tamanho: 'PEQUENA', sabores: 1 },
  { tamanho: 'GRANDE', sabores: 2 },
  { tamanho: 'FAMILIA', sabores: 3 },
]

/** ⛔ 0 sabores não é pizza; acima de 12 é digitação torta (o CHECK do banco recusa igual) */
export const SABORES_MIN = 1
export const SABORES_MAX = 12

/**
 * ⚠️ As PALAVRAS que são variação de preço, não de tamanho. Lista **FECHADA**: inferir
 * "variação" de qualquer palavra a mais faria `PIZZA GRANDE CALABRESA` herdar o 2 do GRANDE
 * e virar um tamanho — é a mesma trava da lista de qualificadores de bebida (14/09).
 */
const VARIACOES_DE_PRECO = ['PRECINHO', 'PROMO'] as const

/** ⚠️ normaliza como o CHECK do banco exige (upper + sem espaço duplicado) */
export const normalizarTamanho = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')

/**
 * ⭐ A RESOLUÇÃO, com a derivação do precinho e o PORQUÊ dito.
 *
 * ⛔ Devolve `null` quando não dá pra saber — o montador então **não desenha fatia nenhuma** e
 * pede a declaração. Chutar 1 fatia faria a pizza de 3 sabores entrar no sistema como 1.
 */
export function saboresDoTamanho(
  tamanho: string,
  regras: readonly RegraDeSabores[],
): { sabores: number; derivadoDe: string | null } | null {
  const t = normalizarTamanho(tamanho)
  const exata = regras.find((r) => normalizarTamanho(r.tamanho) === t)
  if (exata) return { sabores: exata.sabores, derivadoDe: null }

  // ⭐ "PRECINHO segue o tamanho": tira a palavra de variação e tenta o tamanho base
  for (const v of VARIACOES_DE_PRECO) {
    if (!t.includes(v)) continue
    const base = normalizarTamanho(t.replace(v, ''))
    if (!base) continue
    const achada = regras.find((r) => normalizarTamanho(r.tamanho) === base)
    if (achada) return { sabores: achada.sabores, derivadoDe: achada.tamanho }
  }
  return null
}

export interface TamanhoDePizza {
  tamanho: string
  sabores: number
  /** ⚠️ de onde veio o número: `null` = linha própria, senão o tamanho que ele herdou */
  derivadoDe: string | null
  /** a ficha do cardápio que é a BASE (massa + queijo + caixa). `null` = a declarar */
  base: { fichaId: string; nome: string; custo: number | null } | null
}

/**
 * ⭐⭐ MONTA A LISTA DE TAMANHOS QUE O MONTADOR OFERECE.
 *
 * ⚠️ O universo são os tamanhos que têm **base declarada** OU **regra de sabores** — e o que
 * falta de cada um aparece NOMEADO na tela. ⛔ Esconder o tamanho sem base faria o chip
 * desaparecer sem o dono saber por quê (é a porta sem maçaneta, do lado da config).
 */
export function montarTamanhos(opts: {
  regras: readonly RegraDeSabores[]
  bases: readonly { tamanho: string; fichaId: string; nome: string; custo: number | null }[]
}): TamanhoDePizza[] {
  const { regras, bases } = opts
  const nomes = new Set<string>()
  for (const r of regras) nomes.add(normalizarTamanho(r.tamanho))
  for (const b of bases) nomes.add(normalizarTamanho(b.tamanho))

  const lista: TamanhoDePizza[] = []
  for (const t of nomes) {
    const s = saboresDoTamanho(t, regras)
    const b = bases.find((x) => normalizarTamanho(x.tamanho) === t)
    lista.push({
      tamanho: t,
      // ⚠️ sem regra nem derivação o tamanho entra com 0 e a tela PEDE a declaração —
      // nunca com 1 chutado, que desenharia a pizza errada
      sabores: s?.sabores ?? 0,
      derivadoDe: s?.derivadoDe ?? null,
      base: b ? { fichaId: b.fichaId, nome: b.nome, custo: b.custo } : null,
    })
  }
  // ⭐ ordem: o que está pronto primeiro, e dentro disso por nº de sabores (pequena → família)
  return lista.sort((a, b) => {
    const prontoA = a.sabores > 0 && a.base != null
    const prontoB = b.sabores > 0 && b.base != null
    if (prontoA !== prontoB) return prontoA ? -1 : 1
    if (a.sabores !== b.sabores) return a.sabores - b.sabores
    return a.tamanho.localeCompare(b.tamanho, 'pt-BR')
  })
}
