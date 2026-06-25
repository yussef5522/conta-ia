// Sprint PDF Extrato Bancário (24/06/2026) — checagem de totais (função pura).
//
// O diferencial vs OFX: o PDF é menos confiável. Pra ganhar confiança, a UI
// confere que saldo_inicial + entradas - saidas == saldo_final declarado pelo
// banco. Se bater (±R$ 0,02 de tolerância) → banner verde. Se não bater →
// banner âmbar com a diferença, pra user investigar antes de importar.
//
// Nunca BLOQUEIA — é só aviso. User pode importar mesmo assim.

import type { PdfBankStatementExtraction, PdfBankStatementLine } from './types'

export interface TotalsCheckResult {
  /** true se conferiu dentro da tolerância (R$ 0,02) */
  matches: boolean
  /** true quando faltam dados pra conferir (sem saldo inicial ou final no PDF) */
  insufficient: boolean
  /** Soma de entradas (CREDIT) das linhas */
  totalEntradas: number
  /** Soma de saídas (DEBIT) das linhas */
  totalSaidas: number
  /** Saldo final calculado = openingBalance + entradas - saidas */
  saldoCalculado: number | null
  /** Saldo final declarado no PDF */
  saldoDeclarado: number | null
  /** Diferença = saldoDeclarado - saldoCalculado (positiva = sobra) */
  diferenca: number | null
  /** Resumo curto em PT-BR pra UI */
  message: string
}

const TOLERANCE = 0.02 // R$ 0,02 — arredondamento de centavo

export function checkTotals(extraction: PdfBankStatementExtraction): TotalsCheckResult {
  const { openingBalance, closingBalance, lines } = extraction
  const totalEntradas = round2(sumByType(lines, 'CREDIT'))
  const totalSaidas = round2(sumByType(lines, 'DEBIT'))

  if (openingBalance === null || closingBalance === null) {
    return {
      matches: false,
      insufficient: true,
      totalEntradas,
      totalSaidas,
      saldoCalculado: null,
      saldoDeclarado: closingBalance,
      diferenca: null,
      message:
        openingBalance === null && closingBalance === null
          ? 'Saldos inicial e final não foram identificados no PDF — não dá pra conferir totais.'
          : openingBalance === null
            ? 'Saldo inicial não foi identificado no PDF — não dá pra conferir totais.'
            : 'Saldo final não foi identificado no PDF — não dá pra conferir totais.',
    }
  }

  const saldoCalculado = round2(openingBalance + totalEntradas - totalSaidas)
  const diferenca = round2(closingBalance - saldoCalculado)
  const matches = Math.abs(diferenca) <= TOLERANCE

  const message = matches
    ? `Totais conferem: R$ ${fmt(openingBalance)} + R$ ${fmt(totalEntradas)} − R$ ${fmt(totalSaidas)} = R$ ${fmt(saldoCalculado)} (extrato fecha)`
    : `A soma não fecha com o extrato: calculei R$ ${fmt(saldoCalculado)} mas o PDF diz R$ ${fmt(closingBalance)}. Diferença: R$ ${fmt(Math.abs(diferenca))}. Confira se faltou alguma linha.`

  return {
    matches,
    insufficient: false,
    totalEntradas,
    totalSaidas,
    saldoCalculado,
    saldoDeclarado: closingBalance,
    diferenca,
    message,
  }
}

function sumByType(lines: PdfBankStatementLine[], type: 'CREDIT' | 'DEBIT'): number {
  return lines
    .filter((l) => l.type === type)
    .reduce((s, l) => s + l.amount, 0)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
