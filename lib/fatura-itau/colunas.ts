// ⭐⭐⭐ A GEOMETRIA DA FATURA ITAÚ/LUIZACRED (09/09/2026) — o 3º layout do caminho PF.
//
// **O dono:** *"DUAS COLUNAS na página de lançamentos — o texto sai intercalado; parsear
// por posição X (coluna esquerda × direita), não por linha corrida."*
//
// ⛔⛔ **É A DOENÇA DA FAMÍLIA, DE NOVO, E COM UMA VOLTA A MAIS.** O `-layout` do poppler
// já derrubou o parser do Banrisul PJ (transações à esquerda, pontos à direita — curados
// cortando na coluna do header `R$`) e o do Caixa (coluna à direita, corte em ~96). Aqui é
// pior: a coluna da direita **não é um painel, é a CONTINUAÇÃO dos lançamentos** — cortar
// fora perderia 16 das 37 linhas, e "ler a linha inteira" somaria duas compras diferentes.
//
// ⭐ E O CORTE NÃO É UM NÚMERO MÁGICO: ele é MEDIDO no próprio documento. A calha (gutter)
// é uma faixa de colunas em branco em TODAS as linhas da região de lançamentos; o
// documento diz onde ele mesmo se divide. Número fixo envelheceria no primeiro extrato
// com um nome de estabelecimento mais longo.
//
// ⚠️⚠️ **DOIS ERROS MEUS, MEDIDOS CONTRA O PDF REAL, e os dois viraram regra aqui:**
//
//  1. **A calha tem que ser calculada SÓ NA REGIÃO DOS LANÇAMENTOS.** Rodando na página
//     inteira, os parágrafos de aviso do topo ("Caso você pague um valor entre o mínimo e
//     o total…") atravessam as duas colunas e **apagam a calha** — a página 1 passava a
//     ter uma coluna só, e a segunda coluna virava lixo colado no fim da primeira.
//
//  2. **A data tem que estar NO COMEÇO da coluna** (`^\s{0,2}`), não "em qualquer lugar
//     depois de espaços". Com `^\s*`, qualquer corte à esquerda da coluna da direita
//     "enxerga" as datas dela e inventa uma coluna no meio do campo de valor — a página 1
//     se partia entre a descrição e o preço, e o total dava **2.686,42** contra os
//     4.370,79 do documento.

/** uma data no INÍCIO da coluna — ver o erro nº 2 acima */
export const DATA_NA_COLUNA = /^\s{0,2}(\d{2}\/\d{2})\s/
/** dinheiro brasileiro, com o sinal de estorno colado ou separado ("- 0,03") */
export const MOEDA = /(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/
/** o valor no FIM da linha — é assim que a coluna de valor é impressa (alinhada à direita) */
export const MOEDA_NO_FIM = /(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/

/** onde começa a região de lançamentos numa página (fora dela a calha não vale) */
const INICIO_DOS_LANCAMENTOS = /Lançamentos: (compras e saques|produtos)/

/** quantas linhas com data à direita de um corte fazem dele uma COLUNA de verdade */
const LINHAS_PRA_SER_COLUNA = 2
/** largura mínima da calha, em caracteres */
const CALHA_MINIMA = 3

/** as faixas de colunas em branco em TODAS as linhas — o documento dizendo onde se divide */
export function calhas(linhas: string[], minimo = CALHA_MINIMA): [number, number][] {
  const uteis = linhas.filter((l) => l.trim())
  if (!uteis.length) return []
  const largura = Math.max(...uteis.map((l) => l.length))
  const branco: boolean[] = []
  for (let x = 0; x < largura; x++) {
    branco.push(uteis.every((l) => x >= l.length || l[x] === ' '))
  }
  const out: [number, number][] = []
  let i = 0
  while (i < largura) {
    if (!branco[i]) { i++; continue }
    let j = i
    while (j < largura && branco[j]) j++
    if (j - i >= minimo) out.push([i, j])
    i = j
  }
  return out
}

/**
 * ⭐ Fatia uma região em COLUNAS e devolve as linhas na ordem de leitura
 * (coluna esquerda inteira, depois a da direita) — que é a ordem em que os blocos de
 * cartão se sucedem no documento.
 *
 * ⚠️ Cada coluna ainda é aparada à direita na **aresta do dinheiro**: na página 2 a
 * coluna de lançamentos convive com um painel de juros que começa 3 caracteres depois do
 * último centavo, e sem a apara o `171,36` do SUPER DUDA virava `0,00` (o regex pegava um
 * número do painel). A aresta sai do PRIMEIRO valor de cada linha de data — o painel só
 * tem números DEPOIS dele.
 */
export function colunasDaRegiao(linhas: string[]): string[][] {
  const inicios = new Set<number>([0])
  for (const [, fim] of calhas(linhas)) {
    const comData = linhas.filter((l) => DATA_NA_COLUNA.test(l.slice(fim))).length
    if (comData >= LINHAS_PRA_SER_COLUNA) inicios.add(fim)
  }
  const ordenados = [...inicios].sort((a, b) => a - b)
  const bandas: string[][] = []
  ordenados.forEach((inicio, i) => {
    const fim = ordenados[i + 1] ?? Number.MAX_SAFE_INTEGER
    const fatia = linhas.map((l) => l.slice(inicio, fim))
    if (fatia.filter((l) => DATA_NA_COLUNA.test(l)).length < LINHAS_PRA_SER_COLUNA) return
    let aresta = 0
    for (const l of fatia) {
      if (!DATA_NA_COLUNA.test(l)) continue
      const m = MOEDA.exec(l)
      if (m) aresta = Math.max(aresta, m.index + m[0].length)
    }
    bandas.push(aresta ? fatia.map((l) => l.slice(0, aresta + 2)) : fatia)
  })
  return bandas
}

/**
 * ⭐ O DOCUMENTO INTEIRO virado numa lista de linhas na ORDEM DE LEITURA.
 *
 * ⚠️ As páginas vêm separadas por form feed (`\f`) no `pdftotext`; cada uma tem a sua
 * própria geometria — a página 1 tem duas colunas de lançamento, a 2 tem uma coluna e um
 * painel lateral. Calcular a calha uma vez pro documento todo misturaria as duas.
 */
export function linhasEmOrdemDeLeitura(texto: string): string[] {
  const out: string[] = []
  for (const pagina of texto.split('\f')) {
    const linhas = pagina.split('\n')
    const inicio = linhas.findIndex((l) => INICIO_DOS_LANCAMENTOS.test(l))
    if (inicio < 0) continue
    for (const banda of colunasDaRegiao(linhas.slice(inicio))) out.push(...banda)
  }
  return out
}
