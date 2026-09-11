// ESTOQUE FASE 3 — parser do relatório de vendas do Suitable. É um .xls que na verdade é
// HTML (uma <table>): Produto | Quantidade | Valor Extra | Valor total. SEM data no arquivo
// (o período fica na tela do Suitable) → o import PERGUNTA a data. Puro (string in → linhas).

export interface VendaLinhaSuitable {
  produto: string // NOME (sem código no Suitable)
  quantidade: number
  valorExtra: number
  valorTotal: number
}
export interface SuitableParse {
  linhas: VendaLinhaSuitable[]
  totalUnidades: number
  totalProdutos: number
}

export class SuitableParseError extends Error {}

/**
 * ⭐⭐ O MAPA DE COLUNAS POR RELATÓRIO (02/09/2026).
 *
 * O PDV exporta DOIS relatórios com a mesma cara (HTML disfarçado de .xls) e colunas em
 * ORDEM DIFERENTE:
 *   PRODUTOS:     `Produto   | Quantidade            | Valor Extra | Valor total`
 *   COMPLEMENTOS: `Descrição | Valor médio por unid. | Quantidade  | Valor Total`
 *
 * ⛔ A QUANTIDADE MUDA DE LUGAR — e lida na coluna errada ela some: em complementos a 2ª
 * coluna é "R$ 0,00" (a maioria dos sabores é inclusa), que vira 0 e **descarta a linha**.
 * Medido: das 215 linhas sobravam **142**, com quantidade lixo tirada do dinheiro (7.648
 * ocorrências viravam 142.255).
 *
 * ⚠️ POR QUE MAPA E NÃO UM 2º PARSER: a leitura da linha é idêntica (mesma `<table>`, mesmo
 * `brl`, mesmo unescape). Um segundo parser divergiria na primeira mania nova do PDV — a
 * lição do `nucleo.ts` das faturas do Banrisul (PF e PJ compartilham a leitura da LINHA).
 */
export interface MapaColunas {
  /** índice da coluna do NOME */
  nome: number
  /** índice da coluna da QUANTIDADE — a que muda de lugar */
  quantidade: number
  /** valor unitário/extra (informativo) */
  unitario: number
  /** valor total */
  total: number
  /** cabeçalho a ignorar (a 1ª coluna do <tr> de título) */
  cabecalho: RegExp
}

export const COLUNAS_PRODUTOS: MapaColunas = {
  nome: 0, quantidade: 1, unitario: 2, total: 3, cabecalho: /^produto$/i,
}
export const COLUNAS_COMPLEMENTOS: MapaColunas = {
  nome: 0, unitario: 1, quantidade: 2, total: 3, cabecalho: /^descri[çc][ãa]o$/i,
}

const brl = (s: string): number => {
  const t = (s || '').replace(/R\$/i, '').trim().replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}
const unescapeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

/**
 * Lê o relatório do PDV. `colunas` default = PRODUTOS, pra os call-sites existentes
 * seguirem idênticos (o golden trava isso).
 */
/**
 * ⭐⭐⭐ A COLUNA SE RESOLVE PELO NOME DO CABEÇALHO, NUNCA PELA POSIÇÃO (11/09/2026).
 *
 * ⛔⛔ **O ESTRAGO QUE ISTO EXISTE PRA IMPEDIR** (10/09, prod): o **Relatório de
 * COMPLEMENTOS** foi subido na aba de **PRODUTOS**. Os dois layouts diferem:
 *
 *   PRODUTOS:     `[Produto   · **Quantidade**             · Valor Extra · Valor total]`
 *   COMPLEMENTOS: `[Descrição · **Valor médio por unidade** · Quantidade  · Valor Total]`
 *
 * Lendo por POSIÇÃO, a coluna 1 do arquivo errado é o **PREÇO**: `R$ 14,99` virou
 * **1499**. O import baixou **1.499 unidades** de FANTA UVA (o real era **1**), a
 * Coca-Cola 2L foi a **−1.499**, o custo médio virou **negativo** e a Posição ficou com
 * **valor negativo e saldo positivo** — um estado impossível. Σ do arquivo: **53.761
 * "ocorrências"** contra 745/576/536 dos dias normais.
 *
 * ⭐ E RECUSAR É PARTE DO FIX: cabeçalho sem as colunas esperadas **não entra calado**.
 * A mensagem diz **o que achou**, pra o dono saber que subiu o arquivo trocado — em vez
 * de descobrir pelo estoque explodido no dia seguinte.
 */
export function resolverColunas(html: string, esperado: MapaColunas): MapaColunas {
  const tr = /<tr[\s\S]*?<\/tr>/i.exec(html)?.[0] ?? ''
  const cels = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((m) => unescapeHtml(m[1]).trim().toLowerCase())
  if (!cels.length) throw new SuitableParseError('Não achei o cabeçalho do relatório.')

  const acha = (re: RegExp) => cels.findIndex((c) => re.test(c))
  const nome = acha(/^(produto|descri[çc][ãa]o)$/)
  const quantidade = acha(/^quantidade$/)
  const total = acha(/^valor\s*total$/)
  const unitario = acha(/^(valor\s*extra|valor\s*m[ée]dio.*)$/)

  if (nome < 0 || quantidade < 0 || total < 0) {
    throw new SuitableParseError(
      `Este arquivo não tem as colunas que eu esperava. Achei: [${cels.join(' · ')}]. `
      + 'O Relatório de PRODUTOS tem "Produto · Quantidade · Valor Extra · Valor total"; '
      + 'o de COMPLEMENTOS tem "Descrição · Valor médio por unidade · Quantidade · Valor Total" '
      + '— e cada um entra na sua aba.',
    )
  }
  // ⛔ o cabeçalho NOMEIA o arquivo: subir complementos na aba de produtos para aqui
  if (esperado.cabecalho && !esperado.cabecalho.test(cels[nome])) {
    throw new SuitableParseError(
      `Este parece o relatório de "${cels[nome]}", e esta tela espera "${String(esperado.cabecalho).replace(/[^a-zç ]/gi, '')}". `
      + 'Use a aba certa — as colunas dos dois relatórios são diferentes, e ler uma pela outra '
      + 'faz o PREÇO entrar como quantidade.',
    )
  }
  return { nome, quantidade, unitario: unitario >= 0 ? unitario : esperado.unitario, total, cabecalho: esperado.cabecalho }
}

export function parseSuitable(html: string, colunasEsperadas: MapaColunas = COLUNAS_PRODUTOS): SuitableParse {
  if (!/<table/i.test(html)) throw new SuitableParseError('Arquivo não parece o relatório do Suitable (sem tabela HTML).')
  // ⭐ a POSIÇÃO sai do cabeçalho do arquivo, não da constante
  const colunas = resolverColunas(html, colunasEsperadas)
  // cada <tr> com >= 4 <td>. Captura o conteúdo de cada td.
  const linhas: VendaLinhaSuitable[] = []
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of trs) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => unescapeHtml(m[1]))
    if (tds.length < 4) continue
    const produto = tds[colunas.nome]
    // pula o cabeçalho e linhas sem quantidade numérica
    if (!produto || colunas.cabecalho.test(produto)) continue
    const quantidade = Number((tds[colunas.quantidade] || '').replace(/\D/g, ''))
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue
    linhas.push({ produto, quantidade, valorExtra: brl(tds[colunas.unitario]), valorTotal: brl(tds[colunas.total]) })
  }
  if (!linhas.length) throw new SuitableParseError('Nenhuma linha de venda encontrada no arquivo.')
  return { linhas, totalUnidades: linhas.reduce((s, l) => s + l.quantidade, 0), totalProdutos: linhas.length }
}
