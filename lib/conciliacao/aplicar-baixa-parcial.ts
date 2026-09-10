// ⭐⭐⭐ A BAIXA PARCIAL GRAVADA (10/09/2026) — e o "em aberto" DERIVADO.
//
// **O dono:** *"payable aceita pagamento parcial hoje? Se não, é parte do sprint (valor
// pago acumulado + restante derivado — **nunca status na mão**)."*
//
// **Medido antes de construir: NÃO aceitava.** O `Transaction` do contas a pagar não tem
// campo de valor pago; o vínculo é tudo-ou-nada (`reconciledWithId` + `EFFECTED` +
// `RECONCILED`). Então a peça nova é a tabela `conciliacao_baixa_parcial`, e o valor pago
// de uma conta passa a ser a **soma** das baixas dela.
//
// ⛔ POR QUE TABELA E NÃO COLUNA: coluna de "valor pago" é um número gravado, e número
// gravado envelhece — foi assim que a `CreditCardInvoice.status` ficou eternamente `OPEN`
// depois de vencer. Somando as baixas, o em aberto é sempre o que as linhas dizem, e
// desfazer uma baixa devolve o saldo sozinho. É o desenho do `LoanInstallmentPayment`.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { TOLERANCIA } from './escolher-na-mao'

type Db = PrismaClient | Prisma.TransactionClient
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export class BaixaParcialError extends Error {}

/**
 * ⭐ QUANTO CADA CONTA JÁ RECEBEU em baixas parciais — uma query pra N contas.
 *
 * ⚠️ `groupBy` e não N buscas: esta função alimenta a fila inteira, e uma ida ao banco por
 * conta é o padrão que já custou 9,6 s nesta tela.
 */
export async function jaPagoPorConta(
  payableIds: string[], db: Db = defaultPrisma,
): Promise<Map<string, number>> {
  if (!payableIds.length) return new Map()
  const rows = await (db as PrismaClient).conciliacaoBaixaParcial.groupBy({
    by: ['payableId'],
    where: { payableId: { in: payableIds } },
    _sum: { valor: true },
  })
  return new Map(rows.map((r) => [r.payableId, round2(r._sum.valor ?? 0)]))
}

export interface BaixaParcialInput {
  companyId: string
  /** a conta a pagar que recebe a parte */
  payableId: string
  /** a linha do extrato que pagou */
  extratoId: string
  valor: number
  reconcileGroupId?: string | null
  userId?: string | null
}

export interface BaixaParcialResultado {
  payableId: string
  valorDaConta: number
  pagoAgora: number
  pagoTotal: number
  emAberto: number
  /** ⭐ a baixa zerou a conta? aí ela deixa de ser parcial e vira quitada */
  quitou: boolean
}

/**
 * ⭐⭐ GRAVA UMA BAIXA PARCIAL. Roda DENTRO da transação do N:1 (o chamador passa o `tx`).
 *
 * ⛔ RECUSA MAIS DO QUE A CONTA DEVE. Sem isto, duas baixas na mesma conta poderiam somar
 * mais que o valor de face e o "em aberto" viraria negativo — um número que ninguém
 * consegue defender e que contaminaria a soma do Contas a Pagar.
 */
export async function aplicarBaixaParcial(
  input: BaixaParcialInput, db: Db = defaultPrisma,
): Promise<BaixaParcialResultado> {
  if (input.valor <= 0) throw new BaixaParcialError('Baixa parcial precisa de valor positivo')

  const conta = await (db as PrismaClient).transaction.findUnique({
    where: { id: input.payableId },
    select: { id: true, amount: true, lifecycle: true, reconciledWithId: true },
  })
  if (!conta) throw new BaixaParcialError('Conta a pagar não encontrada')
  // ⛔ conta já quitada por vínculo inteiro não recebe parte — seria contar duas vezes
  if (conta.reconciledWithId) throw new BaixaParcialError('Esta conta já está conciliada por inteiro')
  if (conta.lifecycle !== 'PAYABLE' && conta.lifecycle !== 'RECEIVABLE') {
    throw new BaixaParcialError(`Baixa parcial só vale pra conta em aberto (recebeu ${conta.lifecycle})`)
  }

  const valorDaConta = round2(Math.abs(conta.amount))
  const antes = (await jaPagoPorConta([input.payableId], db)).get(input.payableId) ?? 0
  const depois = round2(antes + input.valor)
  if (depois > valorDaConta + TOLERANCIA) {
    throw new BaixaParcialError(
      `A baixa de R$ ${input.valor.toFixed(2)} passa do que a conta deve `
      + `(R$ ${valorDaConta.toFixed(2)}, já baixados R$ ${antes.toFixed(2)})`,
    )
  }

  await (db as PrismaClient).conciliacaoBaixaParcial.create({
    data: {
      companyId: input.companyId,
      payableId: input.payableId,
      extratoId: input.extratoId,
      valor: round2(input.valor),
      reconcileGroupId: input.reconcileGroupId ?? null,
      criadoPorId: input.userId ?? null,
    },
  })

  const emAberto = round2(valorDaConta - depois)
  const quitou = emAberto <= TOLERANCIA

  // ⭐⭐ QUITOU POR PARTES → a conta vira EFFECTED/RECONCILED pelo caminho normal.
  //
  // ⚠️ É o caso "N linhas → 1 nota" (pagamento em 2 PIX) fechando: a última baixa zera o
  // em aberto e a conta sai da fila. **O `reconciledWithId` aponta pra ÚLTIMA linha** —
  // as outras ficam no rastro da tabela de baixas, que é onde a história completa mora.
  if (quitou) {
    const linha = await (db as PrismaClient).transaction.findUnique({
      where: { id: input.extratoId }, select: { date: true, bankAccountId: true },
    })
    await (db as PrismaClient).transaction.update({
      where: { id: input.payableId },
      data: {
        lifecycle: 'EFFECTED',
        status: 'RECONCILED',
        paymentDate: linha?.date ?? new Date(),
        ...(linha?.bankAccountId ? { bankAccountId: linha.bankAccountId } : {}),
        reconciledWithId: input.extratoId,
        ...(input.reconcileGroupId ? { reconcileGroupId: input.reconcileGroupId } : {}),
      },
    })
  }

  return { payableId: input.payableId, valorDaConta, pagoAgora: round2(input.valor), pagoTotal: depois, emAberto, quitou }
}

/**
 * ⭐ DESFAZER — apaga as baixas de um grupo e devolve a conta pro estado aberto.
 *
 * ⚠️ Se a baixa tinha QUITADO a conta, desfazer precisa reabri-la: senão fica uma conta
 * "paga" com o dinheiro de volta em aberto — a dupla contagem ao contrário.
 */
export async function desfazerBaixasDoGrupo(
  reconcileGroupId: string, db: Db = defaultPrisma,
): Promise<number> {
  const baixas = await (db as PrismaClient).conciliacaoBaixaParcial.findMany({
    where: { reconcileGroupId }, select: { id: true, payableId: true },
  })
  if (!baixas.length) return 0
  await (db as PrismaClient).conciliacaoBaixaParcial.deleteMany({ where: { reconcileGroupId } })
  for (const b of baixas) {
    const conta = await (db as PrismaClient).transaction.findUnique({
      where: { id: b.payableId }, select: { amount: true, lifecycle: true },
    })
    if (!conta) continue
    const pago = (await jaPagoPorConta([b.payableId], db)).get(b.payableId) ?? 0
    if (pago < round2(Math.abs(conta.amount)) - TOLERANCIA && conta.lifecycle === 'EFFECTED') {
      await (db as PrismaClient).transaction.update({
        where: { id: b.payableId },
        data: {
          lifecycle: 'PAYABLE', status: 'PENDING', paymentDate: null,
          reconciledWithId: null, reconcileGroupId: null,
        },
      })
    }
  }
  return baixas.length
}
