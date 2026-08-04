// Parear R$ 3.000 (09/06) Sicredi → banco caixa
// 1. Cria entrada manual +3.000 no banco caixa (sobe balance em 3.000)
// 2. Pareia com a saída Sicredi −3.000 (que já existe) como grupo TRANSFER
// 3. E1 anti-duplicação ativo
//
// IMPACTO de saldo:
//   - banco caixa: +4.680,68 → +7.680,68 (sobe 3.000 pela criação)
//   - sicredi: -74.516,31 → -74.516,31 (não muda, só type mudou)

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { findDuplicateTransferGroup } from '../lib/transfers/check-duplicate-group'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const SICREDI_ID = 'cmq180ksv0001aktni9wj64mq'
const BANCO_CAIXA_ID = 'cmq2objjg0005y2fald7auroi'
const SICREDI_TX_ID = 'cmq6ytnwp00akmk4dg2081x7o' // DEBIT -3.000 09/06

const AMOUNT = 3000.0
const DATE = new Date('2026-06-09T00:00:00.000Z')

const SICREDI_BEFORE = -74516.31
const BANCO_CAIXA_BEFORE = 4680.68
const BANCO_CAIXA_AFTER = 7680.68 // +3.000 da nova entrada
const TOL = 0.01

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== Pareando R$ 3.000 Sicredi → banco caixa ===\n')

  // 1. Pré-validações
  const [sicrediTx, sicrediBefore, bancoCaixaBefore] = await Promise.all([
    prisma.transaction.findUniqueOrThrow({
      where: { id: SICREDI_TX_ID },
      include: { bankAccount: { select: { name: true, companyId: true } } },
    }),
    prisma.bankAccount.findUniqueOrThrow({
      where: { id: SICREDI_ID },
      select: { balance: true, name: true },
    }),
    prisma.bankAccount.findUniqueOrThrow({
      where: { id: BANCO_CAIXA_ID },
      select: { balance: true, name: true, companyId: true, accountType: true },
    }),
  ])

  if (!sicrediTx.bankAccount) throw new Error('Sicredi tx sem bankAccount. Aborta.')

  console.log('[validações pré]')
  console.log(`  Sicredi tx: ${sicrediTx.type} R$ ${fmt(sicrediTx.amount)} em ${sicrediTx.date.toISOString().slice(0, 10)} (grupo: ${sicrediTx.transferGroupId ?? 'NULL'})`)
  console.log(`  banco caixa: companyId=${bancoCaixaBefore.companyId} accountType=${bancoCaixaBefore.accountType}`)
  console.log(`  Sicredi balance: ${fmt(sicrediBefore.balance)}`)
  console.log(`  banco caixa balance: ${fmt(bancoCaixaBefore.balance)}`)

  if (bancoCaixaBefore.companyId !== COMPANY_ID || sicrediTx.bankAccount.companyId !== COMPANY_ID) {
    throw new Error('Multi-tenant violation. Aborta.')
  }
  if (sicrediTx.transferGroupId) throw new Error('Sicredi tx já pareada. Aborta.')
  if (sicrediTx.type !== 'DEBIT') throw new Error(`Sicredi tx tipo errado: ${sicrediTx.type}. Aborta.`)
  if (Math.abs(sicrediTx.amount - AMOUNT) > 0.015) throw new Error(`Valor errado. Aborta.`)

  if (!close(sicrediBefore.balance, SICREDI_BEFORE)) {
    throw new Error(`Sicredi balance mudou desde rel. (${fmt(sicrediBefore.balance)}). Aborta.`)
  }
  if (!close(bancoCaixaBefore.balance, BANCO_CAIXA_BEFORE)) {
    throw new Error(`banco caixa balance mudou (${fmt(bancoCaixaBefore.balance)}). Aborta.`)
  }

  // E1 anti-duplicação
  const dup = await findDuplicateTransferGroup({
    fromAccountId: SICREDI_ID,
    toAccountId: BANCO_CAIXA_ID,
    amount: AMOUNT,
    date: DATE,
  })
  if (dup) {
    throw new Error(`E1: grupo ${dup.groupId.slice(0, 8)} já cobre essa transferência. Aborta.`)
  }
  console.log(`  ✓ E1 OK — nenhum grupo duplicado`)

  // 2. Atomic
  const groupId = randomUUID()
  console.log(`\n[executando atomic...] groupId=${groupId.slice(0, 8)}`)

  const result = await prisma.$transaction(async (tx) => {
    // (a) Cria a tx CREDIT no banco caixa (origin MANUAL, type=TRANSFER já no insert)
    const created = await tx.transaction.create({
      data: {
        bankAccountId: BANCO_CAIXA_ID,
        date: DATE,
        amount: AMOUNT,
        type: 'TRANSFER',
        status: 'RECONCILED',
        origin: 'MANUAL',
        description: 'Transferência recebida do Sicredi — R$ 3.000 (par criado manualmente)',
        transferGroupId: groupId,
        lifecycle: 'EFFECTED',
      },
    })

    // (b) Increment balance do banco caixa em +3.000 (entrada real)
    const bancoCaixaAfter = await tx.bankAccount.update({
      where: { id: BANCO_CAIXA_ID },
      data: { balance: { increment: AMOUNT } },
      select: { balance: true },
    })

    // (c) Update Sicredi tx pra type=TRANSFER + transferGroupId
    // (sem mudar amount nem balance — já contabilizado)
    await tx.transaction.update({
      where: { id: SICREDI_TX_ID },
      data: {
        type: 'TRANSFER',
        transferGroupId: groupId,
        categoryId: null,
      },
    })

    // Sicredi balance NÃO mexe — DEBIT já tinha contribuído -3.000
    const sicrediAfter = await tx.bankAccount.findUniqueOrThrow({
      where: { id: SICREDI_ID },
      select: { balance: true },
    })

    if (!close(bancoCaixaAfter.balance, BANCO_CAIXA_AFTER)) {
      throw new Error(
        `banco caixa pós ${fmt(bancoCaixaAfter.balance)} ≠ esperado ${fmt(BANCO_CAIXA_AFTER)}. Rollback.`,
      )
    }
    if (!close(sicrediAfter.balance, SICREDI_BEFORE)) {
      throw new Error(
        `Sicredi pós ${fmt(sicrediAfter.balance)} ≠ inalterado ${fmt(SICREDI_BEFORE)}. Rollback.`,
      )
    }

    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (parear manual 3.000 + create entrada)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'CREATE',
        entityType: 'Transfer',
        entityId: groupId,
        metadata: JSON.stringify({
          mode: 'CREATE_PAIR_WITH_NEW_ENTRY',
          context: 'Sic→Caixa R$ 3.000 — saída Sicredi 09/jun (OFX) + entrada banco caixa criada manualmente (lado não importado)',
          fromTxId: SICREDI_TX_ID,
          fromAccount: 'sicredi ',
          fromAccountId: SICREDI_ID,
          createdTxId: created.id,
          toAccount: 'banco caixa',
          toAccountId: BANCO_CAIXA_ID,
          amount: AMOUNT,
          balancesBefore: {
            sicredi: sicrediBefore.balance,
            bancoCaixa: bancoCaixaBefore.balance,
          },
          balancesAfter: {
            sicredi: sicrediAfter.balance,
            bancoCaixa: bancoCaixaAfter.balance,
          },
          impact: 'banco caixa +R$ 3.000 (entrada real do dinheiro). Sicredi inalterado (DEBIT já contabilizado).',
        }),
      },
    })

    return {
      groupId,
      createdId: created.id,
      bancoCaixaAfter: bancoCaixaAfter.balance,
      sicrediAfter: sicrediAfter.balance,
    }
  })

  console.log(`  ✓ Criou tx ${result.createdId.slice(0, 12)}… no banco caixa`)
  console.log(`  ✓ Sicredi tx atualizada pra TRANSFER + groupId`)
  console.log(`  ✓ banco caixa balance: ${fmt(bancoCaixaBefore.balance)} → ${fmt(result.bancoCaixaAfter)} (+3.000)`)
  console.log(`  ✓ Sicredi balance:     ${fmt(sicrediBefore.balance)} → ${fmt(result.sicrediAfter)} (inalterado)`)

  await prisma.$disconnect()
  console.log(`\n=== PAREAMENTO CONCLUÍDO ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
