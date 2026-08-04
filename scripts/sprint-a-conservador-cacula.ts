// Sprint A Conservador (11/06/2026) — Limpeza 36 tx 100% certas Cacula Mix
//   17 cópias Banrisul (5 órfãs B→S + 12 OFX×OFX do reimport noturno)
//   6 cópias Stone OFX órfãs duplicando MANUAL pareadas
//   13 Stone Excel matches CLAROS (mesmo fornecedor+valor+data que OFX)
//
// NÃO ajusta saldo inicial nesta sprint — só limpeza.
// Backup: /var/backups/conta-ia/pre-sprint-A-conservador-20260610_223830.dump

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL_ID = 'cmq17z90v00qxrndl02kfn4iz'
const STONE_ID = 'cmq182qfr0005aktn6q2ugpv2'

const BANRISUL_17 = [
  // 5 órfãs DEBIT duplicando grupos MANUAL pareados
  'cmq8rg6vk0008hzkn0rwb3ius', // DEBIT 21.000 01/06 → 53ccf680
  'cmq8rg6vk0009hzknjamcvuil', // DEBIT  9.100 03/06 → ee09ce0b
  'cmq8rg6vk000hhzkn80h2lfz4', // DEBIT 34.000 08/06 → 7de154c4
  'cmq8rg6vl000nhzkn2ygafxl8', // DEBIT  1.100 09/06 → be748f09
  'cmq8rg6vl000ohzkn65w7ovrd', // DEBIT  7.400 10/06 → 1ec907e5
  // 12 cópias OFX×OFX (do Extrato_banrisul20260610.ofx reimport noturno)
  'cmq8rg6vk000ahzkndo9546r3', // CREDIT 28.684 08/06
  'cmq8rg6vk000ihzkn3benfi6o', // DEBIT  20.300 08/06
  'cmq8rg6vk000bhzknq2bj0fex', // CREDIT 17.610 08/06
  'cmq8rg6vk000ghzknx4h5g2ms', // CREDIT 2.328,77 08/06
  'cmq8rg6vk000fhzknaz1s46ji', // CREDIT 1.630,32 08/06
  'cmq8rg6vk000dhzkn20frxc6t', // CREDIT 1.503,47 08/06
  'cmq8rg6vk000chzknwmm8wdgp', // CREDIT 467,25 08/06
  'cmq8rg6vk000ehzknu57fz0wt', // CREDIT 71,16 08/06
  'cmq8rg6vk000jhzkn62cwij8i', // CREDIT 4.960,70 09/06
  'cmq8rg6vk000mhzknf8xeybyw', // CREDIT 126,24 09/06
  'cmq8rg6vk000lhzknvcdewteg', // CREDIT 76,61 09/06
  'cmq8rg6vk000khzkn45cgnfbp', // CREDIT 74,04 09/06
]

const STONE_6_OFX_ORFAS = [
  'cmq8rhp4d001shzknj4kqtc57', // CREDIT 34.000 → 7de154c4
  'cmq8rhp4d001rhzknqgvamtsl', // CREDIT  8.000 → 95fafbc5
  'cmq8g32xw00cfuuadpfidogye', // CREDIT  1.100 → be748f09
  'cmq8rhp4d001qhzknw4skf64w', // CREDIT    650 → cd70a595
  'cmq8rhp4d001phzkn2a6m297l', // CREDIT  2.500 → e8ea122e
  'cmq8rhp4d001ohzkn97pp9nr2', // CREDIT  1.320 → d4a945c0
]

const STONE_13_EXCEL = [
  'cmq8g05jr00b3uuadgu86oc7u', // 6.129,87 FRIGORIFICO SILVA
  'cmq8g05jn00b1uuadqy0nictb', // 4.691,85 DOCEOLI
  'cmq1ebq1h00rapm34qb0ivk8u', // 4.094,76 DALMOLIN
  'cmq45uim100chy2fatkpypzv5', // 3.774,98 BOX PAPER
  'cmq5hx6m5002huwdiq8r1anx6', // 2.293,60 COMERCIAL CENTERMIX
  'cmq8g05kh00bluuadyi3dxdaq', // 1.553,19 VUCA SOLUTION
  'cmq5hx6lr0025uwdilvah7zw6', // 1.318,95 SPAL
  'cmq5hx6m3002fuwdifefxr5dz', // 1.310,95 BAMBERG
  'cmq5hx6m8002luwdi29xoecaq', //   905,04 ATACADAO
  'cmq5hx6mb002nuwdi7xhyrxnu', //   640,34 MENON
  'cmq5hx6mz0037uwdiyirxte5v', //   310,00 ISABEL ALMEIDA
  'cmq716ong00humk4dw3svpo2j', //   173,35 SECRETARIA DA FAZENDA
  'cmq8g05ks00btuuadb4acj8ky', //   159,90 ROGERIO MOTTA
]

const ALL = [...BANRISUL_17, ...STONE_6_OFX_ORFAS, ...STONE_13_EXCEL]

// Contribuições (revert)
const BANRISUL_ADJUST = 35367.44 // 17 cópias somam -35.367,44 contribuição → revert +
const STONE_6_ADJUST = -47570.0 // 6 CREDIT órfãs somam +47.570 → revert -
const STONE_13_ADJUST = 27356.78 // 13 DEBIT excel somam -27.356,78 → revert +
const STONE_TOTAL_ADJUST = STONE_6_ADJUST + STONE_13_ADJUST // = -20.213,22

// Sanity (pré + pós)
const BANRISUL_BEFORE = -43875.36
const STONE_BEFORE = 45671.88
const BANRISUL_AFTER = -8507.92
const STONE_AFTER = 25458.66
const TOL = 0.01

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== Sprint A Conservador — INICIANDO ===\n')

  const [bBefore, sBefore, sicrediBefore] = await Promise.all([
    prisma.bankAccount.findUniqueOrThrow({
      where: { id: BANRISUL_ID },
      select: { balance: true, name: true },
    }),
    prisma.bankAccount.findUniqueOrThrow({
      where: { id: STONE_ID },
      select: { balance: true, name: true },
    }),
    prisma.bankAccount.findFirstOrThrow({
      where: { companyId: COMPANY_ID, name: 'sicredi ' },
      select: { balance: true, name: true },
    }),
  ])

  console.log('[snapshot pré]')
  console.log(`  Banrisul: ${fmt(bBefore.balance)} (esperado ${fmt(BANRISUL_BEFORE)})`)
  console.log(`  Stone:    ${fmt(sBefore.balance)} (esperado ${fmt(STONE_BEFORE)})`)
  console.log(`  Sicredi:  ${fmt(sicrediBefore.balance)} (intacto)`)

  if (!close(bBefore.balance, BANRISUL_BEFORE)) {
    throw new Error(`Banrisul mudou desde relatório (${fmt(bBefore.balance)}). Aborta.`)
  }
  if (!close(sBefore.balance, STONE_BEFORE)) {
    throw new Error(`Stone mudou desde relatório (${fmt(sBefore.balance)}). Aborta.`)
  }

  const found = await prisma.transaction.count({ where: { id: { in: ALL } } })
  if (found !== 36) {
    throw new Error(`Esperava 36 tx, achei ${found}. Aborta.`)
  }
  console.log(`  ✓ 36 tx encontradas no banco\n`)

  console.log('[executando transação atomic...]')
  const result = await prisma.$transaction(async (tx) => {
    const del = await tx.transaction.deleteMany({ where: { id: { in: ALL } } })
    if (del.count !== 36) {
      throw new Error(`DELETE retornou ${del.count}, esperava 36. Rollback.`)
    }

    const bAfter = await tx.bankAccount.update({
      where: { id: BANRISUL_ID },
      data: { balance: { increment: BANRISUL_ADJUST } },
      select: { balance: true },
    })
    const sAfter = await tx.bankAccount.update({
      where: { id: STONE_ID },
      data: { balance: { increment: STONE_TOTAL_ADJUST } },
      select: { balance: true },
    })

    if (!close(bAfter.balance, BANRISUL_AFTER)) {
      throw new Error(
        `Banrisul pós ${fmt(bAfter.balance)} ≠ esperado ${fmt(BANRISUL_AFTER)}. Rollback.`,
      )
    }
    if (!close(sAfter.balance, STONE_AFTER)) {
      throw new Error(
        `Stone pós ${fmt(sAfter.balance)} ≠ esperado ${fmt(STONE_AFTER)}. Rollback.`,
      )
    }

    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (Sprint A conservador CLI)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'BULK_DELETE',
        entityType: 'TransactionDuplicate',
        entityId: 'sprint-A-conservador-20260610',
        metadata: JSON.stringify({
          sprint: 'Sprint A Conservador — 36 cópias 100% certas',
          deletedCount: 36,
          deletedIds: ALL,
          banrisul_17_copias: BANRISUL_17,
          stone_6_OFX_orfas: STONE_6_OFX_ORFAS,
          stone_13_excel_claros: STONE_13_EXCEL,
          banrisulAdjust: BANRISUL_ADJUST,
          stoneAdjust: STONE_TOTAL_ADJUST,
          balancesBefore: { banrisul: bBefore.balance, stone: sBefore.balance },
          balancesAfter: { banrisul: bAfter.balance, stone: sAfter.balance },
          ajusteSaldoInicial:
            'NÃO aplicado nesta sprint (Sprint B futuro)',
          pendentesManuais:
            'Lista B (41 tx) + 6 prováveis + 8 duvidosos + gap Banrisul 1.208 + 20.300 + 3.000 caixa + Daniela bridge + Sicredi pré-junho',
          backupPath:
            '/var/backups/conta-ia/pre-sprint-A-conservador-20260610_223830.dump',
        }),
      },
    })

    return {
      deleted: del.count,
      banrisulAfter: bAfter.balance,
      stoneAfter: sAfter.balance,
    }
  })

  console.log(`  ✓ Atomic OK — ${result.deleted} tx deletadas`)
  console.log(`  ✓ Banrisul pós: ${fmt(result.banrisulAfter)}`)
  console.log(`  ✓ Stone pós:    ${fmt(result.stoneAfter)}\n`)

  // Verificação pós
  const grupos = await prisma.transaction.groupBy({
    by: ['transferGroupId'],
    where: {
      bankAccount: { companyId: COMPANY_ID },
      transferGroupId: { not: null },
    },
  })
  const sicrediAfter = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'sicredi ' },
    select: { balance: true },
  })

  console.log('[verificação pós]')
  console.log(`  Grupos transferência intactos: ${grupos.length}`)
  console.log(`  Sicredi intacto: ${fmt(sicrediAfter.balance)}`)
  console.log(`  IDs deletados confirmados (count=0):`)
  const stillExists = await prisma.transaction.count({ where: { id: { in: ALL } } })
  console.log(`    ainda existem: ${stillExists} (esperado 0)`)

  await prisma.$disconnect()
  console.log('\n=== SPRINT A CONCLUÍDO ===')
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
