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
export function parseSuitable(html: string, colunas: MapaColunas = COLUNAS_PRODUTOS): SuitableParse {
  if (!/<table/i.test(html)) throw new SuitableParseError('Arquivo não parece o relatório do Suitable (sem tabela HTML).')
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
