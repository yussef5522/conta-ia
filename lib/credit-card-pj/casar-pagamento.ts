// ⭐⭐ A ÚNICA PORTA QUE FAZ UMA LINHA DO EXTRATO QUITAR UMA FATURA (15/09/2026).
//
// ⛔ Ela nasceu EXTRAÍDA da rota `/cartoes/[cardId]/casar-pagamento`, que era o único
// caminho — e por isso o gesto do balcão não tinha como reusá-la sem copiar. **Copiar seria
// a segunda porta de gravação do mesmo fato**, exatamente o que o `vincularPagamentoDeParcela`
// (11/09) existe pra impedir do lado do empréstimo.
//
// ⚠️ A rota continua viva como CASCA FINA sobre esta função (REGRA 4: uma lógica, N chamadores).

import type { PrismaClient } from '@prisma/client'
import { resolvePaidInvoiceMonth } from './resolve-paid-month'

export class CasarPagamentoError extends Error {}

export interface CasarPagamentoResultado {
  transactionId: string
  paidInvoiceMonth: string | null
  previousCategoryId: string | null
  deltaDespesaRemovidoDoDRE: number
}

export async function casarPagamentoDeCartao(
  input: { companyId: string; cardId: string; txId: string; invoiceMonth?: string | null },
  db: PrismaClient,
): Promise<CasarPagamentoResultado> {
  const card = await db.businessCreditCard.findFirst({ where: { id: input.cardId, companyId: input.companyId }, select: { id: true } })
  if (!card) throw new CasarPagamentoError('Cartão não encontrado.')

  const tx = await db.transaction.findFirst({
    where: { id: input.txId, bankAccount: { companyId: input.companyId } },
    select: { id: true, type: true, amount: true, categoryId: true },
  })
  if (!tx) throw new CasarPagamentoError('Transação não encontrada.')
  // ⛔ o sentido manda: crédito não paga fatura. A mesma lei do balcão, na FONTE.
  if (tx.type === 'CREDIT') throw new CasarPagamentoError('Só uma SAÍDA pode ser pagamento de cartão.')

  /**
   * ⚠️ A competência que o pagamento quita sai da fn ÚNICA (`resolvePaidInvoiceMonth`), a
   * MESMA que o import usa — e ela casa por **VALOR**, nunca por "a mais recente": esse era
   * o bug sistêmico que mandou o 7.896,32 pra julho porque agosto ainda não existia.
   */
  const paidInvoiceMonth = input.invoiceMonth ?? await resolvePaidInvoiceMonth(db, input.cardId, tx.amount)

  const updated = await db.transaction.update({
    where: { id: tx.id },
    data: {
      isCardPayment: true,
      businessCreditCardId: input.cardId,
      paidInvoiceMonth,
      // ⚠️ zera a categoria: pagamento de fatura NÃO é despesa (a despesa é a compra, no
      // mês em que ela foi feita) — contá-lo seria a mesma saída duas vezes no DRE.
      categoryId: null,
    },
    select: { id: true, paidInvoiceMonth: true },
  })
  return {
    transactionId: updated.id,
    paidInvoiceMonth: updated.paidInvoiceMonth,
    previousCategoryId: tx.categoryId,
    /**
     * ⚠️ **SÓ É DELTA SE HAVIA O QUE REMOVER** (achado em 20/09): este campo devolvia
     * `tx.amount` SEMPRE — e a tela leu *"R$ 8.626,98 removidos do DRE"* numa linha que
     * **nunca teve categoria** (nada saiu de lugar nenhum). *Número que afirma um efeito
     * que não houve é a família do "número sem régua em tela de dinheiro".*
     *
     * ⚠️ Ressalva honesta: categoria de grupo não-DRE (transferência) ainda contaria aqui
     * — o que a régua garante é que **sem categoria o delta é ZERO**.
     */
    deltaDespesaRemovidoDoDRE: tx.categoryId ? tx.amount : 0,
  }
}
