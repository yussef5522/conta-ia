// ⭐⭐⭐ CONTAGEM COM DIREÇÃO — a especificação executável da lei v3 (23/11/2026).
//
// A LEI: `docs/contagem-referencia.html` (título "CONTAGEM COM DIREÇÃO (estoque) — referência v3
// APROVADA"), leis R36–R43 no comentário do topo e os 16 PINOS no último <script>. Este módulo é o
// PORTO desses pinos pra lib: puro, sem Prisma, importável do cliente e do servidor (PORTA ÚNICA —
// o posto de comando, o cartão de contar e o recibo leem DAQUI, nunca uma cópia).
//
// ⚠️ A lei usa "dias desde a última contagem" (`null` = nunca contado). Ausência ≠ zero: `0` é
// "contado hoje", `null` é "nunca".

export type Grupo = 'A' | 'B' | 'C'
export const GRUPOS: readonly Grupo[] = ['A', 'B', 'C'] as const

/** R36/R43 — ritmo padrão AJUSTADO AO USO REAL (emenda 23/11): A todo dia · B semanal · C mensal. Editável. */
export const RITMO_PADRAO: Readonly<Record<Grupo, number>> = { A: 1, B: 7, C: 30 }
export type Ritmo = Record<Grupo, number>

/** R36 — vence quando chega no ritmo; nunca contado entra sempre */
export function venceHoje(g: Grupo, dias: number | null, ritmo: Ritmo = RITMO_PADRAO): boolean {
  return dias == null ? true : dias >= ritmo[g]
}
/** R36 — atrasado = passou do ritmo (nunca contado NÃO é atrasado: tem fila própria) */
export function atrasado(g: Grupo, dias: number | null, ritmo: Ritmo = RITMO_PADRAO): boolean {
  return dias == null ? false : dias > ritmo[g]
}
/** R36 — atrasados primeiro; dentro de cada bloco, o que está há mais tempo sem contar */
export function ordemDoDia<T extends { g: Grupo; d: number | null }>(itens: T[], ritmo: Ritmo = RITMO_PADRAO): T[] {
  return [...itens].sort((a, b) =>
    (Number(atrasado(b.g, b.d, ritmo)) - Number(atrasado(a.g, a.d, ritmo))) || (b.d ?? 999) - (a.d ?? 999))
}

/**
 * R38 — o campo é NÚMERO PURO; o atalho de caixa é opcional e só em item com fator.
 * Aceita "13", "2,4", "1 cx", "1 cx + 2,4". Devolve o total na unidade do item, ou null.
 * ⚠️ Com fator ausente, "cx" é recusado (null): caixa sem fator cadastrado não existe.
 */
export function duplaUn(txt: string, fator: number | null): number | null {
  const m = String(txt).trim().toLowerCase()
    .match(/^(?:(\d+(?:[.,]\d+)?)\s*cx)?\s*(?:\+)?\s*(\d+(?:[.,]\d+)?)?$/)
  if (!m || (!m[1] && !m[2])) return null
  if (m[1] && !(fator && fator > 0)) return null
  const n = (s?: string) => (s ? parseFloat(s.replace(',', '.')) : 0)
  return Math.round((n(m[1]) * (fator ?? 0) + n(m[2])) * 1e6) / 1e6
}

export const fmt1 = (n: number) =>
  (Math.round(n * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
/** R38 — o TOTAL vai escrito no botão: ninguém confirma número que não viu */
export const rotConfirmar = (total: number, un: string) => `Confirmar ${fmt1(total)} ${un}`
/** R38 — a conta só aparece quando o atalho de caixa foi usado */
export function contaDaCaixa(txt: string, fator: number | null, un: string): string {
  if (!/cx/i.test(txt)) return ''
  const t = duplaUn(txt, fator)
  return t == null ? '' : `= ${fmt1(t)} ${un} · caixa ×${fmt1(fator ?? 0)} + solto`
}

/** R40 — acuracidade = % dentro da tolerância (arredondado). Sem contagem → null (ausência ≠ 0%). */
export function acur(dentro: number, total: number): number | null {
  return total > 0 ? Math.round((dentro / total) * 100) : null
}

/** R41 — "nunca bate": 5+ contagens e menos de 20% batidas */
export const nuncaBate = (bateu: number, total: number) => total >= 5 && bateu / total < 0.2

/** R41 — o caminho da linha do saldo (SVG path) */
export function sparkPath(vals: number[], w: number, h: number): string {
  if (vals.length === 0) return ''
  const max = Math.max(...vals), min = Math.min(...vals)
  const x = (i: number) => (vals.length === 1 ? 0 : (i / (vals.length - 1)) * w)
  const y = (v: number) => h - 6 - ((v - min) / (max - min || 1)) * (h - 12)
  return vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
}
export function sparkPonto(vals: number[], i: number, w: number, h: number): { x: number; y: number } {
  const max = Math.max(...vals), min = Math.min(...vals)
  return {
    x: vals.length === 1 ? 0 : (i / (vals.length - 1)) * w,
    y: h - 6 - ((vals[i] - min) / (max - min || 1)) * (h - 12),
  }
}

/** R42 — recibo: líquido (com sinal) e mexido (em módulo), em R$ */
export const liquido = (aj: number[]) => Math.round(aj.reduce((s, x) => s + x, 0) * 100) / 100
export const mexido = (aj: number[]) => Math.round(aj.reduce((s, x) => s + Math.abs(x), 0) * 100) / 100
