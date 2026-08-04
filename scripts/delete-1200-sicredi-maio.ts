// Exclui a tx Sicredi DEBIT R$ 1.200 de 29/05 (mês de Maio, decisão do
// Yussef pra focar fechamento de Junho).
//
// Backup: /var/backups/conta-ia/pre-delete-1200-20260610_232032.dump
//
// Pré-checagens (já feitas):
//   - transferGroupId: NULL (sem par)
//   - reconciledWithId: NULL (não conciliada)
//   - reverso_count: 0 (ninguém aponta pra ela)
//   - bridge_count: 0 (sem bridge PJ→PF)
//   - categoryId: NULL
//   - Está completamente solta — exclusão segura.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const SICREDI_ID = 'cmq180ksv0001aktni9wj64mq'
const TX_ID = 'cmq5i5sie00csuwdi690o0xef' // Sicredi DEBIT 1.200 29/05 FITID 22308610732

const AMOUNT = 1200.0
const SICREDI_BEFORE = -74516.31
const SICREDI_AFTER = -73316.31 // -74516.31 + 1200 (revert DEBIT some)
const TOL = 0.01

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== Exclusão R$ 1.200 Sicredi 29/05 ===\n')

  // 1. Pré-validações inviolaveis
  const [tx, sicrediBefore] = await Promise.all([
    prisma.transaction.findUniqueOrThrow({
      where: { id: TX_ID },
      include: {
        bankAccount: { select: { name: true, companyId: true } },
        bridge: { select: { id: true } },
        reconciledFrom: { select: { id: true } },
      },
    }),
    prisma.bankAccount.findUniqueOrThrow({
      where: { id: SICREDI_ID },
      select: { balance: true },
    }),
  ])

  console.log('[validações pré]')
  if (!tx.bankAccount) throw new Error('Sem bankAccount. Aborta.')
  console.log(`  tx: ${tx.bankAccount.name} ${tx.type} R$ ${fmt(tx.amount)} em ${tx.date.toISOString().slice(0, 10)}`)
  console.log(`  FITID: ${tx.externalId}`)
  console.log(`  Memo: ${tx.description}`)
  console.log(`  transferGroupId: ${tx.transferGroupId ?? 'NULL'}`)
  console.log(`  reconciledWithId: ${tx.reconciledWithId ?? 'NULL'}`)
  console.log(`  reconciledFrom.length: ${tx.reconciledFrom.length}`)
  console.log(`  bridge: ${tx.bridge ? 'EXISTE!!' : 'NULL'}`)
  console.log(`  categoryId: ${tx.categoryId ?? 'NULL'}`)

  if (tx.bankAccount.companyId !== COMPANY_ID) throw new Error('Multi-tenant. Aborta.')
  if (tx.bankAccountId !== SICREDI_ID) throw new Error('Conta errada. Aborta.')
  if (Math.abs(tx.amount - AMOUNT) > 0.015) throw new Error('Valor errado. Aborta.')
  if (tx.type !== 'DEBIT') throw new Error(`Tipo errado: ${tx.type}. Aborta.`)
  if (tx.transferGroupId) throw new Error('Tem transferGroupId! Não exclui sem desfazer par. Aborta.')
  if (tx.reconciledWithId) throw new Error('Tem reconciledWithId! Aborta.')
  if (tx.reconciledFrom.length > 0) throw new Error('Tem reverso. Aborta.')
  if (tx.bridge) throw new Error('Tem bridge PJ→PF! Aborta.')

  if (!close(sicrediBefore.balance, SICREDI_BEFORE)) {
    throw new Error(`Sicredi balance mudou (${fmt(sicrediBefore.balance)}). Aborta.`)
  }
  console.log(`  ✓ Sicredi balance: ${fmt(sicrediBefore.balance)}`)
  console.log(`  ✓ Tx 100% solta — exclusão segura\n`)

  // 2. Atomic: delete tx + increment balance + audit
  console.log('[executando atomic...]')
  const result = await prisma.$transaction(async (tx2) => {
    const del = await tx2.transaction.delete({ where: { id: TX_ID } })

    const sicrediAfter = await tx2.bankAccount.update({
      where: { id: SICREDI_ID },
      data: { balance: { increment: AMOUNT } }, // revert DEBIT: balance sobe +1200
      select: { balance: true },
    })

    if (!close(sicrediAfter.balance, SICREDI_AFTER)) {
      throw new Error(
        `Sicredi pós ${fmt(sicrediAfter.balance)} ≠ esperado ${fmt(SICREDI_AFTER)}. Rollback.`,
      )
    }

    await tx2.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (delete 1.200 sicredi maio CLI)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'DELETE',
        entityType: 'Transaction',
        entityId: TX_ID,
        metadata: JSON.stringify({
          context: 'Exclusão de tx Sicredi DEBIT R$ 1.200 do dia 29/05/2026 — decisão Yussef pra focar fechamento de Junho',
          deleted_tx: {
            id: TX_ID,
            account: 'sicredi ',
            amount: AMOUNT,
            date: del.date.toISOString(),
            type: 'DEBIT',
            origin: 'OFX',
            externalId: tx.externalId,
            description: tx.description,
          },
          balanceBefore: sicrediBefore.balance,
          balanceAfter: sicrediAfter.balance,
          adjust: AMOUNT,
          impacto_fechamento_junho:
            'PIORA o gap Sicredi vs LEDGERBAL em R$ 1.200 — passa de +R$ 3.337,87 (sistema acima) para +R$ 4.537,87. Sprint B ajuste de inicial passa de -3.337,87 para -4.537,87.',
          backupPath: '/var/backups/conta-ia/pre-delete-1200-20260610_232032.dump',
        }),
      },
    })

    return { deletedId: del.id, sicrediAfter: sicrediAfter.balance }
  })

  console.log(`  ✓ Tx deletada: ${result.deletedId}`)
  console.log(`  ✓ Sicredi balance: ${fmt(sicrediBefore.balance)} → ${fmt(result.sicrediAfter)} (sobe +1.200)`)

  await prisma.$disconnect()
  console.log(`\n=== EXCLUSÃO CONCLUÍDA ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
