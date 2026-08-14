// Sprint Cartao Credito PJ (24/06/2026) — checagem de soma (função pura).
// Sprint Fatura-Estorno (14/08/2026): o estorno REDUZ o total. A fatura que vale
// (o que sai do banco, o que o pagamento casa) é "Total desta Fatura" = compras +
// encargos − estornos, NÃO o "Total cartão" (que é só compras+encargos). Antes a
// tela conferia contra o Total cartão e chamava de "fatura" — inflava a despesa e o
// razão do cartão não fechava. Agora confere as DUAS: Total cartão E Total desta Fatura.

import type { InvoiceExtraction, InvoiceLine } from './types'

export interface InvoiceTotalsCheckResult {
  matches: boolean // fecha com Total desta Fatura (o que vale)
  insufficient: boolean
  totalCompras: number
  totalEncargos: number
  totalEstornos: number // ESTORNO (crédito) — subtrai
  totalIgnoradas: number
  totalCartao: number // compras + encargos  (= "Total cartão")
  totalFatura: number // totalCartao − estornos (= "Total desta Fatura")
  totalDeclaradoCartao: number | null // "Total cartão" declarado
  totalDeclaradoFatura: number | null // "Total desta Fatura" declarado (o que vale)
  diferenca: number | null // vs Total desta Fatura
  message: string
}

const TOLERANCE = 0.02

export function checkInvoiceTotals(extraction: InvoiceExtraction): InvoiceTotalsCheckResult {
  const totalCompras = round2(sumByKinds(extraction.lines, ['COMPRA_AVISTA', 'COMPRA_PARCELADA']))
  const totalEncargos = round2(sumByKinds(extraction.lines, ['ENCARGO_FINANCEIRO']))
  const totalEstornos = round2(sumByKinds(extraction.lines, ['ESTORNO']))
  const totalIgnoradas = round2(sumByKinds(extraction.lines, ['IGNORAR']))
  const totalCartao = round2(totalCompras + totalEncargos)
  const totalFatura = round2(totalCartao - totalEstornos)

  const declaradoCartao = extraction.totalDeclared // "Total cartão"
  const declaradoFatura = extraction.totalToPay // "Total desta Fatura" (o que vale)

  // Sem NENHUM total declarado → não dá pra conferir.
  if (declaradoCartao == null && declaradoFatura == null) {
    return {
      matches: false, insufficient: true,
      totalCompras, totalEncargos, totalEstornos, totalIgnoradas, totalCartao, totalFatura,
      totalDeclaradoCartao: null, totalDeclaradoFatura: null, diferenca: null,
      message: 'Total da fatura não foi identificado no PDF — não dá pra conferir a soma.',
    }
  }

  // A que VALE é a Total desta Fatura. Se ela não vier, cai pro Total cartão.
  const alvo = declaradoFatura ?? declaradoCartao!
  const calc = declaradoFatura != null ? totalFatura : totalCartao
  const diferenca = round2(alvo - calc)
  const faturaOk = Math.abs(diferenca) <= TOLERANCE
  // check secundário: Total cartão (compras+encargos) bate com o declarado?
  const cartaoOk = declaradoCartao == null || Math.abs(round2(declaradoCartao - totalCartao)) <= TOLERANCE
  const matches = faturaOk && cartaoOk

  const alvoLabel = declaradoFatura != null ? 'Total desta Fatura' : 'total da fatura'
  const message = matches
    ? declaradoFatura != null && totalEstornos > 0
      ? `Fecha: Total cartão R$ ${fmt(totalCartao)} − estornos R$ ${fmt(totalEstornos)} = Total desta Fatura R$ ${fmt(totalFatura)}.`
      : `Soma confere com o ${alvoLabel}: R$ ${fmt(calc)}.`
    : !faturaOk
      ? `Não fecha: somei R$ ${fmt(calc)} mas o ${alvoLabel} é R$ ${fmt(alvo)}. Diferença R$ ${fmt(Math.abs(diferenca))}${totalEstornos === 0 && declaradoFatura != null ? ' (há estorno na fatura? marque como Estorno — ele reduz o total).' : '.'}`
      : `Total cartão não bate: somei compras+encargos R$ ${fmt(totalCartao)} mas o declarado é R$ ${fmt(declaradoCartao!)}.`

  return {
    matches, insufficient: false,
    totalCompras, totalEncargos, totalEstornos, totalIgnoradas, totalCartao, totalFatura,
    totalDeclaradoCartao: declaradoCartao, totalDeclaradoFatura: declaradoFatura, diferenca,
    message,
  }
}

function sumByKinds(lines: InvoiceLine[], kinds: string[]): number {
  return lines.filter((l) => kinds.includes(l.suggestedKind)).reduce((s, l) => s + l.amount, 0)
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
