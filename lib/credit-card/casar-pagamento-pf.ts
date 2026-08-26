// CASAR O PAGAMENTO DA FATURA NO PF (26/08) — o elo que faltava pro ciclo fechar.
//
// ⚠️ POR QUE NÃO É O `payInvoice`: aquele CRIA a transação de pagamento (o dono digita
// "paguei R$ X da conta Y"). Aqui o dinheiro JÁ SAIU e JÁ ESTÁ no extrato importado —
// criar outra transação duplicaria a saída e o saldo da conta cairia duas vezes.
// Este fluxo pega a transação que existe e a AMARRA à fatura.
//
// É o equivalente PF do `casar-pagamento` da PJ. A diferença a favor da PF: aqui a
// fatura tem `status` de verdade na linha (OPEN/CLOSED/PAID/PARTIAL), enquanto na PJ
// "paga" é derivado de existir um pagamento com `paidInvoiceMonth` casando. Então a PF
// pode dizer PAGA como FATO — e a regra de quando dizer isso é a MESMA do `payInvoice`
// (`assertInvoicePaidConsistency`), não uma segunda cópia.

import { prisma } from '@/lib/db'
import { assertInvoicePaidConsistency } from './invoice-invariant'
import { CreditCardError } from './queries'
import { checkProfileAccess } from '@/lib/personal-profile/queries'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** Janela de busca em torno do vencimento — o débito costuma cair no dia ou perto. */
export const JANELA_DIAS = 12
/** Diferença aceitável entre o pago e o devido (centavos de arredondamento). */
export const TOLERANCIA = 0.02

export interface CandidatoPagamento {
  id: string
  data: string
  descricao: string
  valor: number
  contaNome: string | null
  /** true quando bate o valor devido ao centavo — o candidato óbvio */
  valorExato: boolean
  distanciaDias: number
}

/**
 * Candidatos a pagamento DESTA fatura: débitos do perfil, em conta bancária, que
 * ainda não são pagamento de fatura nenhuma, perto do vencimento.
 *
 * ⚠️ NÃO adivinha: devolve a lista ordenada (valor exato primeiro, depois proximidade
 * da data) e o dono confirma. Casar sozinho um débito de valor parecido marcaria a
 * fatura como paga com o dinheiro errado.
 */
export async function candidatosPagamentoPF(input: {
  userId: string
  profileId: string
  invoiceId: string
}): Promise<{ devido: number; vencimento: string; candidatos: CandidatoPagamento[] }> {
  await checkProfileAccess(input.userId, input.profileId)
  const invoice = await prisma.creditCardInvoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, creditCardId: true, dueDate: true, totalAmount: true, paidAmount: true, status: true },
  })
  if (!invoice) throw new CreditCardError('Fatura não encontrada', 'INVOICE_NOT_FOUND')

  const card = await prisma.creditCard.findUnique({
    where: { id: invoice.creditCardId },
    select: { profileId: true },
  })
  // REGRA 8 — a fatura tem que ser do perfil de quem pediu; sem isto um id de outro
  // perfil listaria os débitos deste.
  if (!card || card.profileId !== input.profileId) {
    throw new CreditCardError('Fatura de outro perfil', 'WRONG_PROFILE')
  }

  const devido = round2(invoice.totalAmount - invoice.paidAmount)
  const ms = JANELA_DIAS * 86_400_000
  const de = new Date(invoice.dueDate.getTime() - ms)
  const ate = new Date(invoice.dueDate.getTime() + ms)

  const txs = await prisma.personalTransaction.findMany({
    where: {
      profileId: input.profileId,
      type: 'DEBIT',
      isInvoicePayment: false,
      creditCardId: null, // não é compra de cartão — é saída da conta
      bankAccountId: { not: null },
      date: { gte: de, lte: ate },
    },
    select: {
      id: true, date: true, description: true, amount: true,
      bankAccount: { select: { name: true } },
    },
  })

  const candidatos = txs
    .map((t) => ({
      id: t.id,
      data: t.date.toISOString().slice(0, 10),
      descricao: t.description,
      valor: t.amount,
      contaNome: t.bankAccount?.name ?? null,
      valorExato: Math.abs(t.amount - devido) <= TOLERANCIA,
      distanciaDias: Math.round(Math.abs(t.date.getTime() - invoice.dueDate.getTime()) / 86_400_000),
    }))
    .sort((a, b) => {
      if (a.valorExato !== b.valorExato) return a.valorExato ? -1 : 1
      return a.distanciaDias - b.distanciaDias
    })

  return { devido, vencimento: invoice.dueDate.toISOString().slice(0, 10), candidatos }
}

export interface CasamentoResultado {
  invoiceId: string
  status: string
  pago: number
  devido: number
  transactionId: string
}

/**
 * Amarra a transação existente à fatura e atualiza o status.
 *
 * ⚠️ NÃO mexe no saldo da conta: o dinheiro já saiu quando a tx foi importada. Só o
 * `payInvoice` (que CRIA a saída) debita a conta — se este também debitasse, o saldo
 * cairia duas vezes. É a mesma família do "anti-dupla-contagem" do fluxo de caixa.
 */
export async function casarPagamentoPF(input: {
  userId: string
  profileId: string
  invoiceId: string
  transactionId: string
}): Promise<CasamentoResultado> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const invoice = await prisma.creditCardInvoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, creditCardId: true, totalAmount: true, paidAmount: true, reference: true },
  })
  if (!invoice) throw new CreditCardError('Fatura não encontrada', 'INVOICE_NOT_FOUND')
  const card = await prisma.creditCard.findUnique({
    where: { id: invoice.creditCardId },
    select: { profileId: true },
  })
  if (!card || card.profileId !== input.profileId) {
    throw new CreditCardError('Fatura de outro perfil', 'WRONG_PROFILE')
  }

  const tx = await prisma.personalTransaction.findUnique({
    where: { id: input.transactionId },
    select: { id: true, profileId: true, type: true, amount: true, isInvoicePayment: true, creditCardInvoiceId: true },
  })
  if (!tx) throw new CreditCardError('Lançamento não encontrado', 'TX_NOT_FOUND')
  if (tx.profileId !== input.profileId) throw new CreditCardError('Lançamento de outro perfil', 'WRONG_PROFILE')
  if (tx.type !== 'DEBIT') throw new CreditCardError('Só uma SAÍDA pode pagar fatura', 'NOT_DEBIT')
  if (tx.isInvoicePayment) throw new CreditCardError('Este lançamento já paga uma fatura', 'ALREADY_LINKED')

  const devido = round2(invoice.totalAmount - invoice.paidAmount)
  if (devido <= 0) throw new CreditCardError('Fatura já está paga', 'ALREADY_PAID')
  if (tx.amount > devido + TOLERANCIA) {
    throw new CreditCardError(
      `Pagamento (R$ ${tx.amount.toFixed(2)}) maior que o devido (R$ ${devido.toFixed(2)})`,
      'OVERPAY',
    )
  }

  const novoPago = round2(invoice.paidAmount + tx.amount)
  const quitada = novoPago >= invoice.totalAmount - 0.001
  const novoStatus = quitada ? 'PAID' : 'PARTIAL'
  // MESMA barreira do payInvoice — impossível marcar paga sem dinheiro.
  assertInvoicePaidConsistency({ status: novoStatus, paidAmount: novoPago })

  await prisma.$transaction(async (db) => {
    await db.personalTransaction.update({
      where: { id: tx.id },
      data: {
        isInvoicePayment: true,
        creditCardId: invoice.creditCardId,
        creditCardInvoiceId: invoice.id,
      },
    })
    await db.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: novoPago, status: novoStatus },
    })
  })

  return {
    invoiceId: invoice.id,
    status: novoStatus,
    pago: novoPago,
    devido: round2(invoice.totalAmount - novoPago),
    transactionId: tx.id,
  }
}

/** Desfaz o casamento (o dono errou a fatura). Devolve a tx pro extrato. */
export async function desfazerCasamentoPF(input: {
  userId: string
  profileId: string
  transactionId: string
}): Promise<{ invoiceId: string; status: string }> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const tx = await prisma.personalTransaction.findUnique({
    where: { id: input.transactionId },
    select: { id: true, profileId: true, amount: true, isInvoicePayment: true, creditCardInvoiceId: true },
  })
  if (!tx || tx.profileId !== input.profileId) throw new CreditCardError('Lançamento não encontrado', 'TX_NOT_FOUND')
  if (!tx.isInvoicePayment || !tx.creditCardInvoiceId) {
    throw new CreditCardError('Este lançamento não paga fatura nenhuma', 'NOT_LINKED')
  }
  const invoice = await prisma.creditCardInvoice.findUniqueOrThrow({
    where: { id: tx.creditCardInvoiceId },
    select: { id: true, paidAmount: true, totalAmount: true },
  })
  const novoPago = round2(Math.max(0, invoice.paidAmount - tx.amount))
  const novoStatus = novoPago <= 0.001 ? 'CLOSED' : 'PARTIAL'
  assertInvoicePaidConsistency({ status: novoStatus, paidAmount: novoPago })

  await prisma.$transaction(async (db) => {
    await db.personalTransaction.update({
      where: { id: tx.id },
      data: { isInvoicePayment: false, creditCardId: null, creditCardInvoiceId: null },
    })
    await db.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: novoPago, status: novoStatus },
    })
  })
  return { invoiceId: invoice.id, status: novoStatus }
}
