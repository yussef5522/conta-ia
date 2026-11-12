/**
 * ⭐ LUCRO POR SETOR — AS CONTAS PURAS DA LEI v11 (docs/lucro-por-setor-referencia.html, <script>).
 *
 * Este arquivo roda NO SERVIDOR e NO NAVEGADOR (o "E SE…" recalcula a cada tecla, S21): por isso
 * não importa nada de banco. Cada função aqui é a tradução 1:1 de uma conta do <script> da lei —
 * os números do arquivo são AMOSTRA (S12); os testes provam a CONTA, contra a porta única.
 *
 * ⛔ Nenhuma régua inventada: o que não tem base volta `null` ("em formação"), nunca 0.
 */

/** normaliza pra casar nome do PDV × nome da ficha (acento, caixa, espaço) — a mesma régua de `normalizarNome` */
export const chaveDeNome = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/**
 * S23 · O GÊMEO A PREÇO CHEIO de um item-promo: a régua dele é a do gêmeo nos dias SEM promo.
 * ⭐ Extensível: uma linha por par. A chave é o nome normalizado (o do item OU um apelido do PDV).
 * "GRANDE PRECINHO" e "PIZZA GRANDE PRECINHO" são o MESMO produto em duas grafias do PDV.
 */
export const GEMEO: Readonly<Record<string, string>> = {
  'GRANDE PRECINHO': 'PIZZA GRANDE 35CM',
  'PIZZA GRANDE PRECINHO': 'PIZZA GRANDE 35CM',
}

/** o nome do gêmeo a preço cheio (ou `null` se o item não tem gêmeo no mapa) */
export function gemeoDe(nomes: readonly string[], mapa: Readonly<Record<string, string>> = GEMEO): string | null {
  for (const n of nomes) {
    const g = mapa[chaveDeNome(n)]
    if (g) return g
  }
  return null
}

/** S14 · a linha que se DIZ promoção pelo nome (PRECINHO / PROMO) — palavra inteira, nunca pedaço */
export const ehNomeDePromo = (nome: string) => /(^|[^A-Z])(PRECINHO|PROMO)([^A-Z]|$)/.test(chaveDeNome(nome))

/** S6 · a mediana da lei: x[floor((n−1)/2)] (a de baixo, nos pares) */
export function medianaDaLei(xs: readonly number[]): number {
  const x = [...xs].sort((a, b) => a - b)
  return x.length ? x[Math.floor((x.length - 1) / 2)] : 0
}

export type Quadrante = '⭐' | '🐴' | '💎' | '🐶'

/**
 * S6 · O QUADRANTE, com corte nas medianas REAIS do setor (un e margem).
 * ⛔ Item sem custo de base (margem `null`) fica FORA do corte e sem selo: margem de quem não
 * tem custo seria 100% — o selo ⭐/💎 mentiria.
 */
export function quadrantes<T extends { chave: string; q: number; margem: number | null }>(itens: readonly T[]): Map<string, Quadrante> {
  const com = itens.filter((i) => i.margem != null)
  const out = new Map<string, Quadrante>()
  if (!com.length) return out
  const unMed = medianaDaLei(com.map((i) => i.q))
  const mgMed = medianaDaLei(com.map((i) => i.margem as number))
  for (const l of com) {
    const m = l.margem as number
    out.set(l.chave, l.q >= unMed ? (m >= mgMed ? '⭐' : '🐴') : m >= mgMed ? '💎' : '🐶')
  }
  return out
}

/** o que o "E SE…" precisa do item estudado (S21) */
export interface BaseDoEse {
  /** lucro do item no dia (vendeu − custo inteiro) */
  lucro: number
  /** custo REAL por unidade do dia = custo inteiro ÷ un (base + sabores que foram nele) */
  custoUn: number
  /** a régua de unidades a preço cheio (do próprio item ou do gêmeo); `null` = em formação */
  cheioUn: number | null
}

export interface ContaDoEse {
  lucroUn: number
  /** quantas unidades àquele preço empatariam o lucro do dia; `null` = o preço não paga o custo */
  empate: number | null
  /** régua × lucro/un àquele preço; `null` sem régua */
  lucroCheio: number | null
  /** lucro do dia − lucroCheio (≥ 0 = como foi ganhou) */
  delta: number | null
}

/** S21 · a conta do "E SE…" — 1:1 com `eseConta` da lei. */
export function eseConta(e: BaseDoEse, preco: number): ContaDoEse {
  const lucroUn = preco - e.custoUn
  if (lucroUn <= 0) return { lucroUn, empate: null, lucroCheio: null, delta: null }
  const empate = Math.ceil(e.lucro / lucroUn - 1e-9)
  const lucroCheio = e.cheioUn != null ? e.cheioUn * lucroUn : null
  return { lucroUn, empate, lucroCheio, delta: lucroCheio != null ? e.lucro - lucroCheio : null }
}

/** S21/S23 · as frases do veredito do E SE (as da lei, sem tirar nem pôr) */
export function vereditoDoEse(promo: boolean, r: ContaDoEse): { ok: boolean; titulo: string; valor: number } | null {
  if (r.delta == null) return null
  const ok = r.delta >= 0
  return {
    ok,
    titulo: ok ? (promo ? '✓ A PROMO GANHOU' : '✓ COMO FOI HOJE GANHA') : promo ? '✗ A PREÇO CHEIO LUCRARIA MAIS' : '✗ A ESSE PREÇO LUCRARIA MAIS',
    valor: Math.abs(r.delta),
  }
}

/** lê o que o dono digita no campo de preço ("59,90", "59.9") — inválido/≤0 = `null` (a conta não muda) */
export function lerPreco(v: string): number | null {
  const t = String(v).trim()
  const p = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(p) && p > 0 ? p : null
}
