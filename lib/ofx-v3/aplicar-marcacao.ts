// APLICAR MARCAÇÃO DE IMPORT — a lógica, fora da rota (29/08/2026).
//
// ⚠️ POR QUE SAIU DA ROTA: as marcações passaram a ser aplicadas DENTRO da transação do
// import (atomicidade: ou grava tudo, ou nada grava). Pra isso a função precisa aceitar o
// client TRANSACIONAL — enquanto ela usava o `prisma` global, era impossível.
//
// ⚠️ E a `$transaction` aninhada do PAGAMENTO_EMPRESTIMO teve que sair: Prisma não permite
// transação dentro de transação. Como agora TUDO roda numa transação só, o aninhamento
// deixou de ser necessário — e a atomicidade ficou mais forte, não mais fraca.
//
// A rota `/apply-marks` continua existindo (import legado, retry manual) e passou a ser
// casca fina sobre esta função — REGRA 4: uma lógica, dois chamadores.

import type { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { resolvePaidInvoiceMonth } from '@/lib/credit-card-pj/resolve-paid-month'
import { vincularPagamentoDeParcela } from '@/lib/loans/vincular-pagamento'
import type { OfxLineKind } from './types'

type Db = PrismaClient | Prisma.TransactionClient

export const markParamsSchema = z.object({
  categoryId: z.string().cuid().nullable().optional(),
  supplierId: z.string().cuid().nullable().optional(),
  customerId: z.string().cuid().nullable().optional(),
  cardId: z.string().cuid().nullable().optional(),
  loanId: z.string().cuid().nullable().optional(),
  installmentNumber: z.number().int().positive().nullable().optional(),
}).partial()

type AppliedResult = 'applied' | 'skipped'

export async function aplicarMarcacao(
  tx: {
    id: string
    type: string
    amount: number
    description: string
    date: Date
    categoryId: string | null
    isCardPayment: boolean
    businessCreditCardId: string | null
    transferGroupId: string | null
    status: string
    ignoredAt: Date | null
    cashCoded: boolean
  },
  kind: OfxLineKind,
  params: z.infer<typeof markParamsSchema>,
  companyId: string,
  userId: string,
  db: Db,
): Promise<AppliedResult> {
  switch (kind) {
    case 'RECEITA':
    case 'DESPESA': {
      if (!params.categoryId) throw new Error('categoryId obrigatório pra RECEITA/DESPESA')
      // Idempotente: se já tem essa categoria + cashCoded, skip
      if (tx.categoryId === params.categoryId && tx.cashCoded) return 'skipped'
      const cat = await db.category.findFirst({
        where: { id: params.categoryId, companyId },
        select: { id: true, type: true },
      })
      if (!cat) throw new Error('categoria inválida')
      // Coerência: RECEITA → categoria INCOME; DESPESA → EXPENSE
      if (kind === 'RECEITA' && cat.type !== 'INCOME')
        throw new Error('categoria escolhida não é receita')
      if (kind === 'DESPESA' && cat.type !== 'EXPENSE')
        throw new Error('categoria escolhida não é despesa')
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          categoryId: params.categoryId,
          supplierId: params.supplierId ?? undefined,
          customerId: params.customerId ?? undefined,
          status: 'RECONCILED',
          cashCoded: true,
          cashCodedAt: new Date(),
        },
      })
      return 'applied'
    }

    case 'TRANSFER': {
      // Sprint Pending Transfer State (27/06/2026, modelo QuickBooks/Xero):
      // marca pendingTransfer=true + direction inferida pelo type (DEBIT=OUT,
      // CREDIT=IN). Isso TIRA a tx do DRE, das filas /pendentes e /conciliacao
      // imediatamente — mesmo SEM o par real chegar. Quando o scanRetroativo
      // casa (ou o user usa match 1-clique em /transferencias), ambas viram
      // type='TRANSFER' e o filtro de type cobre a partir daí.
      //
      // NAO mudar type=DEBIT/CREDIT aqui — preserva contentHash/sinal exato
      // no seen-ledger (Sprint Import Idempotente).
      if (tx.transferGroupId) return 'skipped' // já pareado
      const direction: 'OUT' | 'IN' | null =
        tx.type === 'DEBIT' ? 'OUT' : tx.type === 'CREDIT' ? 'IN' : null
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          categoryId: null,
          notes: '[V3:AGUARDANDO_PAR_TRANSFERENCIA]',
          pendingTransfer: true,
          pendingTransferDirection: direction,
          pendingTransferSince: new Date(),
        },
      })
      return 'applied'
    }

    case 'PAGAMENTO_CARTAO': {
      if (!params.cardId) throw new Error('cardId obrigatório')
      // Idempotente: se já casado com esse cartão, skip
      if (tx.isCardPayment && tx.businessCreditCardId === params.cardId) return 'skipped'
      const card = await db.businessCreditCard.findFirst({
        where: { id: params.cardId, companyId },
        select: { id: true },
      })
      if (!card) throw new Error('cartão inválido')
      if (tx.type !== 'DEBIT') throw new Error('apenas DEBIT pode ser pagamento de cartão')
      // ⚠️ FIX (17/08): o import marcava isCardPayment + cartão mas NUNCA setava o
      // paidInvoiceMonth → a fatura ficava OPEN pra sempre (o Banrisul 13.779,73 de
      // agosto). Agora casa a competência pela MESMA fn da tela (resolvePaidInvoiceMonth
      // — por VALOR, não "a mais recente"). REGRA 4/5: um caminho só.
      const paidInvoiceMonth = await resolvePaidInvoiceMonth(db as PrismaClient, params.cardId, tx.amount)
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          isCardPayment: true,
          businessCreditCardId: params.cardId,
          paidInvoiceMonth,
          categoryId: null, // pagamento de cartão não é despesa direta
        },
      })
      return 'applied'
    }

    case 'PAGAMENTO_EMPRESTIMO': {
      if (!params.loanId || params.installmentNumber == null)
        throw new Error('loanId e installmentNumber obrigatórios')
      if (tx.type !== 'DEBIT') throw new Error('apenas DEBIT pode ser pagamento de parcela')

      /**
       * ⭐⭐⭐ A MESMA PORTA DO PAINEL (11/09/2026) — `vincularPagamentoDeParcela`.
       *
       * ⛔⛔ O QUE ISTO SUBSTITUI, e era grave: o ramo marcava `status:'PAID'` +
       * `reconciledTransactionId` **e mais nada**. Sem `paidTotal`/`paidInterest`/
       * `paidCorrection`, e como o DRE lê **exatamente** esses campos, a parcela entrava
       * "paga" com **encargo ZERO** — no caso real do C61021346-2 seriam
       * **R$ 1.559,72 de despesa financeira sumindo do resultado**, calados.
       *
       * ⚠️ E gravava pela porta **1:1** enquanto o painel usa a **N:1**: duas portas pro
       * mesmo fato, a família que o `loan_installment_no_double_link` existe pra recusar.
       */
      const jaVinculada = await (db as PrismaClient).loanInstallmentPayment.findFirst({
        where: { transactionId: tx.id }, select: { id: true },
      })
      if (jaVinculada) return 'skipped'   // idempotente: reimportar não duplica

      await vincularPagamentoDeParcela({
        db,
        companyId,
        loanId: params.loanId,
        installmentNumber: params.installmentNumber,
        transactionIds: [tx.id],
      })
      void userId
      return 'applied'
    }

    case 'IGNORAR': {
      if (tx.ignoredAt) return 'skipped'
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          ignoredAt: new Date(),
          status: 'IGNORED',
        },
      })
      return 'applied'
    }
  }
}
