// ⭐⭐ UTILITÁRIO BURRO — parse de número brasileiro. **Sem heurística de layout** (16/09).
//
// **A régua do dono:** *"cada banco tem SEU arquivo-parser com SUAS âncoras e SUAS regras
// de linha — zero heurística compartilhada de leitura (só utilitários burros: parse de
// número BR, datas). Mexer no `banrisul.ts` NÃO PODE tocar nenhum outro."*
//
// ⛔⛔ **O QUE ISTO CONSERTA:** o parser do **Mercado Pago** importava `parseBRL` **de
// dentro do parser do SICREDI** — com o comentário *"REGRA 4: uma leitura de valor, não
// quatro"*. A intenção era boa e o resultado era uma **corrente entre bancos**: mexer no
// arquivo do Sicredi podia quebrar o Mercado Pago, e nada avisava.
//
// ⭐ A saída não é duplicar — é **tirar o utilitário de dentro do banco**. Um número
// brasileiro se lê igual em qualquer fatura; **onde ele aparece na página, não**. A
// primeira coisa é utilitário; a segunda é do banco e não se compartilha.

/** ⚠️ 2 casas, sempre — dinheiro não carrega resto de ponto flutuante */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * ⭐ `"R$ 1.234,56"` → `1234.56` · `"-R$ 18,00"` → `-18`.
 *
 * ⚠️ Exige o `R$` de propósito: sem ele, `"01/04"` (parcela) e `"11.376,89"` solto viram
 * número onde não há dinheiro. Quem lê valor **sem** o cifrão usa `parseNumeroBR`.
 */
export function parseBRL(raw: string): number | null {
  const m = raw.match(/(-?)\s*R\$\s*([\d.]+),(\d{2})/i)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const intPart = m[2]!.replace(/\./g, '')
  const val = Number(`${intPart}.${m[3]}`)
  return isNaN(val) ? null : round2(sign * val)
}

/**
 * ⭐ `"1.234,56"` → `1234.56`, sem exigir cifrão. Aceita o sinal **depois** do número
 * (`"776,53-"`), que é como o Banrisul escreve débito no extrato.
 */
export function parseNumeroBR(raw: string): number | null {
  const t = raw.trim()
  const m = t.match(/^(-?)\s*([\d.]+),(\d{2})\s*(-?)$/)
  if (!m) return null
  const negativo = m[1] === '-' || m[4] === '-'
  const val = Number(`${m[2]!.replace(/\./g, '')}.${m[3]}`)
  return isNaN(val) ? null : round2(negativo ? -val : val)
}

/** ⭐ `"14/09/2026"` ou `"14/09"` → `{ dia, mes, ano? }`. Sem inventar ano. */
export function parseDataBR(raw: string): { dia: number; mes: number; ano?: number } | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const dia = Number(m[1]), mes = Number(m[2])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  if (!m[3]) return { dia, mes }
  const a = Number(m[3])
  return { dia, mes, ano: a < 100 ? 2000 + a : a }
}
