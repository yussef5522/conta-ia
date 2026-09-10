// ⭐⭐⭐ A GEOMETRIA DE DUAS COLUNAS DE UMA FATURA — compartilhada (09/09-10/09/2026).
//
// ⚠️⚠️ **NASCEU PRO ITAÚ E O BANRISUL PRECISOU DELA NO DIA SEGUINTE.** O Banrisul PF tinha
// a SUA dedução de colunas, por **densidade de datas** (uma coluna "de verdade" precisava
// de ≥4 datas alinhadas). Funcionou em agosto e quebrou em setembro: a coluna da direita da
// última página tinha **2 lançamentos** e um painel de limites — o filtro a descartou, a
// página virou uma coluna só, e o parser passou a ler o dinheiro do PAINEL:
//
// ```
//   02/08  POSTO PITANGUEIRA ITAQUI BRA   262,00  │  TOTAL DE GASTOS   10.482,68
//                                          ↑ o certo         ↑ o que ele leu
// ```
//
// Resultado: **32.650,23 lidos contra 18.842,30 declarados**. A recusa segurou (a fatura
// não foi importada), mas a leitura estava errada.
//
// ⭐ A CALHA NÃO DEPENDE DE QUANTOS LANÇAMENTOS A COLUNA TEM — ela é uma faixa em branco em
// TODAS as linhas da região. Uma coluna com 2 compras é tão coluna quanto uma com 40.
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
export interface Banda {
  /** coluna onde a banda começa — o chamador precisa dela pra saber de que portador é */
  de: number
  ate: number
  linhas: string[]
}

export function colunasDaRegiao(linhas: string[]): Banda[] {
  const inicios = new Set<number>([0])
  for (const [, fim] of calhas(linhas)) {
    const comData = linhas.filter((l) => DATA_NA_COLUNA.test(l.slice(fim))).length
    if (comData >= LINHAS_PRA_SER_COLUNA) inicios.add(fim)
  }
  const ordenados = [...inicios].sort((a, b) => a - b)
  const bandas: Banda[] = []
  ordenados.forEach((inicio, i) => {
    const fim = ordenados[i + 1] ?? Number.MAX_SAFE_INTEGER
    const fatia = linhas.map((l) => l.slice(inicio, fim))
    if (fatia.filter((l) => DATA_NA_COLUNA.test(l)).length < LINHAS_PRA_SER_COLUNA) return
    // ⛔⛔⛔ ONDE A BANDA TERMINA À DIREITA — e as duas tentativas erradas ficam escritas,
    // porque cada uma quebrou um banco diferente (10/09/2026):
    //
    //  1. **o PRIMEIRO valor da linha** → quebrou o Banrisul: numa compra internacional a
    //     linha traz US$ **e** R$ (`15/07 MERCADOME 8,70 45,49`), o "primeiro" é o dólar, e
    //     o REAL era cortado fora. 50 linhas sumiram, o Brasil ficou 2.548,19 curto.
    //  2. **o valor mais à direita que se repete** → quebrou o Itaú: o painel de juros da
    //     página 2 TAMBÉM é alinhado à direita (borda 118, 6 vezes), então ele ganhava do
    //     valor de verdade (borda 69, 11 vezes) e voltava pra dentro da banda.
    //
    // ⭐ O QUE SEPARA OS DOIS É A CALHA: a coluna de valor é seguida de uma faixa em
    // branco; o painel vive DEPOIS dela. Então a banda termina na **primeira calha que vem
    // depois da borda de valor mais frequente**. Sem calha depois dela, não se corta nada —
    // a banda já está limitada pela coluna seguinte.
    const comData = fatia.filter((l) => DATA_NA_COLUNA.test(l))
    const bordas = new Map<number, number>()
    for (const l of comData) {
      for (const m of l.matchAll(new RegExp(MOEDA.source, 'g'))) {
        const f = (m.index ?? 0) + m[0].length
        bordas.set(f, (bordas.get(f) ?? 0) + 1)
      }
    }
    const maisFrequente = [...bordas.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]
    const aresta = maisFrequente == null ? 0
      : (calhas(fatia).find(([ini]) => ini >= maisFrequente)?.[0] ?? 0)
    bandas.push({
      de: inicio, ate: fim,
      linhas: aresta ? fatia.map((l) => l.slice(0, aresta)) : fatia,
    })
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
    for (const banda of colunasDaRegiao(linhas.slice(inicio))) out.push(...banda.linhas)
  }
  return out
}
