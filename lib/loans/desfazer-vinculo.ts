// ⭐⭐⭐ DESFAZER O VÍNCULO DE UMA PARCELA — A PORTA QUE FALTAVA (19/09/2026).
//
// ⛔⛔ **A capacidade não existia.** O `DELETE .../parcelas/[number]` da rota antiga mexe
// **só no caminho 1:1** (`status`, `paidDate`, `reconciledTransactionId`) e **não apaga os
// `LoanInstallmentPayment`** nem limpa o split. Usá-lo numa parcela paga por N:1 deixaria o
// pior estado possível: parcela **OPEN segurando pagamentos** — pior do que antes.
//
// ⚠️ E isto não é uma correção avulsa: o dono vai errar de novo (dois contratos do mesmo
// banco, adjacentes num menu, é caso de repetir). *Cirurgia que se faz uma vez vira script
// perdido; gesto que fica vira porta.*
//
// ⭐ **A REGRA:** desfazer devolve a parcela ao estado de quem **nunca** foi paga — os
// pagamentos somem, o split some, o status volta a OPEN. Quem RE-grava depois é sempre
// `vincularPagamentoDeParcela` (a porta única de 11/09), que recalcula o split do zero.
// ⛔ Nada de "ajustar o paidTotal na mão": número de dinheiro corrigido a dedo é o começo
// do dado que ninguém consegue explicar depois.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export class DesfazerVinculoError extends Error {
  constructor(public code: string, msg: string) { super(msg) }
}

export interface DesfazerInput {
  companyId: string
  loanId: string
  installmentNumber: number
  /**
   * ⭐ quais lançamentos soltar. **Omitido = todos** da parcela.
   * ⚠️ Soltar UM de vários é legítimo (o sweep do Sicredi tem 21 numa parcela só), e é por
   * isso que a lista existe — mas o que sobra é **re-vinculado pela porta única**, nunca
   * remendado aqui.
   */
  transactionIds?: string[]
  db?: PrismaClient | Prisma.TransactionClient
}

export interface DesfazerResultado {
  soltos: number
  /** os que continuaram na parcela (precisam de re-vínculo pela porta única) */
  restantes: string[]
  contractNumber: string | null
}

export async function desfazerVinculoDeParcela(input: DesfazerInput): Promise<DesfazerResultado> {
  const db = (input.db ?? defaultPrisma) as PrismaClient

  const loan = await db.loan.findFirst({
    where: { id: input.loanId, companyId: input.companyId },
    select: { id: true, contractNumber: true, status: true },
  })
  // ⛔ REGRA 8: a posse é checada por id + empresa, nunca por nome
  if (!loan) throw new DesfazerVinculoError('LOAN_NOT_FOUND', 'Contrato não encontrado nesta empresa.')

  const parcela = await db.loanInstallment.findFirst({
    where: { loanId: loan.id, number: input.installmentNumber },
    select: { id: true, reconciledTransactionId: true, payments: { select: { id: true, transactionId: true } } },
  })
  if (!parcela) throw new DesfazerVinculoError('INSTALLMENT_NOT_FOUND', 'Parcela não encontrada.')

  const alvo = input.transactionIds
    ? parcela.payments.filter((p) => input.transactionIds!.includes(p.transactionId))
    : parcela.payments

  if (alvo.length === 0 && !parcela.reconciledTransactionId) {
    throw new DesfazerVinculoError('NADA_A_DESFAZER',
      `A parcela ${input.installmentNumber} do contrato ${loan.contractNumber} não tem vínculo nenhum.`)
  }

  const restantes = parcela.payments.filter((p) => !alvo.some((a) => a.id === p.id)).map((p) => p.transactionId)

  await db.loanInstallmentPayment.deleteMany({ where: { id: { in: alvo.map((a) => a.id) } } })

  /**
   * ⭐⭐ A PARCELA VOLTA A SER "NUNCA PAGA" — inclusive quando sobra pagamento.
   *
   * ⛔ Deixar o split velho de pé com um pagamento a menos seria **exatamente o estado
   * inconsistente que este conserto existe pra apagar** (a #24 tinha 2 pagamentos somando
   * R$ 12.520,68 e `paidTotal` R$ 5.617,23). Quem devolve o número certo é o re-vínculo.
   */
  await db.loanInstallment.update({
    where: { id: parcela.id },
    data: {
      status: 'OPEN', paidDate: null, reconciledTransactionId: null,
      paidTotal: null, paidInterest: null, paidCorrection: null, paidPenalty: null,
    },
  })

  // ⚠️ contrato quitado que perde um pagamento volta a ser ATIVO
  if (loan.status === 'PAID_OFF') {
    await db.loan.update({ where: { id: loan.id }, data: { status: 'ACTIVE' } })
  }

  return { soltos: alvo.length, restantes, contractNumber: loan.contractNumber }
}
