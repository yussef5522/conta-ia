/**
 * ⭐⭐ O PERCENTUAL EM pt-BR — um dono só no projeto (10/10/2026).
 *
 * ⚠️⚠️ **NASCEU DE UM DEFEITO MEDIDO EM PROD:** as frases do ⓘ de Custos fixos saíam com
 * **`47.7%`, de PONTO** — três cópias de `(pct * 100).toFixed(1)` em `margem.ts` e
 * `prateleira.ts`, nenhuma trocando o separador. Ele viveu escondido num parágrafo de cartão
 * até a dieta de texto pôr a frase no popover. *O dono escreve com vírgula.*
 *
 * ⛔ Mora em `lib/format` e não num módulo porque a pergunta *"como se escreve percentual
 * aqui?"* é do PROJETO, não de Custos fixos nem de Margem — e a 4ª cópia nasceria no primeiro
 * módulo que precisasse dela sem saber que ela já existia.
 */

/** ⭐ 1 casa decimal, vírgula: `0.477` → `47,7%` */
export function pctBR(pct: number, casas = 1): string {
  return `${(pct * 100).toFixed(casas).replace('.', ',')}%`
}

/** ⭐ sem casa decimal, pra rótulo curto: `0.477` → `48%` */
export function pctInteiroBR(pct: number): string {
  return `${Math.round(pct * 100)}%`
}
