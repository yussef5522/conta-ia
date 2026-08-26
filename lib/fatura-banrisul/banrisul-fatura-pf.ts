// PARSER DETERMINÍSTICO DA FATURA BANRISUL **PF** (26/08).
//
// ⚠️ POR QUE NÃO DEU PRA USAR O PARSER PJ (investigação contra a fatura real):
// nada fechava — Brasil 26.807,47 vs 39.302,64 declarado, Exterior 0,00 vs 7.769,30,
// IOF 0,00 vs 271,63. A causa é estrutural, não um ajuste de regex:
//
//   · Na fatura PJ as transações ficam SÓ na coluna esquerda e a direita é
//     BanriClube/pontos/limites. A defesa do parser PJ é CORTAR a direita fora.
//   · Na fatura PF as DUAS colunas têm transação — são DOIS PORTADORES lado a lado
//     (ex.: "YUSSEF - NR. 5349" e "YUSSEF - NR. 9113"). Medido no PDF real:
//     **106 transações começam na esquerda e 46 na direita.** O corte do PJ jogava
//     as 46 no lixo.
//
// ⚠️ E CORTE FIXO TAMBÉM NÃO RESOLVE: a fronteira MUDA de página. Os cabeçalhos de
// portador aparecem em `col 12`, `col 76`, `col 12`, `col 12`+`col 79`… Testado:
// cortar em 66 sobe de 53 pra 124 linhas e AINDA não fecha (o IOF passa a sobrar
// 3.205,88, porque linhas da direita entram picadas na esquerda).
//
// ⭐ A SOLUÇÃO: descobrir as BANDAS a partir da posição dos próprios cabeçalhos
// `NR. dddd`, por página, e rodar o motor compartilhado uma vez por banda. Cada
// lançamento sai marcado com o final do cartão da banda — decisão do dono (26/08):
// *"os dois portadores na mesma fatura, cada lançamento marcado com o final do
// cartão. É UMA fatura, UM total, UM pagamento."*
//
// A leitura da linha é a MESMA do PJ (`classificarLinhas` do núcleo) — este arquivo
// só sabe fatiar colunas.

import {
  classificarLinhas,
  montarResultado,
  readDeclared,
  readVenc,
  type Bucketed,
  type BanrisulFaturaParsed,
} from './nucleo'

/** Cabeçalho de portador: "YUSSEF - NR. 9113". Guarda ONDE ele começa na linha. */
interface Cabecalho {
  linha: number
  coluna: number
  final: string
}

export function acharCabecalhos(linhas: string[]): Cabecalho[] {
  const out: Cabecalho[] = []
  for (let i = 0; i < linhas.length; i++) {
    for (const m of linhas[i].matchAll(/NR\.\s*(\d{4})/gi)) {
      out.push({ linha: i, coluna: m.index ?? 0, final: m[1] })
    }
  }
  return out
}

/**
 * As BANDAS verticais da página.
 *
 * ⚠️ A fronteira vem de ONDE AS DATAS SE AGRUPAM, **não** da coluna do cabeçalho.
 * Custou duas tentativas: o cabeçalho "YUSSEF - NR. 9113" fica na col 76, mas as
 * transações daquela coluna começam na col 66 — o título é indentado em relação ao
 * conteúdo. Cortar em 76 fatiava as linhas POR DENTRO e a banda direita lia ZERO
 * lançamento (30 transações perdidas só na página 2).
 *
 * Medido na fatura real: pág 2 agrupa em col 2 e col 66; pág 3 em col 2 e col 69;
 * pág 4 só em col 2 (coluna única). Por isso é por página e nunca um número fixo.
 */
export function deduzirBandas(linhas: string[]): { de: number; ate: number }[] {
  const posicoes: number[] = []
  for (const l of linhas) {
    for (const m of l.matchAll(/\b\d{2}\/\d{2}\s+[A-Za-zÀ-ú]/g)) posicoes.push(m.index ?? 0)
  }
  if (posicoes.length === 0) return [{ de: 0, ate: Number.MAX_SAFE_INTEGER }]

  // ⚠️ FILTRO DE DENSIDADE: uma coluna de verdade tem MUITAS datas alinhadas. Sem
  // isto, uma data solta numa nota de rodapé (col 24, col 96 — 1 ou 2 ocorrências)
  // vira "coluna" e a página é picada em 4 bandas, despencando o Brasil pra 1.685,12.
  const contagem = new Map<number, number>()
  for (const c of posicoes) contagem.set(c, (contagem.get(c) ?? 0) + 1)
  const minimo = Math.max(3, Math.floor(posicoes.length * 0.1))
  const densas = [...contagem.entries()].filter(([, n]) => n >= minimo).map(([c]) => c).sort((a, b) => a - b)
  if (densas.length === 0) return [{ de: 0, ate: Number.MAX_SAFE_INTEGER }]

  // agrupa: distância > 20 colunas abre uma coluna nova
  const inicios: number[] = [densas[0]]
  for (const c of densas) {
    if (c - inicios[inicios.length - 1] > 20) inicios.push(c)
  }
  if (inicios.length <= 1) return [{ de: 0, ate: Number.MAX_SAFE_INTEGER }]

  return inicios.map((g, i) => ({
    de: i === 0 ? 0 : g,
    ate: i === inicios.length - 1 ? Number.MAX_SAFE_INTEGER : inicios[i + 1],
  }))
}

/** O portador que manda numa banda: o cabeçalho cuja coluna cai dentro dela. */
function cartaoDaBanda(cabecalhos: Cabecalho[], banda: { de: number; ate: number }): string | null {
  const dentro = cabecalhos.filter((c) => c.coluna >= banda.de && c.coluna < banda.ate)
  return dentro.length > 0 ? dentro[0].final : null
}

/**
 * ⚠️ SÓ AS PÁGINAS DE TRANSAÇÃO. A página 1 é o RESUMO da fatura, e lá moram linhas
 * como "(+) IOF sobre transações no exterior 271,63" e a tabela de taxas — que são
 * TOTAIS DECLARADOS, não lançamentos. Rodar o motor nelas inflou o IOF de 271,63 pra
 * 3.874,27 na 1ª tentativa. O marcador é o cabeçalho "HISTÓRICO DE TRANSAÇÕES".
 */
export function paginasDeTransacao(text: string): string[][] {
  return text
    .split('\f')
    .filter((pg) => /HIST[ÓO]RICO DE TRANSA[ÇC][ÕO]ES/i.test(pg))
    .map((pg) => pg.split(/\r?\n/))
}

export function parseBanrisulFaturaPF(text: string): BanrisulFaturaParsed {
  const declared = readDeclared(text)
  const venc = readVenc(text)

  const paginas = paginasDeTransacao(text)
  const todosCabecalhos = paginas.flatMap((linhas) => acharCabecalhos(linhas))
  const cardFinals = Array.from(new Set(todosCabecalhos.map((c) => c.final)))

  // ⚠️ BANDAS POR PÁGINA, não globais: a fronteira entre as colunas MUDA (medido na
  // fatura real: portador na col 76 na pág 2 e na col 79 na pág 3). Uma banda global
  // corta as linhas da página seguinte no lugar errado — foi o que fez o Brasil ficar
  // 10.734,53 abaixo do declarado na 2ª tentativa.
  const bucketed: Bucketed[] = []
  for (const linhas of paginas) {
    const cabecalhos = acharCabecalhos(linhas)
    for (const banda of deduzirBandas(linhas)) {
      const fatia = linhas.map((l) => {
        const t = l.replace(/\s+$/, '')
        return banda.ate === Number.MAX_SAFE_INTEGER ? t.slice(banda.de) : t.slice(banda.de, banda.ate)
      })
      bucketed.push(...classificarLinhas(fatia, venc, cartaoDaBanda(cabecalhos, banda)))
    }
  }

  return montarResultado(bucketed, declared, venc, cardFinals)
}
