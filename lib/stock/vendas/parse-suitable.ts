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

const brl = (s: string): number => {
  const t = (s || '').replace(/R\$/i, '').trim().replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}
const unescapeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

export function parseSuitable(html: string): SuitableParse {
  if (!/<table/i.test(html)) throw new SuitableParseError('Arquivo não parece o relatório do Suitable (sem tabela HTML).')
  // cada <tr> com >= 4 <td>. Captura o conteúdo de cada td.
  const linhas: VendaLinhaSuitable[] = []
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of trs) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => unescapeHtml(m[1]))
    if (tds.length < 4) continue
    const produto = tds[0]
    // pula o cabeçalho e linhas sem quantidade numérica
    if (!produto || /^produto$/i.test(produto)) continue
    const quantidade = Number((tds[1] || '').replace(/\D/g, ''))
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue
    linhas.push({ produto, quantidade, valorExtra: brl(tds[2]), valorTotal: brl(tds[3]) })
  }
  if (!linhas.length) throw new SuitableParseError('Nenhuma linha de venda encontrada no arquivo.')
  return { linhas, totalUnidades: linhas.reduce((s, l) => s + l.quantidade, 0), totalProdutos: linhas.length }
}
