/**
 * ⭐⭐ O FORMATADOR ÚNICO DE DURAÇÃO (04/10/2026) — irmão do `money.ts`.
 *
 * **Nasceu de um defeito que o dono viu na tela:** *"TEMPO/LOTE cru: `3h21.830000000000013` e
 * `1h2.670000...` — float vazando pra tela"*.
 *
 * ⛔⛔ **A CAUSA É ARITMÉTICA DE FLOAT, e ela é invisível no código:** a média de minutos é um
 * decimal honesto (201,83 min), e `201.83 % 60` em JavaScript dá **21.830000000000013** — o
 * resto herda o lixo binário do `%`. Era `${Math.floor(m/60)}h${m % 60}` em **CINCO cópias**
 * espalhadas; duas arredondavam o resto, três não. *A mesma decisão escrita cinco vezes é a
 * doença que este módulo mais paga* (os 7 detectores de par, em forma de hora).
 *
 * ⭐⭐ **E A CURA NÃO É ARREDONDAR O RESTO — É ARREDONDAR O TOTAL ANTES DE PARTIR.** As cinco
 * cópias, inclusive as duas que "já arredondavam", tinham o MESMO bug latente:
 * `119.7` → `floor(119.7/60)=1` e `round(119.7%60)=round(59.7)=60` → **"1h60"**, uma hora que
 * não existe. E `59.7` cairia no ramo `< 60` e sairia **"60min"** em vez de "1h00". Arredondando
 * o total primeiro, os dois saem certos e o estado impossível deixa de ser alcançável (REGRA 5).
 */

/**
 * `"3h22"` · `"1h03"` · `"45min"` — como a cozinha fala.
 *
 * ⚠️ **Não trata `null`**: cada tela tem a SUA frase pra ausência (*"a apurar"* no relatório,
 * *"—"* nas etapas), e isso é semântica, não formatação. Colapsar as duas aqui faria uma das
 * telas mentir sobre o que ela não sabe.
 */
export function formatarDuracao(minutos: number): string {
  // ⛔ o arredondamento vem PRIMEIRO — ver o bloco acima: é o que impede "1h60" e "60min"
  const m = Math.round(minutos)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}
