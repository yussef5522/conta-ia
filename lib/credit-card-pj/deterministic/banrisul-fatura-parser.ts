// Sprint Cartão FASE 4 (18/08/2026) — parser DETERMINÍSTICO da fatura Banrisul PJ por
// texto (pdftotext -layout). Custo zero, sem Vision, sem timeout/truncamento.
//
// ⚠️ 26/08: a LEITURA DA LINHA saiu daqui pro núcleo compartilhado
// (`lib/fatura-banrisul/nucleo.ts`), porque a fatura PF tem o MESMO dialeto de linha e
// LAYOUT DE COLUNA diferente. O que sobrou neste arquivo é a única coisa que é
// específica da PJ: **onde cortar a coluna**.
//
// A fatura Banrisul PJ tem as transações na COLUNA ESQUERDA da página 2; a coluna
// direita (BanriClube/Pontos/Limites/Taxas) invade as MESMAS linhas no -layout.
// Uma regex "valor no fim da linha" pega os números da direita (Pontos 2.066,96,
// Limite 80.000,00). Defesa: CORTAR a linha na coluna do header "R$" (a coluna R$
// das transações termina ~col 62; a direita começa ~col 65) e só então extrair.
//
// ⚠️ Na PF esse mesmo corte DESTRÓI o resultado: lá as duas colunas têm transação
// (dois portadores). Ver `lib/fatura-banrisul/banrisul-fatura-pf.ts`.
//
// A VALIDAÇÃO É JUIZ (impossibilidade): se a Σ não fecha com os totais declarados,
// o import FALHA (validate-banrisul-fatura). Nunca grava fatura que não bate.

import { parseBanrisulFaturaPF } from '@/lib/fatura-banrisul/banrisul-fatura-pf'
import type { BanrisulFaturaParsed } from '@/lib/fatura-banrisul/nucleo'

export { parseBRNumber } from '@/lib/fatura-banrisul/nucleo'
export type { BanrisulFaturaParsed }

/**
 * ⭐⭐⭐ O CORTE FIXO MORREU — A GEOMETRIA É UMA SÓ PROS DOIS DOCUMENTOS (17/09/2026).
 *
 * Este arquivo existia por UMA razão, escrita no topo: *"a única coisa específica da PJ é
 * onde cortar a coluna"*. A fatura PJ tinha as transações à esquerda e BanriClube/pontos/
 * limites à direita, então a defesa era **cortar a direita fora** (`cutCol`, ~68).
 *
 * ⛔⛔ **E ISSO DEIXOU DE SER VERDADE NO DIA EM QUE A EMPRESA GANHOU UM CARTÃO ADICIONAL.**
 * Medido no texto REAL da fatura que o dono subiu (quarentena
 * `cmu4xpfv00064z0ci36uz0q8n`): o histórico do portador `0123` mora **na coluna direita**,
 * e o corte o jogava fora **por desenho**:
 *
 * ```
 *  ⛔ 07/09  +18,00  BRASIL  [0123] ANUIDADEINT DIFER 05/12 0123   ← a dif de −18,00
 *  ⛔ 07/09  −18,00  ESTORNO [0123] DESC. ANUID. 0123 05/12
 * ```
 *
 * ⚠️ **E "ler a direita inteira" NÃO é a cura** — medido no mesmo texto, isso inventa um
 * `IOF de 1.585,81` colhido da tabela de taxas do painel. *O corte existia por um motivo
 * real; o que faltava era distinguir PAINEL de COLUNA, não remover a defesa.*
 *
 * ⭐ A resposta é a geometria por BANDAS, a mesma do PF — e ela foi **medida nos dois
 * documentos antes de trocar**:
 *
 * | | fatura real (alvo 11.376,89) | golden PJ de agosto (alvo 13.797,73) |
 * |---|---|---|
 * | corte fixo | ⛔ 11.358,89 | ✅ bate |
 * | bandas     | ✅ **11.376,89** | ✅ bate, número a número |
 *
 * ⭐⭐ Ou seja: **as bandas não são uma troca de risco, são um superconjunto.** O que era
 * "específico da PJ" virou nada — e some a segunda cópia da decisão *"onde a coluna
 * termina"*, que é a doença que este projeto mais paga (5 detectores de par, 3 cópias da
 * competência). Um motor, dois documentos.
 */
export function parseBanrisulFatura(text: string): BanrisulFaturaParsed {
  // ⚠️ `proximas` é leitura de RESUMO que só a tela do PF consome; o contrato PJ não a tem.
  const { proximas: _proximas, ...resultado } = parseBanrisulFaturaPF(text)
  void _proximas
  return resultado
}

