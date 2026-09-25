// ⭐⭐⭐ A PORTA ÚNICA DO APORTE (25/09/2026) — o espelho do `vincularPagamentoDeParcela`.
//
// ⚠️ **Uma função, todos os chamadores** (REGRA 4). O gesto da caixa passa por aqui, e
// qualquer tela futura (a do contrato, um lote) passa também. Foi por existirem DUAS portas
// de gravação que a parcela de empréstimo entrou sem split pelo import em 11/09.

import type { PrismaClient } from '@prisma/client'
import { competenciaDaData, rastroDoAporte } from './contratos'

export class AporteError extends Error {
  constructor(msg: string) { super(msg); this.name = 'AporteError' }
}

export interface RegistrarAporteInput {
  db: PrismaClient
  companyId: string
  contractId: string
  txId: string
  /** ⭐ a competência que o dono confirmou; sem ela, deriva da data da linha */
  competencia?: string | null
  criadoPorId?: string | null
}

export interface AporteRegistrado {
  contratoNome: string
  competencia: string
  valor: number
  /** o texto que ficou escrito na linha */
  rastro: string
  /** ⭐ quanto já foi aportado neste contrato DEPOIS deste gesto */
  totalAportado: number
}

/**
 * ⭐⭐ Registra o aporte: vincula a LINHA ao CONTRATO e deixa o rastro.
 *
 * ⛔ **Tudo numa transação só.** Meio gesto (vínculo sem rastro) deixaria a linha dizendo
 * que é aporte sem dizer de qual contrato — o estado pela metade que o módulo recusa desde
 * as marcações atômicas de 29/08.
 *
 * ⚠️ **A categoria NÃO é inventada aqui.** As linhas da Caçula já vêm categorizadas como
 * `Investimentos`, e sobrescrever seria decidir por cima do dono (a régua de 17/08). Se um
 * dia a linha chegar sem categoria, quem resolve isso é o `resolverLinha`, não esta porta.
 */
export async function registrarAporte(input: RegistrarAporteInput): Promise<AporteRegistrado> {
  const { db, companyId, contractId, txId } = input

  const [contrato, tx] = await Promise.all([
    db.investmentContract.findFirst({
      where: { id: contractId, companyId },
      select: { id: true, nome: true, ativo: true, bankAccountId: true, valorParcela: true },
    }),
    db.transaction.findFirst({
      where: { id: txId, bankAccount: { companyId } },
      select: { id: true, amount: true, type: true, date: true, notes: true, bankAccountId: true },
    }),
  ])

  // ⛔ REGRA 8: o contrato é resolvido por ID **dentro da empresa** — nunca por nome
  if (!contrato) throw new AporteError('Contrato de investimento não encontrado nesta empresa.')
  if (!tx) throw new AporteError('Linha do extrato não encontrada nesta empresa.')
  if (tx.type !== 'DEBIT') {
    throw new AporteError('Aporte é dinheiro que SAI da conta — esta linha é uma entrada.')
  }
  /**
   * ⚠️ Contrato INATIVO recusa, **e a recusa ensina**: o dono pode ter encerrado o consórcio
   * e estar conciliando uma linha antiga. *Recusa sem caminho é beco* (a régua de 22/09).
   */
  if (!contrato.ativo) {
    throw new AporteError(`O contrato «${contrato.nome}» está encerrado. Reative-o em Investimentos pra registrar aportes nele.`)
  }

  const competencia = input.competencia ?? competenciaDaData(tx.date)
  if (!/^\d{4}-\d{2}$/.test(competencia)) {
    throw new AporteError('Competência inválida — use o formato AAAA-MM.')
  }

  /**
   * ⛔ A MESMA LINHA NÃO VIRA DOIS APORTES — e quem garante é o índice ÚNICO do banco.
   * ⚠️ A checagem aqui existe só pra a MENSAGEM ser boa; o backstop é o banco (mesma
   * situação do índice parcial da contagem, 23/09).
   */
  const jaExiste = await db.investmentContribution.findUnique({
    where: { transactionId: txId },
    select: { contract: { select: { nome: true } }, competencia: true },
  })
  if (jaExiste) {
    throw new AporteError(
      `Esta linha já está registrada como aporte no «${jaExiste.contract.nome}» (${jaExiste.competencia}).`,
    )
  }

  const valor = Math.abs(tx.amount)
  const rastro = rastroDoAporte(contrato.nome, competencia)

  await db.$transaction(async (trx) => {
    await trx.investmentContribution.create({
      data: { contractId, transactionId: txId, competencia, valor, criadoPorId: input.criadoPorId ?? null },
    })
    await trx.transaction.update({
      where: { id: txId },
      data: { notes: [tx.notes, rastro].filter(Boolean).join(' · ') },
    })
    /**
     * ⭐ E o contrato APRENDE a conta de onde a parcela sai, quando ainda não sabia.
     * ⚠️ Só preenche o que está `null` — **backfill cooperativo**, nunca sobrescrita: a
     * conta que o dono declarou é decisão dele (a régua do backfill de 20/09).
     */
    if (!contrato.bankAccountId && tx.bankAccountId) {
      await trx.investmentContract.update({
        where: { id: contractId },
        data: { bankAccountId: tx.bankAccountId },
      })
    }
  })

  const agg = await db.investmentContribution.aggregate({
    where: { contractId },
    _sum: { valor: true },
  })

  return {
    contratoNome: contrato.nome,
    competencia,
    valor,
    rastro,
    totalAportado: Math.round((agg._sum.valor ?? 0) * 100) / 100,
  }
}

/**
 * ⭐ DESFAZER — apaga o vínculo e tira o rastro.
 *
 * ⚠️ O rastro sai por SUBSTRING exata do que este gesto escreveu; nota que o dono digitou
 * depois **não é tocada**. *Desfazer pela metade deixaria na linha uma frase sobre um
 * vínculo que não existe mais* (a lição do undo do backfill, 20/09).
 */
export async function desfazerAporte(db: PrismaClient, companyId: string, txId: string): Promise<void> {
  const v = await db.investmentContribution.findUnique({
    where: { transactionId: txId },
    select: { id: true, competencia: true, contract: { select: { nome: true, companyId: true } } },
  })
  if (!v) throw new AporteError('Esta linha não está registrada como aporte.')
  if (v.contract.companyId !== companyId) throw new AporteError('Aporte de outra empresa.')

  const tx = await db.transaction.findUnique({ where: { id: txId }, select: { notes: true } })
  const rastro = rastroDoAporte(v.contract.nome, v.competencia)
  const notes = (tx?.notes ?? '')
    .split(' · ').filter((p) => p.trim() !== rastro).join(' · ') || null

  await db.$transaction(async (trx) => {
    await trx.investmentContribution.delete({ where: { id: v.id } })
    await trx.transaction.update({ where: { id: txId }, data: { notes } })
  })
}
