/**
 * ⭐⭐⭐ A LEI DO CUSTO MÉDIO — módulo **PURO**, zero imports, e é de propósito.
 *
 * ⚠️⚠️ **POR QUE ELA SAIU DE `custo-vigente.ts` (15/10/2026):** ao fazer `custoParaBaixar`
 * delegar o ramo de saldo ≤ 0 pra esta lei, nasceu um **CICLO DE IMPORT** que derrubou **177
 * testes** com `TIPOS_COM_CUSTO_CONHECIDO` chegando `undefined`:
 *
 * ```
 * residuo-de-centavos → custo-vigente → contagem-ancora → entrada-cruza-o-zero
 *        ↑──────────────────────────────────────────────────────────┘
 * ```
 *
 * (`entrada-cruza-o-zero` importa `ERRO_POR_UNIDADE`/`PISO` do `residuo-de-centavos` desde
 * 05/09.) Num ciclo, quem carrega primeiro vê o `const` do outro lado **ainda não
 * inicializado** — e o sintoma não é erro de import, é um `undefined.includes` no meio da
 * gravação de um movimento.
 *
 * ⭐ **A cura é a MESMA de 13/10, quando `prateleira.ts` nasceu pelo mesmo motivo** (*"o custo
 * precisa da régua da prateleira e o saldo precisa da porta do custo"*): a decisão
 * compartilhada sai pra um módulo que **não importa ninguém**, e aí não há ciclo possível.
 *
 * ⛔ **E CONTINUA EXISTINDO UM DONO SÓ:** `custo-vigente.ts` **RE-EXPORTA** esta função, então
 * os leitores de sempre (`saldo.ts`, o backfill, o juiz E17) não mudaram de porta — e ninguém
 * tem uma 2ª régua pra *"quanto vale a memória"*.
 *
 * ⚠️ **Este arquivo não pode ganhar import NENHUM.** Qualquer dependência aqui reabre o ciclo
 * por baixo — e o estrago não aparece como erro de módulo, aparece como `undefined` no meio de
 * uma escrita no ledger.
 */

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐⭐⭐ A LEI DO CUSTO MÉDIO — e ela é a ÚNICA porta: `saldo.ts` chama ESTA função.
 *
 * - `saldo > 0` → `valor ÷ saldo`, **igual a hoje, ao centavo** (zero regressão: ficha fechada
 *   com estoque em pé não muda um centavo);
 * - `saldo ≤ 0` → **o último custo médio conhecido** (a memória);
 * - **nunca teve entrada com valor** → `null` = *"a definir"*. ⛔ Número inventado NUNCA: num
 *   item sem compra nenhuma, um custo chutado entra na ficha, no cardápio e no CMV **saindo
 *   plausível** — que é o pior tipo de erro (a lição da FANTA UVA).
 *
 * ⚠️ Memória `≤ 0` é tratada como ausência: custo zero ou negativo não é "o que a coisa
 * custa", é resquício de um estado impossível — e propagá-lo seria propagar a ficção.
 */
export function custoMedioComMemoria(saldo: number, valor: number, vigente: number | null): number | null {
  if (saldo > 0) return round2(valor / saldo)
  return vigente != null && vigente > 0 ? round2(vigente) : null
}
