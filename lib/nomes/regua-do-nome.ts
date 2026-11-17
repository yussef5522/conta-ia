// ⭐⭐ A RÉGUA OFICIAL DO NOME (16/11/2026) — PORTA ÚNICA. Todo lugar que COMPARA nome de item
// (trava, guarda, import XLS, sync Suit, cadastro, busca) passa por aqui.
//
// A régua: caixa alta + sem acento + pontuação (hífen, parênteses, barra…) vira espaço + espaços
// colapsados. "COCA-COLA  2L" = "Coca Cola 2l" = "COCA COLA 2L"; "Pizza Grande (35cm)" = "PIZZA GRANDE 35CM".
// ⚠️ Pontuação vira ESPAÇO, nunca some: "1/2" → "1 2" (≠ "12").
// ⛔ Igual sob a régua é o ÚNICO critério mecânico. Parecido (MAIONESE CASEIRA × MAIONESE CASEIRA COM
// ALHO) nunca se funde sozinho — vira sugestão pro dono (lib/stock/itens/fila-de-gemeos.ts).
// ⛔ Régua local nova (outro `normalize('NFD')`+`toUpperCase` pra comparar nome de item) é defeito:
// guard em __tests__/regras-ui/regua-do-nome-unica.test.ts.

/** a chave do nome — o que decide "é o mesmo nome" */
export function reguaDoNome(n: string): string {
  const base = (n ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
  const k = base.replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  return k || base
}

/** dois nomes são o mesmo sob a régua? */
export const mesmoNome = (a: string, b: string) => reguaDoNome(a) === reguaDoNome(b)
