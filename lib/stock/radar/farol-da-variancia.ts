// ⭐⭐ O FAROL DA VARIÂNCIA (RT5 da referência, 22/10/2026) — REGRA PURA.
//
// RT5, ao pé da letra: *"faltou = CORAL (perda) · sobrou = ÂMBAR (erro do outro lado) ·
// bateu = VERDE · falta contar = neutro com a AÇÃO (quando conta)."*
//
// ⚠️⚠️ **DIVERGÊNCIA DECLARADA DA TELA DE HOJE, APROVADA PELO DONO:** até 22/10 o `TOM` de
// `radar-tokens.ts` pintava **FALTOU de AMARELO** e `SOBROU` de azul. A régua nova é dele e
// tem motivo: ***faltou é PERDA — dinheiro que saiu da prateleira e ninguém registrou***, e
// perda é a notícia mais cara desta tela. Âmbar ao lado de coral fazia o olho tratar as duas
// como "atenção"; agora só uma delas é alarme.
//
// ⛔⛔ E O "FALTA CONTAR" NÃO É UM 4º TOM DE ALARME — é NEUTRO **com a ação escrita**
// (`conta hoje` · `conta sex`). Pintar de coral o item que ninguém contou afirmaria uma perda
// que nada mediu — é a família do *"ausência de MEDIÇÃO não é ausência de FATO"*, e foi por
// isso que o Radar nasceu com `null` em vez de zero (20/09).
//
// ⛔ Este arquivo NÃO importa banco nem token de cor: ele devolve o **PAPEL** (`falta` ·
// `sobra` · `ok` · `neutro`), e quem pinta é a tela, pelos tokens da mesa. Cravar hex aqui
// faria a regra da cor viver em dois lugares (a lição do mock da Conciliação, 10/09).

/** o papel do farol — os MESMOS 4 nomes das classes `.var` da referência */
export type PapelDoFarol = 'falta' | 'sobra' | 'ok' | 'neutro'

export interface Farol {
  papel: PapelDoFarol
  /** o texto da pílula, já montado */
  texto: string
}

/**
 * ⭐ O FAROL. PURA.
 *
 * Espelha o `badge(it)` do `<script>` da referência, inclusive na ORDEM das perguntas:
 * **1º** falta contar (o `real == null` manda, mesmo com teórico calculado) · **2º** o sinal
 * da diferença · **3º** bateu.
 *
 * ⚠️ O arredondamento em 2 casas é o do `<script>` (`Math.round(d*100)/100`) e existe por um
 * motivo medido: o módulo trabalha em **3 casas** (grama/ml) e a contagem grava em **2** — sem
 * isso, um resíduo de milésimo viraria *"faltou 0,001 KG"* numa linha que bateu. É o mesmo
 * degrau do `naoExplicado` da conta de padeiro (02/10).
 *
 * @param real        o contado — `null` quando não houve contagem na janela
 * @param teorico     o que o sistema diz que deveria ter
 * @param formatarQtd o formatador da casa (unidade inclusa) — ⛔ nunca um `toFixed` local
 * @param contaEm     o rótulo curto da agenda (`hoje` · `sex`), do `seloDaAgenda`
 */
export function farolDaVariancia(input: {
  real: number | null
  teorico: number
  formatarQtd: (valor: number) => string
  contaEm: string
}): Farol {
  const { real, teorico, formatarQtd, contaEm } = input

  // 1 — ninguém contou: neutro COM A AÇÃO (nunca um número, nunca coral)
  if (real == null) return { papel: 'neutro', texto: `conta ${contaEm}` }

  const d = Math.round((real - teorico) * 100) / 100

  // 2 — o sinal manda, e os dois lados têm tons DIFERENTES de propósito
  if (d < 0) return { papel: 'falta', texto: `faltou ${formatarQtd(Math.abs(d))}` }
  if (d > 0) return { papel: 'sobra', texto: `sobrou ${formatarQtd(d)}` }

  // 3 — bateu
  return { papel: 'ok', texto: 'bateu' }
}

/**
 * ⛔⛔⛔ O RODAPÉ DO GRUPO (RT6) **NÃO MORA AQUI** — e isto é decisão, não omissão.
 *
 * Eu cheguei a escrever um `totalDoGrupo` neste arquivo, e ele era uma **SEGUNDA
 * DERIVAÇÃO** do que o motor já calcula: quem responde *"quanto faltou/sobrou nesta
 * seção, por unidade"* é **`totalDaSecao`** (`fechamento.ts`, desde 21/09), e quem escreve
 * a frase é **`frasesDoRodape`** (`mesa.ts`). Os dois já obedecem as duas leis que
 * importam — **UN e KG nunca somam num número só** (a lei que nasceu do *"rodrigo 1.415,84
 * un"*, porção de queijo somada com massa de pizza, 13/09) e **item "falta contar" fica
 * FORA do total e é DITO**.
 *
 * ⚠️ Duas somas da mesma seção divergiriam no primeiro caso de borda (estorno, item que
 * entra em dois grupos, arredondamento de 3 casas) — e o rodapé passaria a contradizer o
 * placar a dez centímetros dele, que é a doença que esta casa mais paga.
 *
 * ⭐ Este arquivo fica com UMA responsabilidade: o **PAPEL do farol** por linha (RT5).
 */
