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
import { gravarReguaDeclarada, reescritaDoBanco, type ReguaReescrita } from '@/lib/balance/ancora-abertura'

/** uma linha que o CONFIRMAR vai criar (o que está na lista "a importar" da tela) */
export interface LinhaAImportar {
  datePosted: Date
  signedAmount: number
  memo: string
}

/**
 * Roda a conferência dia-a-dia contra o PDF anexado.
 *
 * ⭐⭐⭐ ELA SIMULA O CONFIRMAR (05/09/2026) — decisão do dono: *"acusar o próprio conteúdo
 * do import é fabricar susto"*.
 *
 * ⛔ O QUE ERA: a query pegava `lifecycle:'EFFECTED'` — só o que JÁ está no ledger — e
 * rodava no PREVIEW, onde as linhas do dia ainda não entraram. Resultado medido no caso
 * real: *"01/09 não fecha: R$ 1.146,02 a mais"*, sendo que **os 3 encargos daquele dia
 * (Σ 1.741,70) estavam na lista "a importar" da MESMA TELA**. O dia ia fechar sozinho ao
 * confirmar. Por construção, todo import acusava o próprio conteúdo.
 *
 * ⚠️ E OS DOIS DESFECHOS TÊM QUE SER DISTINTOS NA TELA, senão a correção troca um susto
 * por outro: *"01/09 fecha depois de confirmar"* (nada a fazer) é uma notícia; *"não fecha
 * nem depois — faltam R$ X"* é outra, e só a segunda pede ação.
 *
 * ⚠️ Devolve `null` (e não erro) quando o PDF não traz régua — sem `SALDO ANT` não há de
 * onde partir, e afirmar conferência sem abertura seria selo de graça.
 *
 * @param linhasAImportar o que o CONFIRMAR vai criar (`recon.missing` — a MESMA lista, não
 *   uma recontagem: se viesse de outro cálculo, tela e gravação voltariam a divergir).
 */
export async function conferirComPdf(
  bankAccountId: string, pdfBytes: Uint8Array, db: PrismaClient,
  linhasAImportar: LinhaAImportar[] = [],
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

  const doLedger = txs.map((t) => ({
    id: t.id,
    data: t.date.toISOString().slice(0, 10),
    // ⚠️ sinal pelo TIPO, como no resto do sistema (amount é sempre positivo)
    valor: t.type === 'DEBIT' ? -t.amount : t.amount,
    descricao: t.description,
  }))
  // ⭐ as linhas que o confirmar vai criar, dentro da janela que o PDF cobre
  const aImportar = linhasAImportar
    .filter((l) => l.datePosted > de && l.datePosted <= ate)
    .map((l, i) => ({
      id: `a-importar-${i}`,
      data: l.datePosted.toISOString().slice(0, 10),
      valor: l.signedAmount,
      descricao: l.memo,
    }))

  const regua = { saldoAnterior: p.saldoAnterior, saldosDiarios: p.saldosDiarios }
  // ⭐⭐ O SELO FALA DO PREVISTO (ledger + o que vai entrar); o `soLedger` existe só pra
  // distinguir "fecha depois de confirmar" de "não fecha nem depois".
  const r = conferirDiaADia(regua, [...doLedger, ...aImportar])
  const soLedger = aImportar.length ? conferirDiaADia(regua, doLedger) : r
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
    linhasSimuladas: aImportar.length,
    // ⭐ o dia só fechava PORQUE as linhas deste import entraram na conta
    fechaDepoisDeConfirmar: r.todosFecham && !soLedger.todosFecham,
  }
  return { ...base, frase: fraseDoSelo(base) }
}


/**
 * ⭐⭐⭐ GRAVA A RÉGUA DO PDF — o passo que NUNCA existiu (05/09/2026).
 *
 * ⛔ **`gravarReguaDeclarada` tinha ZERO chamadores de produção**: só testes. A régua
 * (`bank_account_saldo_declarado`) foi escrita **uma única vez**, em 01/09 18:03, por um
 * script de sprint. O import com PDF lia o documento, conferia **em memória**, mostrava na
 * tela e **jogava fora**.
 *
 * ⚠️ E o efeito era sutil, por isso durou: o selo do card **é derivado na hora** (recalcula
 * certinho) — o que estava congelado era a **RÉGUA**. Ela era de um PDF emitido às **14:01
 * do dia 01/09**, ou seja **no meio do dia**, antes dos 3 encargos existirem. Por isso o
 * badge dizia *"01/09 não fecha (R$ 1.741,70)"* — a soma exata dos encargos — mesmo depois
 * de eles entrarem no ledger. **O badge não estava velho; a régua estava.**
 *
 * ⚠️ Roda DEPOIS do commit do import e é FAIL-SOFT: PDF ilegível não desfaz um import que
 * já gravou (a mesma disciplina do gatilho de vendas).
 */
export async function registrarReguaDoPdf(
  bankAccountId: string, pdfBytes: Uint8Array, db: PrismaClient,
): Promise<{ gravados: number; reescritos: ReguaReescrita[]; aviso: string | null } | null> {
  const texto = await extractPdfText(pdfBytes)
  const p = banrisulPdfParser.parse(texto) as ReturnType<typeof banrisulPdfParser.parse> & {
    saldoAnterior?: { data: string; valor: number } | null
    saldosDiarios?: Array<{ data: string; valor: number }>
    bloqueado?: number | null
    emitidoEm?: string | null
  }
  if (!p.saldosDiarios?.length) return null

  // ⭐ o "SALDO ANT EM" entra como dia declarado também: é o fechamento do dia anterior, e
  // é exatamente ele que denuncia a reescrita do mês fechado (31/08: −7.353,66 → −8.130,19).
  const dias = [
    ...(p.saldoAnterior ? [p.saldoAnterior] : []),
    ...p.saldosDiarios,
  ]
  const r = await gravarReguaDeclarada(db, {
    bankAccountId,
    origem: 'PDF_BANRISUL',
    emitidoEm: p.emitidoEm ? new Date(p.emitidoEm) : null,
    dias,
    bloqueado: p.bloqueado ?? null,
  })
  return { ...r, aviso: reescritaDoBanco(r.reescritos) }
}
