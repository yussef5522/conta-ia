// INVESTIGAÇÃO READ-ONLY (18/06/2026)
// Sintomas pós-limpeza:
//   - Stone preview saldo previsto 7944.28 vs LEDGERBAL banco 79.10 = -7865.18
//   - 2 tx deletadas pela limpeza reaparecem como NOVAS: YUSSEF 09/06 +650 e 08/06 +8000
// NÃO MUTA NADA.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const STONE = 'cmq182qfr0005aktn6q2ugpv2'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const BANCO_CAIXA = 'cmq2objjg0005y2fald7auroi'

const TRANSFER_EXISTENTES = [
  // ids que a limpeza identificou como "TRANSFER existente" justificando deletar os PIX YUSSEF órfãos
  'cmq8rfym80003hzknpsv5k0vr', // suposta TRANSFER R$ 650 09/06
  'cmq5i5001006puwdidvfgtlbg', // suposta TRANSFER R$ 8000 08/06
]

const PARES_DELETADOS_GROUPIDS = [
  '7de154c4-2f2e-49dc-8c19-48262b55e6ac', // R$ 34000 06/08 Banrisul↔Stone (deletado)
  'be748f09-8f75-4667-9389-476ac94c4db4', // R$ 1100 06/09 Banrisul↔Stone (deletado)
]

const PARES_LEGITIMOS_GROUPIDS = [
  '67d01c12-c48f-4fe1-b672-7aa4df93504d', // R$ 34000 06/08 — par legitimo (não deletado)
  '5287daa8-ad40-4347-9b41-f45b55254d6d', // R$ 1100 06/09 — par legitimo (não deletado)
]

const STONE_LEDGERBAL = 79.10
const PIX_650_DATE = new Date('2026-06-09')
const PIX_8000_DATE = new Date('2026-06-08')

const prisma = new PrismaClient()

function nomeConta(id: string | null): string {
  if (id === STONE) return 'STONE'
  if (id === BANRISUL) return 'BANRISUL'
  if (id === SICREDI) return 'SICREDI'
  if (id === BANCO_CAIXA) return 'BANCO_CAIXA'
  return id?.slice(0, 8) ?? 'null'
}

async function main() {
  console.log('━'.repeat(80))
  console.log('INVESTIGAÇÃO STONE — pós-limpeza (READ-ONLY)')
  console.log('━'.repeat(80))

  // ─────────────────────────────────────────────────────
  // 1) As 2 "TRANSFER existentes" que justificaram deletar os PIX YUSSEF
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 1) As 2 "TRANSFER existentes" — têm AMBOS os lados? ━━')
  for (const id of TRANSFER_EXISTENTES) {
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        bankAccountId: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        transferGroupId: true,
        transferDirection: true,
        contentHash: true,
        externalId: true,
      },
    })
    if (!tx) {
      console.log(`\n  ${id}: NÃO EXISTE no DB hoje`)
      continue
    }
    console.log(`\n  ${id}`)
    console.log(`    conta=${nomeConta(tx.bankAccountId)} type=${tx.type} amount=${tx.amount}`)
    console.log(`    date=${tx.date.toISOString().slice(0, 10)} dir=${tx.transferDirection ?? 'null'}`)
    console.log(`    desc="${tx.description.slice(0, 60)}"`)
    console.log(`    transferGroupId=${tx.transferGroupId ?? 'null'}`)
    console.log(`    contentHash=${tx.contentHash?.slice(0, 16) ?? 'null'}`)

    if (tx.transferGroupId) {
      const par = await prisma.transaction.findMany({
        where: { transferGroupId: tx.transferGroupId },
        select: {
          id: true,
          bankAccountId: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          transferDirection: true,
        },
      })
      console.log(`    par completo (${par.length} tx no groupId):`)
      for (const p of par) {
        console.log(
          `      ${p.id} conta=${nomeConta(p.bankAccountId)} ${p.type} R$ ${p.amount} ${p.date.toISOString().slice(0, 10)} dir=${p.transferDirection ?? 'null'} desc="${p.description.slice(0, 40)}"`,
        )
      }
      if (par.length === 1) {
        console.log(`    🚨 PAR INCOMPLETO: só 1 lado existe!`)
      }
    } else {
      console.log(`    ⚠ tx tipo TRANSFER mas SEM transferGroupId — par perdido`)
    }
  }

  // ─────────────────────────────────────────────────────
  // 2) Os groupIds dos 2 pares "duplicados" deletados — eles SOBRARAM com algum lado?
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 2) Pares TRANSFER duplicados deletados — restos? ━━')
  for (const gid of PARES_DELETADOS_GROUPIDS) {
    const ts = await prisma.transaction.findMany({
      where: { transferGroupId: gid },
      select: { id: true, bankAccountId: true, type: true, amount: true, date: true },
    })
    console.log(`\n  groupId=${gid.slice(0, 8)} — tx restantes: ${ts.length}`)
    for (const t of ts) {
      console.log(`    ${t.id} ${nomeConta(t.bankAccountId)} ${t.type} R$ ${t.amount} ${t.date.toISOString().slice(0, 10)}`)
    }
  }

  console.log('\n━━ 2b) Pares legítimos QUE FICARAM — completos? ━━')
  for (const gid of PARES_LEGITIMOS_GROUPIDS) {
    const ts = await prisma.transaction.findMany({
      where: { transferGroupId: gid },
      select: {
        id: true,
        bankAccountId: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        transferDirection: true,
      },
    })
    console.log(`\n  groupId=${gid.slice(0, 8)} — ${ts.length} tx:`)
    for (const t of ts) {
      console.log(
        `    ${t.id} ${nomeConta(t.bankAccountId)} ${t.type} R$ ${t.amount} ${t.date.toISOString().slice(0, 10)} dir=${t.transferDirection ?? 'null'} desc="${t.description.slice(0, 30)}"`,
      )
    }
  }

  // ─────────────────────────────────────────────────────
  // 3) Por que dedup marca 650/8000 como novas? contentHash count = 0
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 3) contentHash dos PIX YUSSEF — existe alguma tx Stone com mesmo hash? ━━')
  const yussefDescs = ['YUSSEF ABU ZAHRY MUSA - Transferência | Pix', 'Yussef Abu Zahry Musa - Transferência | Pix']
  for (const [valor, data] of [[650, PIX_650_DATE], [8000, PIX_8000_DATE]] as const) {
    console.log(`\n  PIX R$ ${valor} (${data.toISOString().slice(0, 10)})`)
    for (const desc of yussefDescs) {
      const ident = computeIdentity({
        accountId: STONE,
        fitid: null,
        date: data,
        amount: valor,
        type: 'CREDIT',
        memo: desc,
      })
      console.log(`    hash CREDIT "${desc.slice(0, 30)}..." -> ${ident.contentHash.slice(0, 16)}`)
      // Conta no DB
      const count = await prisma.transaction.count({
        where: {
          bankAccountId: STONE,
          contentHash: ident.contentHash,
        },
      })
      console.log(`    tx vivas com esse contentHash: ${count}`)
    }
    // Também testa com a TRANSFER (type TRANSFER signed +)
    const identT = computeIdentity({
      accountId: STONE,
      fitid: null,
      date: data,
      amount: valor,
      type: 'TRANSFER',
      memo: yussefDescs[0],
    })
    console.log(`    hash TRANSFER (mesmo desc) -> ${identT.contentHash.slice(0, 16)}`)
    const countT = await prisma.transaction.count({
      where: { bankAccountId: STONE, contentHash: identT.contentHash },
    })
    console.log(`    tx vivas com esse contentHash: ${countT}`)
  }

  // ─────────────────────────────────────────────────────
  // 4) Decompor o -7.865,18 do preview Stone
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 4) Decompor o gap do preview Stone (-7.865,18) ━━')
  console.log(`  Soma do que a limpeza DELETOU no Stone:`)
  console.log(`    PIX YUSSEF +650 (06/09): -650 (era CREDIT)`)
  console.log(`    PIX YUSSEF +8000 (06/08): -8000 (era CREDIT)`)
  console.log(`    par TRANSFER 34000 lado Stone (groupId 7de154c4): ?`)
  console.log(`    par TRANSFER 1100 lado Stone (groupId be748f09): ?`)

  // Total deletado pelo CREDIT órfão (impacto em saldo CONTÁBIL Stone)
  const impactoOrfaos = 650 + 8000 // viraram positivo Stone, agora foram embora -> saldo Stone CAIU
  console.log(`\n  Impacto dos 2 órfãos CREDIT em saldo Stone: R$ -${impactoOrfaos.toFixed(2)}`)
  // Diff esperado vs LEDGERBAL = 7944.28 - 79.10 = 7865.18
  console.log(`  Diff observado no preview: R$ -7865.18`)
  console.log(`  Diferença: R$ ${(impactoOrfaos - 7865.18).toFixed(2)} (~quase exato dos 8650 órfãos)`)

  // ─────────────────────────────────────────────────────
  // 5) Saldo TOTAL das tx Stone vivas (signed sum vs LEDGERBAL)
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 5) Soma das tx Stone vivas (todo histórico) ━━')
  const sumStone = await prisma.$queryRaw<Array<{ signed_sum: number; tx_count: bigint }>>`
    SELECT
      SUM(CASE
        WHEN type='CREDIT' THEN amount
        WHEN type='DEBIT' THEN -amount
        WHEN type='TRANSFER' THEN amount
        ELSE 0 END) AS signed_sum,
      COUNT(*) AS tx_count
    FROM transactions
    WHERE "bankAccountId" = ${STONE}
  `
  console.log(`  tx count: ${sumStone[0].tx_count}`)
  console.log(`  signed sum (CREDIT+ / DEBIT- / TRANSFER+): R$ ${Number(sumStone[0].signed_sum).toFixed(2)}`)
  console.log(`  LEDGERBAL real (Yussef): R$ ${STONE_LEDGERBAL.toFixed(2)}`)
  console.log(`  Δ: R$ ${(Number(sumStone[0].signed_sum) - STONE_LEDGERBAL).toFixed(2)}`)

  // ledgerBal cacheado + ledgerBalDate
  const stoneAcc = await prisma.bankAccount.findUnique({
    where: { id: STONE },
    select: { balance: true, ledgerBal: true, ledgerBalDate: true },
  })
  console.log(`\n  bank_accounts.balance cache: R$ ${stoneAcc?.balance.toFixed(2)}`)
  console.log(`  bank_accounts.ledgerBal: R$ ${stoneAcc?.ledgerBal?.toFixed(2) ?? 'null'}`)
  console.log(`  bank_accounts.ledgerBalDate: ${stoneAcc?.ledgerBalDate?.toISOString().slice(0, 10) ?? 'null'}`)

  // tx pós-ledgerBalDate
  if (stoneAcc?.ledgerBalDate) {
    const posLedger = await prisma.$queryRaw<Array<{ tx_count: bigint; signed: number }>>`
      SELECT COUNT(*) AS tx_count, COALESCE(SUM(CASE
        WHEN type='CREDIT' THEN amount
        WHEN type='DEBIT' THEN -amount
        WHEN type='TRANSFER' THEN amount
        ELSE 0 END), 0) AS signed
      FROM transactions
      WHERE "bankAccountId" = ${STONE}
        AND date > ${stoneAcc.ledgerBalDate}
    `
    console.log(`  tx pós-ledgerBalDate (${stoneAcc.ledgerBalDate.toISOString().slice(0, 10)}): ${posLedger[0].tx_count} tx, signed R$ ${Number(posLedger[0].signed).toFixed(2)}`)
  }

  // ─────────────────────────────────────────────────────
  // 6) Por que orfaos viraram "novas" no preview? Verificar imported_identities
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 6) imported_identities tem entry pros 650/8000? ━━')
  for (const [valor, data] of [[650, PIX_650_DATE], [8000, PIX_8000_DATE]] as const) {
    for (const desc of yussefDescs) {
      const idCredit = computeIdentity({
        accountId: STONE,
        fitid: null,
        date: data,
        amount: valor,
        type: 'CREDIT',
        memo: desc,
      })
      const idTransfer = computeIdentity({
        accountId: STONE,
        fitid: null,
        date: data,
        amount: valor,
        type: 'TRANSFER',
        memo: desc,
      })
      const llC = await prisma.importedIdentity.findMany({
        where: { bankAccountId: STONE, contentHash: idCredit.contentHash },
        select: { id: true, transactionId: true, tombstone: true },
      })
      const llT = await prisma.importedIdentity.findMany({
        where: { bankAccountId: STONE, contentHash: idTransfer.contentHash },
        select: { id: true, transactionId: true, tombstone: true },
      })
      console.log(`  R$ ${valor} desc "${desc.slice(0, 25)}..."`)
      console.log(`    ledger CREDIT hash: ${llC.length} entries (tombstone=${llC.filter(l => l.tombstone).length})`)
      console.log(`    ledger TRANSFER hash: ${llT.length} entries (tombstone=${llT.filter(l => l.tombstone).length})`)
    }
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
