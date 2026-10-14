/**
 * ⭐⭐ O MEDIDOR DE CONTRASTE — WCAG 2.1, UM DONO (14/10/2026).
 *
 * **Por que ele saiu de dentro do teste:** a luminância relativa e a razão de contraste viviam
 * **dentro de `__tests__/regras-ui/dois-temas-na-raiz.test.ts`**, e a partir da fundação visual
 * elas passam a ter **três leitores** — aquele guard, a varredura WCAG da referência nova, e a
 * sonda da prova em prod.
 *
 * ⛔⛔ É exatamente o caso de `lib/referencias/visual.ts`: lá o guard e a sonda liam o mesmo
 * arquivo com **duas cópias do mesmo regex**, eu consertei uma e a prova em prod acusou uma
 * tela correta. ***Duas réguas pro mesmo número e uma delas mente — e é sempre a que ninguém
 * reconsertou.*** Aqui é pior que regex: seria a **mesma pergunta de acessibilidade** com duas
 * aritméticas, e um texto ilegível passaria num leitor e reprovaria no outro.
 *
 * ⚠️ PURO e sem `fs` — pode ser importado por teste, por script de prova e, se um dia precisar,
 * por código de servidor. Nada aqui lê arquivo nem conhece o CSS da casa.
 */

/** os pisos do WCAG 2.1 AA — texto normal e texto grande (≥18,66px bold ou ≥24px) */
export const PISO_TEXTO_NORMAL = 4.5
export const PISO_TEXTO_GRANDE = 3

/**
 * ⭐ Luminância relativa (WCAG 2.1 §relative luminance).
 *
 * Aceita `#RGB` e `#RRGGBB`, com ou sem `#`, em qualquer caixa. ⛔ **NÃO** aceita `rgb()` nem
 * `oklch()` de propósito: o que esta casa grava nos tokens é hex, e aceitar um formato que não
 * dá pra converter sem parser abriria a porta pra um `NaN` virar "contraste altíssimo" em
 * silêncio — que é a pior falha possível num medidor de acessibilidade.
 */
export function luminancia(hex: string): number {
  const h = hex.trim().replace(/^#/, '')
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) {
    throw new Error(`contraste: "${hex}" não é um hex de 3 ou 6 dígitos`)
  }
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * ⭐ A razão de contraste entre duas cores — **simétrica de propósito**: ela ordena as
 * luminâncias antes de dividir, então `razao(a,b) === razao(b,a)`. Quem chama não precisa
 * saber qual é a tinta e qual é o chão, e nenhum call-site pode errar a ordem.
 */
export function razao(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** ⚠️ pt-BR: `7,87:1`. O relatório e a mensagem de falha falam a língua do dono. */
export function razaoBR(a: string, b: string): string {
  return `${razao(a, b).toFixed(2).replace('.', ',')}:1`
}

/**
 * ⭐⭐ "TOM MÉDIO NUNCA CARREGA TEXTO BRANCO" — a **L7** da referência, virada função.
 *
 * ⛔ Esta é a cicatriz de 10/10 em forma executável: a letra do pedido daquele dia era usar o
 * `-mid` de cada família como chão de texto branco, e a medição reprovou em **6 dos 8 casos**
 * (verde 3,51:1 e coral 3,91:1 **já no tema claro**, que é o que o dono usa). Quem decide se um
 * chão pode carregar branco é o NÚMERO, nunca o nome do tom.
 */
export function carregaTextoBranco(chao: string): boolean {
  return razao('#ffffff', chao) >= PISO_TEXTO_NORMAL
}
