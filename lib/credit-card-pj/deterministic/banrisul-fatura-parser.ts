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

import {
  classificarLinhas,
  montarResultado,
  readDeclared,
  readVenc,
  type BanrisulFaturaParsed,
} from '@/lib/fatura-banrisul/nucleo'

export { parseBRNumber } from '@/lib/fatura-banrisul/nucleo'
export type { BanrisulFaturaParsed }

/** Coluna de corte esquerda: header "R$" da seção de transações + 8 (a coluna R$
 *  termina ~6-7 cols depois; a direita começa ~9 cols depois). Fallback 64. */
function resolveCutCol(lines: string[]): number {
  for (const l of lines) {
    if (/\bUS\$\s+R\$/.test(l) && /NR\.|HIST[ÓO]RICO|TITULAR/i.test(l + '')) {
      const r = l.indexOf('R$', l.indexOf('US$'))
      if (r > 0) return r + 8
    }
  }
  // header pode estar em linha separada — procura "US$" e "R$" alinhados
  for (const l of lines) {
    const us = l.indexOf('US$')
    const r = l.indexOf('R$', us + 1)
    if (us >= 0 && r > us && r - us < 20) return r + 8
  }
  return 64
}

export function parseBanrisulFatura(text: string): BanrisulFaturaParsed {
  const rawLines = text.split(/\r?\n/)
  const cutCol = resolveCutCol(rawLines)
  const declared = readDeclared(text)
  const venc = readVenc(text)

  const cardFinals = Array.from(
    new Set((text.match(/NR\.\s*(\d{4})/gi) ?? []).map((s) => s.replace(/\D/g, ''))),
  ).filter((s) => s.length === 4)

  // ÚNICA diferença pro PF: fatia só a coluna esquerda e entrega ao motor.
  const bucketed = classificarLinhas(rawLines.map((l) => l.replace(/\s+$/, '').slice(0, cutCol)), venc)
  return montarResultado(bucketed, declared, venc, cardFinals)
}
