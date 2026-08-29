// ⭐⭐ TODA LINHA DO EXTRATO TERMINA EM UM DESTINO NOMEADO (29/08/2026).
//
// ⚠️ O QUE ISTO IMPEDE, com nome e data: em 28/08 o import descartou em SILÊNCIO a linha
// "26/08 EMPRESTIMO −2.444,62" (heurística de FITID). O arquivo tinha 129 linhas; a revisão
// mostrou 12 novas; ninguém — nem o dono, nem o log — sabia que existia uma 13ª que tinha
// sido jogada fora. O gate travou por causa do SALDO, e a linha sumida era invisível: o
// dono ficou com um enigma de R$ 2.444,62 em vez de uma linha marcada "descartada porque X".
//
// ⭐ A REGRA: `blocos do arquivo == novas + já existem + futuras + ignoradas + ilegíveis`.
// Linha que não cai em nenhum balde é **sumida**, e sumida é IMPOSSÍVEL por construção:
// a conta não fecha → o import NÃO ABRE.
//
// ⚠️ POR QUE ISSO É MAIS FORTE QUE O GATE DE SALDO: o gate de saldo só acusa quando a linha
// perdida MOVE dinheiro de um jeito que não fecha com o LEDGERBAL. Linha perdida cujo valor
// coincidentemente empata (ou período sem LEDGERBAL confiável — Banrisul com bloqueado) some
// sem alarme nenhum. Contar LINHAS não depende de saldo.
//
// Função PURA: a decisão testável sem banco nem arquivo.

export type DestinoLinha = 'nova' | 'ja_existe' | 'futura' | 'ignorada' | 'ilegivel'

export interface ContagemDestinos {
  /** ⚠️ quantos blocos <STMTTRN> o ARQUIVO tem — NÃO o que o parser conseguiu ler.
   *  Usar o número parseado deixaria a conta cega justamente pra linha que morre no parser
   *  (é o `totalBlocos` do OFXParseResult). */
  totalNoArquivo: number
  novas: number
  jaExistem: number
  futuras: number
  /** descartadas por decisão EXPLÍCITA do usuário (marcação no preview) */
  ignoradas: number
  /** ⚠️ derrubadas pelo PARSER (sem FITID/data/valor). Balde separado de propósito: é
   *  defeito de ARQUIVO, não decisão nossa — e antes de existir este balde a linha morria
   *  antes de ser contada, invisível pra qualquer conferência posterior. */
  ilegiveis: number
}

export interface ResultadoConciliacao {
  fecha: boolean
  somaDestinos: number
  /** > 0 = linhas do arquivo sem destino (SUMIDAS) · < 0 = destino a mais que linhas */
  semDestino: number
  /** frase pronta pra tela: "129 linhas = 13 novas + 115 já no sistema + 1 futura" */
  resumo: string
  /** mensagem de bloqueio quando não fecha (null quando fecha) */
  erro: string | null
}

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`

export function conciliarDestinos(c: ContagemDestinos): ResultadoConciliacao {
  const somaDestinos = c.novas + c.jaExistem + c.futuras + c.ignoradas + c.ilegiveis
  const semDestino = c.totalNoArquivo - somaDestinos

  const partes = [
    plural(c.novas, 'nova', 'novas'),
    `${c.jaExistem} já no sistema`,
    plural(c.futuras, 'futura', 'futuras'),
  ]
  if (c.ignoradas > 0) partes.push(plural(c.ignoradas, 'ignorada por você', 'ignoradas por você'))
  if (c.ilegiveis > 0) partes.push(plural(c.ilegiveis, 'ilegível no arquivo', 'ilegíveis no arquivo'))
  const resumo = `${plural(c.totalNoArquivo, 'linha no arquivo', 'linhas no arquivo')} = ${partes.join(' + ')}`

  if (semDestino === 0) return { fecha: true, somaDestinos, semDestino, resumo, erro: null }

  // ⚠️ A mensagem diz o que ACONTECEU e o que FAZER — enigma numérico foi exatamente o que
  // custou caro em 28/08.
  const erro = semDestino > 0
    ? `${plural(semDestino, 'linha do extrato ficou', 'linhas do extrato ficaram')} sem destino: ` +
      `o arquivo tem ${c.totalNoArquivo} e só ${somaDestinos} foram classificadas. ` +
      `O import não vai abrir enquanto isso não fechar — linha de extrato não pode sumir em silêncio. ` +
      `Reporte o arquivo pro suporte: é defeito de leitura, não do seu extrato.`
    : `classificamos ${somaDestinos} linhas, mas o arquivo só tem ${c.totalNoArquivo} — ` +
      `alguma linha foi contada em mais de um destino (duplicação na leitura). O import não vai abrir.`

  return { fecha: false, somaDestinos, semDestino, resumo, erro }
}

/**
 * ⭐ A CONTAGEM A PARTIR DOS DESTINOS DE CADA LINHA — usa isto quando você TEM a lista, que
 * é o caso do preview. Assim o número não vem de contadores mantidos à mão (que foi como a
 * 13ª linha se perdeu: os contadores existiam, a linha não estava em nenhum).
 */
export function contarDestinos(destinos: DestinoLinha[], totalNoArquivo: number): ContagemDestinos {
  return {
    totalNoArquivo,
    novas: destinos.filter((d) => d === 'nova').length,
    ilegiveis: destinos.filter((d) => d === 'ilegivel').length,
    jaExistem: destinos.filter((d) => d === 'ja_existe').length,
    futuras: destinos.filter((d) => d === 'futura').length,
    ignoradas: destinos.filter((d) => d === 'ignorada').length,
  }
}
