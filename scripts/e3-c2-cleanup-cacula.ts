// E3+C2 — Limpeza atomic Cacula Mix (09/06/2026)
// Deleta 11 tx (8 Banrisul cópias + 1 Stone OFX órfã + 2 grupo fb603cee)
// + ajusta saldos Banrisul (+2.005,03) e Stone (-42.000)
// + audit log.
//
// Tudo dentro de prisma.$transaction. Sanity check final: se saldos não
// baterem com esperado (±0.01), THROW → rollback total. Idempotente:
// se rodado 2x, segunda execução vê 0 tx pra deletar e aborta.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── IDs aprovados pelo Yussef (relatório de pré-execução) ──
const BANRISUL_ID = 'cmq17z90v00qxrndl02kfn4iz'
const STONE_ID = 'cmq182qfr0005aktn6q2ugpv2'
const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'

const BANRISUL_COPIAS = [
  'cmq6ys59h009omk4d6chxlf8p', // CREDIT 28.684,00
  'cmq6ys59h009vmk4dgp0f6e71', // DEBIT  20.300,00
  'cmq6ys59h009pmk4dufdtayx4', // CREDIT 17.610,00
  'cmq6ys59h009umk4d65kjn6b9', // CREDIT  2.328,77
  'cmq6ys59h009tmk4dd1emvqmw', // CREDIT  1.630,32
  'cmq6ys59h009rmk4d3afnkkpw', // CREDIT  1.503,47
  'cmq6ys59h009qmk4dwrpi9dyj', // CREDIT    467,25
  'cmq6ys59h009smk4dlkl9wayp', // CREDIT     71,16
]
const STONE_OFX_ORFA = 'cmq6yl04x008wmk4d3oti2zoa' // CREDIT 8.000,00
const GROUP_FB603CEE = 'fb603cee-6e98-4031-b363-eabedd07d4c6'
const GROUP_FB603CEE_TXS = [
  'cmq6yrsku009bmk4du3n9pms6', // banrisul TRANSFER 34.000,00
  'cmq6yrsku009dmk4dwpci44c6', // stone    TRANSFER 34.000,00
]

const ALL_DELETE_IDS = [...BANRISUL_COPIAS, STONE_OFX_ORFA, ...GROUP_FB603CEE_TXS]

// Ajustes de saldo (reverter contribuição das deletadas)
const BANRISUL_ADJUST = 2005.03 // -52.294,97 (7 CREDIT) + 20.300 (1 DEBIT) + 34.000 (TRANSFER lado banrisul)
const STONE_ADJUST = -42000.0 // -8.000 (OFX órfã) - 34.000 (TRANSFER lado stone)

// Saldos esperados (snapshot do relatório pré-execução)
const BANRISUL_BEFORE_EXPECTED = -7316.39
const STONE_BEFORE_EXPECTED = 43339.1
const BANRISUL_AFTER_EXPECTED = -5311.36
const STONE_AFTER_EXPECTED = 1339.1
const TOL = 0.01

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== E3+C2 cleanup Cacula Mix — INICIANDO ===\n')

  // ── 0. Snapshot pré (fora do $transaction pra log) ──
  const banrisulBefore = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: BANRISUL_ID },
    select: { balance: true, name: true },
  })
  const stoneBefore = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: STONE_ID },
    select: { balance: true, name: true },
  })
  const txCountBefore = await prisma.transaction.count({
    where: { bankAccount: { companyId: COMPANY_ID } },
  })

  console.log('[snapshot pré]')
  console.log(`  Banrisul saldo: ${fmt(banrisulBefore.balance)} (esperado ${fmt(BANRISUL_BEFORE_EXPECTED)})`)
  console.log(`  Stone saldo:    ${fmt(stoneBefore.balance)} (esperado ${fmt(STONE_BEFORE_EXPECTED)})`)
  console.log(`  Tx total Cacula: ${txCountBefore}`)

  // Sanity check do estado inicial — se já mudou desde o relatório, aborta
  if (!close(banrisulBefore.balance, BANRISUL_BEFORE_EXPECTED)) {
    throw new Error(
      `Saldo Banrisul mudou desde relatório (${fmt(banrisulBefore.balance)} vs ${fmt(BANRISUL_BEFORE_EXPECTED)}). Aborta.`,
    )
  }
  if (!close(stoneBefore.balance, STONE_BEFORE_EXPECTED)) {
    throw new Error(
      `Saldo Stone mudou desde relatório (${fmt(stoneBefore.balance)} vs ${fmt(STONE_BEFORE_EXPECTED)}). Aborta.`,
    )
  }

  // Existência das 11 tx
  const found = await prisma.transaction.findMany({
    where: { id: { in: ALL_DELETE_IDS } },
    select: { id: true, amount: true, type: true, bankAccountId: true },
  })
  if (found.length !== 11) {
    throw new Error(
      `Esperava 11 tx pra deletar, achei ${found.length}. Pode ser que alguém já tenha apagado. Aborta.`,
    )
  }
  console.log(`  ✓ 11 tx encontradas no banco\n`)

  // ── 1. Transação atomic ──
  console.log('[executando transação atomic...]')
  const result = await prisma.$transaction(async (tx) => {
    // Delete 11 tx
    const del = await tx.transaction.deleteMany({
      where: { id: { in: ALL_DELETE_IDS } },
    })
    if (del.count !== 11) {
      throw new Error(`DELETE retornou ${del.count} rows, esperava 11. Rollback.`)
    }

    // Ajusta saldos
    const banrisulAfter = await tx.bankAccount.update({
      where: { id: BANRISUL_ID },
      data: { balance: { increment: BANRISUL_ADJUST } },
      select: { balance: true },
    })
    const stoneAfter = await tx.bankAccount.update({
      where: { id: STONE_ID },
      data: { balance: { increment: STONE_ADJUST } },
      select: { balance: true },
    })

    // Sanity check FINAL — se não bater, lança e rollback total
    if (!close(banrisulAfter.balance, BANRISUL_AFTER_EXPECTED)) {
      throw new Error(
        `Saldo Banrisul pós ${fmt(banrisulAfter.balance)} ≠ esperado ${fmt(BANRISUL_AFTER_EXPECTED)}. Rollback.`,
      )
    }
    if (!close(stoneAfter.balance, STONE_AFTER_EXPECTED)) {
      throw new Error(
        `Saldo Stone pós ${fmt(stoneAfter.balance)} ≠ esperado ${fmt(STONE_AFTER_EXPECTED)}. Rollback.`,
      )
    }

    // Audit log (userId real do Yussef — FK requer entry válida)
    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (E3+C2 cleanup CLI)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'BULK_DELETE',
        entityType: 'TransactionDuplicate',
        entityId: 'e3-c2-cleanup-20260609',
        metadata: JSON.stringify({
          sprint: 'E3+C2 — limpeza duplicação Cacula',
          deletedCount: 11,
          deletedIds: ALL_DELETE_IDS,
          banrisulCopias: BANRISUL_COPIAS,
          stoneOfxOrfa: STONE_OFX_ORFA,
          grupoDuplicado: GROUP_FB603CEE,
          banrisulAdjust: BANRISUL_ADJUST,
          stoneAdjust: STONE_ADJUST,
          banrisulBalanceBefore: banrisulBefore.balance,
          stoneBalanceBefore: stoneBefore.balance,
          banrisulBalanceAfter: banrisulAfter.balance,
          stoneBalanceAfter: stoneAfter.balance,
          backupPath:
            '/var/backups/conta-ia/pre-e3-c2-cleanup-20260609_190127.dump',
        }),
      },
    })

    return {
      deleted: del.count,
      banrisulAfter: banrisulAfter.balance,
      stoneAfter: stoneAfter.balance,
    }
  })

  console.log(`  ✓ Atomic OK — ${result.deleted} tx deletadas`)
  console.log(`  ✓ Banrisul pós: ${fmt(result.banrisulAfter)}`)
  console.log(`  ✓ Stone pós: ${fmt(result.stoneAfter)}\n`)

  // ── 2. Verificação pós (fora do $transaction) ──
  const txCountAfter = await prisma.transaction.count({
    where: { bankAccount: { companyId: COMPANY_ID } },
  })
  const grupoCheck = await prisma.transaction.findFirst({
    where: { transferGroupId: GROUP_FB603CEE },
  })
  const grupoOriginalCheck = await prisma.transaction.count({
    where: { transferGroupId: '7de154c4-2f2e-49dc-8c19-48262b55e6ac' },
  })
  const grupos = await prisma.transaction.groupBy({
    by: ['transferGroupId'],
    where: {
      bankAccount: { companyId: COMPANY_ID },
      transferGroupId: { not: null },
    },
  })

  console.log('[verificação pós]')
  console.log(`  Tx total Cacula: ${txCountBefore} → ${txCountAfter} (Δ ${txCountAfter - txCountBefore})`)
  console.log(`  Grupos transferência: ${grupos.length}`)
  console.log(`  Grupo fb603cee (deletado): ${grupoCheck ? '❌ AINDA EXISTE' : '✓ removido'}`)
  console.log(`  Grupo 7de154c4 (original, fica): ${grupoOriginalCheck} lados`)

  await prisma.$disconnect()
  console.log('\n=== CLEANUP CONCLUÍDO ===')
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
