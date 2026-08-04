// Parear manualmente R$ 20.300 (08+06 jun, feriado) Banrisul → Stone
// Lógica replica /api/empresas/[id]/transferencias/sugestoes/confirmar
// com E1 anti-duplicação ativo.

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { findDuplicateTransferGroup } from '../lib/transfers/check-duplicate-group'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const FROM_TX_ID = 'cmq5i1tkr0069uwdilr5uc8qs' // Banrisul DEBIT 20.300 08/06
const TO_TX_ID = 'cmq8rhp4g003thzknzwb4dh2l' // Stone CREDIT 20.300 06/06

const BANRISUL_BEFORE = -8507.92
const STONE_BEFORE = 25458.66
const TOL = 0.01

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== Pareando R$ 20.300 Banrisul → Stone ===\n')

  // 1. Fetch das 2 tx + validações
  const [fromTx, toTx, bBefore, sBefore] = await Promise.all([
    prisma.transaction.findUniqueOrThrow({
      where: { id: FROM_TX_ID },
      include: { bankAccount: { select: { name: true, companyId: true } } },
    }),
    prisma.transaction.findUniqueOrThrow({
      where: { id: TO_TX_ID },
      include: { bankAccount: { select: { name: true, companyId: true } } },
    }),
    prisma.bankAccount.findFirstOrThrow({
      where: { companyId: COMPANY_ID, name: 'banrisul' },
      select: { id: true, balance: true },
    }),
    prisma.bankAccount.findFirstOrThrow({
      where: { companyId: COMPANY_ID, name: 'stone' },
      select: { id: true, balance: true },
    }),
  ])

  if (!fromTx.bankAccount || !toTx.bankAccount) {
    throw new Error('Tx sem bankAccount. Aborta.')
  }
  console.log('[validações pré]')
  console.log(`  fromTx: ${fromTx.bankAccount.name} ${fromTx.type} R$ ${fmt(fromTx.amount)} em ${fromTx.date.toISOString().slice(0, 10)}`)
  console.log(`  toTx:   ${toTx.bankAccount.name} ${toTx.type} R$ ${fmt(toTx.amount)} em ${toTx.date.toISOString().slice(0, 10)}`)

  // Validações
  if (fromTx.bankAccount.companyId !== COMPANY_ID || toTx.bankAccount.companyId !== COMPANY_ID) {
    throw new Error('Tx de outra empresa. Aborta.')
  }
  if (fromTx.transferGroupId || toTx.transferGroupId) {
    throw new Error('Uma das tx já está pareada. Aborta.')
  }
  if (fromTx.type !== 'DEBIT' || toTx.type !== 'CREDIT') {
    throw new Error(`Tipos errados: from=${fromTx.type} to=${toTx.type}. Aborta.`)
  }
  if (Math.abs(fromTx.amount - toTx.amount) > 0.015) {
    throw new Error(`Valores diferentes: ${fromTx.amount} vs ${toTx.amount}. Aborta.`)
  }
  if (fromTx.bankAccountId === toTx.bankAccountId) {
    throw new Error('Mesma conta. Aborta.')
  }

  if (!close(bBefore.balance, BANRISUL_BEFORE)) {
    throw new Error(`Banrisul mudou desde Sprint A (${fmt(bBefore.balance)}). Aborta.`)
  }
  if (!close(sBefore.balance, STONE_BEFORE)) {
    throw new Error(`Stone mudou desde Sprint A (${fmt(sBefore.balance)}). Aborta.`)
  }
  console.log(`  ✓ Banrisul: ${fmt(bBefore.balance)}, Stone: ${fmt(sBefore.balance)}`)

  // E1 anti-duplicação: já existe grupo banrisul↔stone R$ 20.300 ±1d?
  // Importante: pra essa transferência a janela ±1d na verdade não acharia
  // grupo pq lados estão em 08/06 e 06/06 (Δ=2d), mas testamos rigoroso.
  const dup = await findDuplicateTransferGroup({
    fromAccountId: fromTx.bankAccountId!,
    toAccountId: toTx.bankAccountId!,
    amount: fromTx.amount,
    date: fromTx.date,
  })
  if (dup) {
    throw new Error(
      `Já existe grupo ${dup.groupId.slice(0, 8)} cobrindo essa transferência. Aborta.`,
    )
  }
  console.log(`  ✓ E1 OK — nenhum grupo duplicado existe`)

  // 2. Atomic: gera groupId, atualiza as 2 tx pra TRANSFER + transferGroupId
  const groupId = randomUUID()
  console.log(`\n[executando atomic...] groupId=${groupId.slice(0, 8)}`)

  const result = await prisma.$transaction(async (tx) => {
    const fromUpdated = await tx.transaction.update({
      where: { id: FROM_TX_ID },
      data: {
        type: 'TRANSFER',
        transferGroupId: groupId,
        categoryId: null,
      },
    })
    const toUpdated = await tx.transaction.update({
      where: { id: TO_TX_ID },
      data: {
        type: 'TRANSFER',
        transferGroupId: groupId,
        categoryId: null,
      },
    })

    // Verifica saldos NÃO mudaram (mudar type não muda balance cacheado)
    const [bAfterTx, sAfterTx] = await Promise.all([
      tx.bankAccount.findUniqueOrThrow({
        where: { id: bBefore.id },
        select: { balance: true },
      }),
      tx.bankAccount.findUniqueOrThrow({
        where: { id: sBefore.id },
        select: { balance: true },
      }),
    ])
    if (!close(bAfterTx.balance, BANRISUL_BEFORE)) {
      throw new Error(`Banrisul balance mudou inesperadamente (${fmt(bAfterTx.balance)}). Rollback.`)
    }
    if (!close(sAfterTx.balance, STONE_BEFORE)) {
      throw new Error(`Stone balance mudou inesperadamente (${fmt(sAfterTx.balance)}). Rollback.`)
    }

    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (parear manual 20.300)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'CREATE',
        entityType: 'Transfer',
        entityId: groupId,
        metadata: JSON.stringify({
          mode: 'RETROACTIVE_CONFIRM',
          context: 'B→S R$ 20.300 — saída Banrisul 08/jun (feriado processou tarde) + entrada Stone 06/jun',
          fromTxId: FROM_TX_ID,
          fromAccount: 'banrisul',
          fromTxOriginalType: 'DEBIT',
          toTxId: TO_TX_ID,
          toAccount: 'stone',
          toTxOriginalType: 'CREDIT',
          amount: fromTx.amount,
          fromDate: fromTx.date.toISOString(),
          toDate: toTx.date.toISOString(),
          deltaDays: 2,
          balancesBefore: { banrisul: bBefore.balance, stone: sBefore.balance },
          balancesAfter: { banrisul: bAfterTx.balance, stone: sAfterTx.balance },
        }),
      },
    })

    return {
      fromAfter: fromUpdated,
      toAfter: toUpdated,
      bAfter: bAfterTx.balance,
      sAfter: sAfterTx.balance,
    }
  })

  console.log(`  ✓ Banrisul DEBIT → TRANSFER, groupId set`)
  console.log(`  ✓ Stone CREDIT → TRANSFER, groupId set`)
  console.log(`  ✓ Banrisul balance: ${fmt(result.bAfter)} (idêntico)`)
  console.log(`  ✓ Stone balance:    ${fmt(result.sAfter)} (idêntico)`)
  console.log(`\n=== PAREAMENTO CONCLUÍDO ===`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
