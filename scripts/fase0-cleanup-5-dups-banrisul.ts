// Fase 0 — Cleanup 5 dups Banrisul (10/06 reimportadas em 11/06)
//
// Deleta 5 CRÉDITOS criados em 11/06 19:35:09 que duplicam originais
// criados em 10/06 19:14:18. Mantém Capitalização RG (2 títulos legítimos).
//
// Backup: /var/backups/conta-ia/pre-cleanup-5-dups-banrisul-20260612_230528.dump

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL_ID_NAME = 'banrisul'
const USER_ID = 'cmp9e4kgz00007wajsn05e9mg'

// 5 a deletar (criadas 11/06 19:35:09)
const TX_TO_DELETE = [
  { id: 'cmq9wd6ll00dhsjvik46cf6tk', amount: 351.14, fitid: '136709', desc: 'DEBITO STONE' },
  { id: 'cmq9wd6ll00desjvi9lqg6qkh', amount: 326.93, fitid: '210179', desc: 'ANTECIP STONE' },
  { id: 'cmq9wd6ll00dgsjvifar1rkk7', amount: 128.97, fitid: '020966', desc: 'BANRI A VISTA' },
  { id: 'cmq9wd6ll00ddsjvik6peks83', amount: 72.95, fitid: '067267', desc: 'BANRICOMPRAS' },
  { id: 'cmq9wd6ll00dfsjviz55kpyjb', amount: 54.45, fitid: '073896', desc: 'BANRICARD' },
]
const TOTAL_AMOUNT = TX_TO_DELETE.reduce((s, t) => s + t.amount, 0)

// 5 originais que ficam (criadas 10/06 19:14:18)
const TX_ORIGINAL_IDS = [
  'cmq8g6ipx00cluuad83g3gf1n',
  'cmq8g6ipx00ckuuadbef7m3s1',
  'cmq8g6ipx00couuadhmw08l3e',
  'cmq8g6ipx00cnuuad6g0sfq9h',
  'cmq8g6ipx00cmuuadj2024744',
]

// 4 Capitalização RG (intactas, 2 títulos legítimos)
const TX_CAPITALIZACAO_IDS = [
  'cmq1dyhfa00flpm34zu0fsqom', 'cmq1dyhfb00fmpm34ipk8mgku',
  'cmq5i1tkr006cuwdiirobqh14', 'cmq5i1tkr006duwdip7lr2pul',
]

const BANRISUL_BEFORE = -6882.27
const BANRISUL_AFTER = -7816.71 // -6882.27 - 934.44 (revert CRED)
const STONE_BEFORE = 29211.21
const SICREDI_BEFORE = -73298.76
const TOL = 0.01

function fmt(n: number) { return n.toFixed(2) }
function close(a: number, b: number) { return Math.abs(a - b) <= TOL }

async function main() {
  console.log('=== Fase 0: cleanup 5 dups Banrisul (10/06 reimportadas em 11/06) ===\n')

  // 1. Snapshot pré
  const banrisul = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: BANRISUL_ID_NAME },
    select: { id: true, balance: true },
  })
  const stone = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'stone' },
    select: { balance: true },
  })
  const sicredi = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'sicredi ' },
    select: { balance: true },
  })

  console.log('[snapshot pré]')
  console.log(`  banrisul: ${fmt(banrisul.balance)}`)
  console.log(`  stone:    ${fmt(stone.balance)}`)
  console.log(`  sicredi:  ${fmt(sicredi.balance)}`)
  console.log(`  Total a deletar: R$ ${fmt(TOTAL_AMOUNT)} (5 CRED → balance desce)`)

  if (!close(banrisul.balance, BANRISUL_BEFORE)) throw new Error(`banrisul mudou: ${fmt(banrisul.balance)}`)
  if (!close(stone.balance, STONE_BEFORE)) throw new Error(`stone mudou: ${fmt(stone.balance)}`)
  if (!close(sicredi.balance, SICREDI_BEFORE)) throw new Error(`sicredi mudou: ${fmt(sicredi.balance)}`)

  // 2. SANITY pré: confirma as 5 dups intactas e SOLTAS
  for (const expected of TX_TO_DELETE) {
    const tx = await prisma.transaction.findUniqueOrThrow({
      where: { id: expected.id },
      include: { reconciledFrom: { select: { id: true } } },
    })
    if (Math.abs(tx.amount - expected.amount) > 0.015)
      throw new Error(`${expected.id} amount errado: ${tx.amount}`)
    if (tx.type !== 'CREDIT') throw new Error(`${expected.id} não é CREDIT`)
    if (tx.origin !== 'OFX') throw new Error(`${expected.id} não é OFX`)
    if (tx.bankAccountId !== banrisul.id) throw new Error(`${expected.id} não está no Banrisul`)
    if (tx.reconciledWithId !== null) throw new Error(`${expected.id} tem reconciledWithId`)
    if (tx.transferGroupId !== null) throw new Error(`${expected.id} em grupo transfer`)
    if (tx.reconciledFrom.length > 0) throw new Error(`${expected.id} recebe link de outros`)
  }
  console.log(`  ✓ 5 dups confirmadas soltas (zero links cruzados)\n`)

  // 3. Atomic
  console.log('[executando atomic...]')
  const result = await prisma.$transaction(async (tx) => {
    // 3.1. Delete 5
    const del = await tx.transaction.deleteMany({
      where: { id: { in: TX_TO_DELETE.map((t) => t.id) } },
    })
    if (del.count !== TX_TO_DELETE.length)
      throw new Error(`deleteMany afetou ${del.count}/${TX_TO_DELETE.length}. Rollback.`)

    // 3.2. UPDATE balance Banrisul: -934,44 (revert CRED)
    const banrisulAfter = await tx.bankAccount.update({
      where: { id: banrisul.id },
      data: { balance: { increment: -TOTAL_AMOUNT } },
      select: { balance: true },
    })

    // 3.3. SANITY: balance Banrisul = esperado
    if (!close(banrisulAfter.balance, BANRISUL_AFTER))
      throw new Error(`banrisul pós ${fmt(banrisulAfter.balance)} != ${fmt(BANRISUL_AFTER)}. Rollback.`)

    // 3.4. SANITY: 5 originais intactas
    const originaisRestantes = await tx.transaction.count({
      where: { id: { in: TX_ORIGINAL_IDS } },
    })
    if (originaisRestantes !== TX_ORIGINAL_IDS.length)
      throw new Error(`${originaisRestantes} originais restantes (esperado ${TX_ORIGINAL_IDS.length}). Rollback.`)

    // 3.5. SANITY: 4 Capitalização RG intactas
    const capitalizacaoRestantes = await tx.transaction.count({
      where: { id: { in: TX_CAPITALIZACAO_IDS } },
    })
    if (capitalizacaoRestantes !== TX_CAPITALIZACAO_IDS.length)
      throw new Error(`Capitalização RG mexida (${capitalizacaoRestantes}/${TX_CAPITALIZACAO_IDS.length}). Rollback.`)

    // 3.6. SANITY: stone e sicredi inalterados
    const [stoneAfter, sicrediAfter] = await Promise.all([
      tx.bankAccount.findFirstOrThrow({ where: { companyId: COMPANY_ID, name: 'stone' }, select: { balance: true } }),
      tx.bankAccount.findFirstOrThrow({ where: { companyId: COMPANY_ID, name: 'sicredi ' }, select: { balance: true } }),
    ])
    if (!close(stoneAfter.balance, STONE_BEFORE)) throw new Error(`stone mexeu (${fmt(stoneAfter.balance)}). Rollback.`)
    if (!close(sicrediAfter.balance, SICREDI_BEFORE)) throw new Error(`sicredi mexeu (${fmt(sicrediAfter.balance)}). Rollback.`)

    // 3.7. Audit log — 5 entries
    for (const t of TX_TO_DELETE) {
      await tx.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          userId: USER_ID,
          userName: 'Yussef (Fase 0 cleanup dup Banrisul reimport)',
          userEmail: 'yussefmusa5522@gmail.com',
          action: 'DELETE_BANRISUL_DUP_OFX_REIMPORT',
          entityType: 'Transaction',
          entityId: t.id,
          metadata: JSON.stringify({
            context:
              'Cleanup Fase 0 (Yussef 12/06/2026): Banrisul reciclou FITIDs entre import 10/06 19:14 e re-import 11/06 19:35. Dedup hash deixou passar como nova. Esta é a CÓPIA (criada 11/06).',
            deletedTx: {
              id: t.id, amount: t.amount, fitid: t.fitid, description: t.desc,
              type: 'CREDIT', origin: 'OFX',
            },
            originalPreserved: {
              valor: t.amount,
              fitid_original: TX_ORIGINAL_IDS[TX_TO_DELETE.indexOf(t)] ? 'criada 10/06 19:14:18' : '?',
            },
            balanceImpact: -t.amount,
            backupPath: '/var/backups/conta-ia/pre-cleanup-5-dups-banrisul-20260612_230528.dump',
          }),
        },
      })
    }

    return { deleted: del.count, banrisulAfter: banrisulAfter.balance }
  })

  console.log(`  ✓ ${result.deleted} dups deletadas`)
  console.log(`  ✓ banrisul.balance: ${fmt(banrisul.balance)} → ${fmt(result.banrisulAfter)} (-934,44)`)
  console.log(`  ✓ 5 originais intactas`)
  console.log(`  ✓ 4 Capitalização RG intactas`)
  console.log(`  ✓ stone e sicredi inalterados`)

  await prisma.$disconnect()
  console.log(`\n=== FASE 0 CONCLUÍDA ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
