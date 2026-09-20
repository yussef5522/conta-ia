// ⭐⭐ O ESTOQUE FICA SABENDO QUE A CONTA FOI APAGADA (20/09/2026) — o conserto do F2.
//
// **O defeito, medido:** o estoque cria a conta a pagar da nota e guarda a amarra
// (`stock_payable_link`). Quando o financeiro **apaga** essa conta, a amarra vira **órfã** e
// o juiz passa a acusar, toda noite, *"o estoque diz ter enviado R$ X pro contas a pagar,
// mas essa conta não existe mais — apagada pelo financeiro?"*. Em prod: **26 órfãs**, e
// ninguém sabia por quê — nem que elas tinham sido apagadas **de propósito**, num gesto do
// próprio dono em 13/09.
//
// ⛔⛔ **A AMARRA NÃO É APAGADA — ela é MARCADA.** Apagar seria fazer o F2 calar jogando
// fora a única prova de que aquela nota **já foi** pro financeiro: na próxima conferência,
// o sistema mandaria a mesma nota de novo e o dono acabaria com a conta duplicada. *O
// alarme some porque foi EXPLICADO, nunca porque a evidência sumiu.*
//
// ⭐ É a mesma disciplina do fornecedor mesclado (11/09) e do item encerrado (19/09): o
// registro fica, com o rastro de quando e por quem.
//
// ⚠️ **E É TABELA PRÓPRIA, NÃO COLUNA** — o isolamento do módulo proíbe `ALTER` em tabela
// existente (migration de estoque é CREATE-only, com guard de CI desde a Fase 0). Também é
// honesto por conteúdo: *a amarra é um fato; a remoção da conta é outro*, com autor e data
// próprios.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⭐ Marca as amarras daquela conta como "a conta foi removida no financeiro".
 *
 * ⚠️ **Idempotente e silenciosa quando não há amarra** — a esmagadora maioria das contas
 * não vem do estoque, e transformar isso em erro faria o financeiro depender do módulo que
 * ele nem usou.
 */
export async function avisarEstoqueQueContaFoiRemovida(
  transactionId: string, companyId: string, userId: string | null, db: Db = defaultPrisma,
): Promise<number> {
  const amarras = await db.stockPayableLink.findMany({
    where: { companyId, transactionId }, select: { id: true },
  })
  if (!amarras.length) return 0
  for (const a of amarras) {
    await db.stockContaRemovida.upsert({
      where: { payableLinkId: a.id },
      create: { companyId, payableLinkId: a.id, transactionId, removidaPorId: userId },
      update: {},
    })
  }
  return amarras.length
}

/** ⭐ as amarras JÁ EXPLICADAS — o F2 consulta pra não gritar sobre o que tem resposta */
export async function amarrasExplicadas(companyId: string, db: Db = defaultPrisma): Promise<Set<string>> {
  const rows = await db.stockContaRemovida.findMany({ where: { companyId }, select: { payableLinkId: true } })
  return new Set(rows.map((r) => r.payableLinkId))
}

/**
 * ⭐ A amarra ainda cobra resposta? — a pergunta que o **F2** faz.
 *
 * ⛔ Amarra marcada continua existindo (a nota foi enviada, e isso é verdade), mas **sai
 * do alarme**: ela tem explicação. O que continua vermelho é a órfã SEM explicação —
 * aquela sim é conta que sumiu por um caminho que ninguém conhece.
 */
export function amarraFoiExplicada(payableLinkId: string, explicadas: ReadonlySet<string>): boolean {
  return explicadas.has(payableLinkId)
}
