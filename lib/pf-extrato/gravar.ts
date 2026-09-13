// ⭐⭐ O CONFIRMAR DO EXTRATO PF — tudo numa transação só (13/09/2026).
//
// ⛔ **Ou grava tudo, ou nada grava** — a régua de 29/08 ("as marcações do import viraram
// atômicas"). Meia gravação aqui deixaria linha importada sem a marca do casamento, e o
// próximo import a duplicaria: o estado pela metade **cria** o defeito que o casamento
// existe pra impedir.

import { prisma as defaultPrisma } from '@/lib/db'
import { stableKey } from '@/lib/reconciliation/stable-key'
import type { PreviewDoExtratoPF } from './orquestrador'

type Db = typeof defaultPrisma

export interface ResultadoDoImportPF {
  importId: string
  criadas: number
  casadas: number
  jaExistiam: number
  agendadas: number
  faturasQuitadas: number
  saldoDepois: number
}

export async function gravarExtratoPF(input: {
  profileId: string
  contaId: string
  userId: string
  fileName: string
  preview: PreviewDoExtratoPF
  ledgerBal: { amount: number; asOfDate: Date } | null
  /** ⭐ o que o 1º import aprendeu sobre a conta — o dono confirma na tela */
  aprender: { bankCode: string | null; accountNumber: string | null } | null
  /** categoria sugerida por linha (fitid → id) — a árvore PF, nunca a do DRE */
  categorias: Record<string, string | null>
}, db: Db = defaultPrisma): Promise<ResultadoDoImportPF> {
  const { preview } = input

  return db.$transaction(async (tx) => {
    const imp = await tx.personalOfxImport.create({
      data: {
        profileId: input.profileId, bankAccountId: input.contaId, userId: input.userId,
        status: 'SUCCESS', fileName: input.fileName, statementType: 'BANK',
        totalTransactions: preview.novas.length + preview.casadas.length + preview.jaImportadas,
        newTransactions: preview.novas.length, duplicates: preview.jaImportadas,
        periodStart: preview.periodo.de ? new Date(`${preview.periodo.de}T12:00:00Z`) : null,
        periodEnd: preview.periodo.ate ? new Date(`${preview.periodo.ate}T12:00:00Z`) : null,
        detectedFid: preview.banco.id,
      },
      select: { id: true },
    })

    // ⭐ 1 ── AS QUE CASAM: a tx manual RECEBE a marca do OFX. Ela não é recriada nem
    // reescrita no valor — o que muda é que ela passa a ter identidade de linha bancária,
    // e por isso o próximo import a reconhece pela camada 1 (identidade) em vez da larga.
    for (const c of preview.casadas) {
      await tx.personalTransaction.update({
        where: { id: c.txId },
        data: {
          origin: 'OFX',
          ofxImportId: imp.id,
          externalId: c.linha.fitid,
          dedupHash: stableKey({ date: c.linha.data, signedAmount: c.linha.valorComSinal, memo: c.linha.memo }),
          // ⚠️ a DESCRIÇÃO do dono FICA. Ele escreveu "Distribuição de Lucros caçula"; o
          // banco diz "PIX RECEBIDO 297…". Sobrescrever seria o extrato apagando a palavra
          // dele — e a categoria dele vem junto, intocada.
        },
      })
    }

    // ⭐ 2 ── AS NOVAS
    let criadas = 0
    for (const l of preview.novas) {
      await tx.personalTransaction.create({
        data: {
          profileId: input.profileId, bankAccountId: input.contaId,
          date: l.data, description: l.memo, amount: Math.abs(l.valorComSinal),
          type: l.valorComSinal >= 0 ? 'CREDIT' : 'DEBIT',
          status: 'RECONCILED', origin: 'OFX', ofxImportId: imp.id, externalId: l.fitid,
          dedupHash: stableKey({ date: l.data, signedAmount: l.valorComSinal, memo: l.memo }),
          categoryId: input.categorias[l.fitid] ?? null,
          classifiedBy: input.categorias[l.fitid] ? 'RULE' : null,
        },
      })
      criadas++
    }

    // ⭐ 3 ── OS PAGAMENTOS DE FATURA RECONHECIDOS
    let faturasQuitadas = 0
    for (const pg of preview.pagamentosDeFatura) {
      const linha = preview.novas.find((l) => l.fitid === pg.fitid)
      if (!linha) continue
      const f = await tx.creditCardInvoice.findUnique({ where: { id: pg.invoiceId }, select: { totalAmount: true, paidAmount: true } })
      if (!f) continue
      const pago = Math.round((f.paidAmount + Math.abs(linha.valorComSinal)) * 100) / 100
      await tx.creditCardInvoice.update({
        where: { id: pg.invoiceId },
        // ⛔ "paga" é DERIVADO do pago vs total (a régua de 09/09) — nunca um status na mão
        data: { paidAmount: pago, status: pago >= f.totalAmount - 0.005 ? 'PAID' : 'PARTIAL' },
      })
      await tx.personalTransaction.updateMany({
        where: { ofxImportId: imp.id, externalId: linha.fitid },
        data: { isInvoicePayment: true, creditCardId: pg.cardId },
      })
      // ⭐ E O CARTÃO APRENDE A CONTA: *"cartão sem conta de pagamento ganha o campo na
      // primeira vez que eu casar (aprende, não pede cadastro antes)"* — ordem do dono.
      await tx.creditCard.updateMany({
        where: { id: pg.cardId, defaultPaymentAccountId: null },
        data: { defaultPaymentAccountId: input.contaId },
      })
      faturasQuitadas++
    }

    // ⭐ 4 ── A ÂNCORA E O SALDO
    const soma = preview.novas.reduce((s, l) => s + l.valorComSinal, 0)
    const conta = await tx.personalBankAccount.findUniqueOrThrow({ where: { id: input.contaId }, select: { balance: true } })
    const saldoDepois = Math.round((conta.balance + soma) * 100) / 100
    await tx.personalBankAccount.update({
      where: { id: input.contaId },
      data: {
        balance: saldoDepois,
        ...(input.ledgerBal ? { ledgerBal: input.ledgerBal.amount, ledgerBalDate: input.ledgerBal.asOfDate } : {}),
        // ⭐ o que o arquivo ensinou sobre a conta — é o que faz a trava funcionar no próximo
        ...(input.aprender?.bankCode ? { bankCode: input.aprender.bankCode } : {}),
        ...(input.aprender?.accountNumber ? { accountNumber: input.aprender.accountNumber } : {}),
      },
    })

    return {
      importId: imp.id, criadas, casadas: preview.casadas.length,
      jaExistiam: preview.jaImportadas, agendadas: preview.agendadas.length,
      faturasQuitadas, saldoDepois,
    }
  })
}
