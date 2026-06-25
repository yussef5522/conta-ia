// Sprint Cartao Credito PJ (24/06/2026) — checagem de soma (funcao pura).
//
// Confere soma das linhas que "entram" (COMPRA_AVISTA + COMPRA_PARCELADA +
// ENCARGO_FINANCEIRO) contra totalDeclared da fatura. Tolerancia R$ 0,02.

import type { InvoiceExtraction, InvoiceLine } from './types'

export interface InvoiceTotalsCheckResult {
  matches: boolean
  insufficient: boolean
  totalCompras: number     // COMPRA_AVISTA + COMPRA_PARCELADA
  totalEncargos: number    // ENCARGO_FINANCEIRO
  totalIgnoradas: number   // IGNORAR (informativo)
  totalCalculado: number   // soma do que entra
  totalDeclarado: number | null
  diferenca: number | null
  message: string
}

const TOLERANCE = 0.02

export function checkInvoiceTotals(extraction: InvoiceExtraction): InvoiceTotalsCheckResult {
  const totalCompras = round2(sumByKinds(extraction.lines, ['COMPRA_AVISTA', 'COMPRA_PARCELADA']))
  const totalEncargos = round2(sumByKinds(extraction.lines, ['ENCARGO_FINANCEIRO']))
  const totalIgnoradas = round2(sumByKinds(extraction.lines, ['IGNORAR']))
  const totalCalculado = round2(totalCompras + totalEncargos)

  if (extraction.totalDeclared === null) {
    return {
      matches: false,
      insufficient: true,
      totalCompras,
      totalEncargos,
      totalIgnoradas,
      totalCalculado,
      totalDeclarado: null,
      diferenca: null,
      message:
        'Total da fatura não foi identificado no PDF — não dá pra conferir a soma.',
    }
  }

  const diferenca = round2(extraction.totalDeclared - totalCalculado)
  const matches = Math.abs(diferenca) <= TOLERANCE

  const message = matches
    ? `Soma confere: compras R$ ${fmt(totalCompras)} + encargos R$ ${fmt(totalEncargos)} = R$ ${fmt(totalCalculado)} (fatura)`
    : `Soma não fecha: somei R$ ${fmt(totalCalculado)} mas a fatura diz R$ ${fmt(extraction.totalDeclared)}. Diferença: R$ ${fmt(Math.abs(diferenca))}.`

  return {
    matches,
    insufficient: false,
    totalCompras,
    totalEncargos,
    totalIgnoradas,
    totalCalculado,
    totalDeclarado: extraction.totalDeclared,
    diferenca,
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
