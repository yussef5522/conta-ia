// ⭐⭐⭐ A CONFERÊNCIA DIÁRIA LIGADA NO IMPORT (04/09/2026).
//
// ⭐ O desenho de 01/09, que já existia e vivia só em script: **o OFX dá as LINHAS, o PDF dá
// a RÉGUA**. A régua é o `SALDO NA DATA` de cada dia — o saldo **contábil**, o que o banco
// realmente deve — e não o `<LEDGERBAL>` do OFX, que no Banrisul é o **disponível** e já
// desconta o bloqueio de 24h.
//
// ⚠️ E o BLOQUEIO vira informação ao lado dos dois números, em vez da "diferença
// misteriosa" de R$ 2.476,53 que a tela cuspia.

import type { PrismaClient } from '@prisma/client'
import { extractPdfText } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { banrisulPdfParser } from '@/lib/bank-statement-pdf/banrisul-parser'
import { conferirDiaADia } from '@/lib/bank-statement-pdf/conferencia-diaria'
import { fraseDoSelo, type SeloDiario } from './selo-do-import'

/**
 * Roda a conferência dia-a-dia do que ESTÁ no nosso ledger contra o PDF anexado.
 *
 * ⚠️ Devolve `null` (e não erro) quando o PDF não traz régua — sem `SALDO ANT` não há de
 * onde partir, e afirmar conferência sem abertura seria selo de graça.
 */
export async function conferirComPdf(
  bankAccountId: string, pdfBytes: Uint8Array, db: PrismaClient,
): Promise<SeloDiario | null> {
  const texto = await extractPdfText(pdfBytes)
  const p = banrisulPdfParser.parse(texto) as ReturnType<typeof banrisulPdfParser.parse> & {
    saldoAnterior?: { data: string; valor: number } | null
    saldosDiarios?: Array<{ data: string; valor: number }>
    bloqueado?: number | null
    saldoDisponivel?: number | null
  }
  if (!p.saldoAnterior || !p.saldosDiarios?.length) return null

  // as nossas linhas do período que o PDF cobre
  const de = new Date(`${p.saldoAnterior.data}T00:00:00.000Z`)
  const ate = new Date(`${p.saldosDiarios[p.saldosDiarios.length - 1].data}T23:59:59.999Z`)
  const txs = await db.transaction.findMany({
    where: { bankAccountId, lifecycle: 'EFFECTED', date: { gt: de, lte: ate } },
    select: { id: true, date: true, amount: true, type: true, description: true },
    orderBy: { date: 'asc' },
  })

  const r = conferirDiaADia(
    { saldoAnterior: p.saldoAnterior, saldosDiarios: p.saldosDiarios },
    txs.map((t) => ({
      id: t.id,
      data: t.date.toISOString().slice(0, 10),
      // ⚠️ sinal pelo TIPO, como no resto do sistema (amount é sempre positivo)
      valor: t.type === 'DEBIT' ? -t.amount : t.amount,
      descricao: t.description,
    })),
  )
  if (!r.conferivel) return null

  const contabil = p.saldosDiarios[p.saldosDiarios.length - 1]?.valor ?? null
  const base: Omit<SeloDiario, 'frase'> = {
    diasConferidos: r.dias.length,
    diasQueFecham: r.dias.filter((d) => d.fecha).length,
    todosFecham: r.todosFecham,
    primeiroQueNaoFecha: r.primeiroQueNaoFecha
      ? {
        data: r.primeiroQueNaoFecha.data,
        diferenca: r.primeiroQueNaoFecha.diferenca,
        lancamentos: r.primeiroQueNaoFecha.lancamentos.map((l) => ({ data: l.data, valor: l.valor, descricao: l.descricao })),
      }
      : null,
    bloqueado: p.bloqueado ?? null,
    saldoDisponivel: p.saldoDisponivel ?? null,
    saldoContabil: contabil,
  }
  return { ...base, frase: fraseDoSelo(base) }
}
