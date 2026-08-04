// Etapa B — Corrige competenceDate de 11 Excel Stone Cacula
// que tinham comp=mai/abr mas paymentDate=08/jun (planilha errada).
//
// Backup: /var/backups/conta-ia/pre-etapa-b-competenceDate-fix-20260611_214900.dump
//
// Decisão Yussef: Opção A — competenceDate = paymentDate (08/jun em todas).
// Limpeza histórica pura. NÃO muda saldo nem DRE caixa.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'

const TX_IDS = [
  'cmq45ayq5005my2fai7t7sh63', // LATICINIOS 4269.27 (comp 30/abr → 08/jun)
  'cmq5hx6md002puwdijbwfvone', // TURATTI 979.37 (comp 04/mai → 08/jun)
  'cmq45bc610079y2fa7k7iynnz', // CASPER 1852.09 (13/mai → 08/jun)
  'cmq45uimw00dfy2fa6ba1xapd', // PARKER 1257.62 (14/mai → 08/jun)
  'cmq45uimu00ddy2fahj2iifzh', // LATICINIOS 5312.80 (15/mai → 08/jun)
  'cmq45bbj80074y2fa2zrvdox0', // CASPER 1934.24 (20/mai → 08/jun)
  'cmq45uims00dby2fa4apkcjz5', // PARKER 667.35 (21/mai → 08/jun)
  'cmq45uimq00d9y2facb5hlxer', // DISTRIBUIDORA 1198.40 (26/mai → 08/jun)
  'cmq45baqi006zy2fab2oi0rvj', // CASPER 3393.18 (27/mai → 08/jun)
  'cmq45uimo00d7y2fazuqxsr0l', // SPAL 3445.95 (29/mai → 08/jun)
  'cmq45uily00cdy2fauamgfrht', // CARLOS CANCIAN 452.56 (29/mai → 08/jun)
]

const NEW_COMPETENCE = new Date('2026-06-08T00:00:00.000Z')
const TOL = 0.01

// Snapshots esperados pré-execução (não podem mudar pós)
const BANRISUL_BEFORE = -6882.27
const STONE_BEFORE = 29211.21
const SICREDI_BEFORE = -73298.76
const DRE_SIGNED_BEFORE = 54771.83
const DRE_QTD_BEFORE = 959

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function getBalances() {
  const banrisul = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'banrisul' },
    select: { id: true, balance: true },
  })
  const stone = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'stone' },
    select: { id: true, balance: true },
  })
  const sicredi = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'sicredi ' },
    select: { id: true, balance: true },
  })
  return { banrisul, stone, sicredi }
}

/** DRE caixa Cacula jun signed + qtd — replica filtro NOVO de dre/route.ts */
async function getDreCaixaJun() {
  const result = await prisma.$queryRaw<Array<{ qtd: bigint; signed: number }>>`
    SELECT COUNT(*) AS qtd,
      SUM(CASE WHEN t.type='CREDIT' THEN t.amount WHEN t.type='DEBIT' THEN -t.amount ELSE 0 END) AS signed
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${COMPANY_ID}
      AND t.lifecycle = 'EFFECTED'
      AND t.type <> 'TRANSFER'
      AND t."isInternalTransfer" = false
      AND (
        (t."paymentDate" >= '2026-06-01'::date AND t."paymentDate" <= '2026-06-30'::date)
        OR (t."paymentDate" IS NULL AND t.date >= '2026-06-01'::date AND t.date <= '2026-06-30'::date)
      )
      AND NOT (
        t.origin = 'OFX' AND t."reconciledWithId" IS NULL
        AND EXISTS (SELECT 1 FROM transactions r WHERE r."reconciledWithId" = t.id)
      )
  `
  return { qtd: Number(result[0].qtd), signed: Number(result[0].signed) }
}

async function main() {
  console.log('=== Etapa B: corrige competenceDate de 11 Excel ===\n')

  // 1. SANITY pré
  console.log('[snapshot pré]')
  const balPre = await getBalances()
  const drePre = await getDreCaixaJun()
  console.log(`  banrisul: ${fmt(balPre.banrisul.balance)}`)
  console.log(`  stone:    ${fmt(balPre.stone.balance)}`)
  console.log(`  sicredi:  ${fmt(balPre.sicredi.balance)}`)
  console.log(`  DRE caixa Cacula jun: ${drePre.qtd} tx, signed ${fmt(drePre.signed)}`)

  if (!close(balPre.banrisul.balance, BANRISUL_BEFORE))
    throw new Error(`banrisul mudou: ${fmt(balPre.banrisul.balance)} != ${fmt(BANRISUL_BEFORE)}`)
  if (!close(balPre.stone.balance, STONE_BEFORE))
    throw new Error(`stone mudou: ${fmt(balPre.stone.balance)} != ${fmt(STONE_BEFORE)}`)
  if (!close(balPre.sicredi.balance, SICREDI_BEFORE))
    throw new Error(`sicredi mudou: ${fmt(balPre.sicredi.balance)} != ${fmt(SICREDI_BEFORE)}`)
  if (drePre.qtd !== DRE_QTD_BEFORE)
    throw new Error(`DRE qtd mudou: ${drePre.qtd} != ${DRE_QTD_BEFORE}`)
  if (!close(drePre.signed, DRE_SIGNED_BEFORE))
    throw new Error(`DRE signed mudou: ${fmt(drePre.signed)} != ${fmt(DRE_SIGNED_BEFORE)}`)

  // 2. SANITY: confirma que as 11 IDs satisfazem o critério
  const before = await prisma.transaction.findMany({
    where: {
      id: { in: TX_IDS },
      origin: 'IMPORT_EXCEL',
      lifecycle: 'EFFECTED',
      reconciledWithId: { not: null },
      paymentDate: {
        gte: new Date('2026-06-08T00:00:00.000Z'),
        lt: new Date('2026-06-09T00:00:00.000Z'),
      },
      competenceDate: { lt: new Date('2026-06-01T00:00:00.000Z') },
    },
    select: {
      id: true, amount: true, description: true,
      competenceDate: true, paymentDate: true,
      supplier: { select: { razaoSocial: true } },
    },
  })

  if (before.length !== TX_IDS.length)
    throw new Error(`Só ${before.length}/${TX_IDS.length} ainda satisfazem critério. Aborta.`)

  console.log(`\n  ✓ todas 11 confirmadas (origin=Excel, lifecycle=EFFECTED, paymentDate=08/jun, competenceDate<jun)\n`)

  // 3. Atomic
  console.log('[executando atomic...]')
  const result = await prisma.$transaction(async (tx) => {
    // 3.1. Update das 11 — competenceDate = NEW_COMPETENCE (08/jun)
    const updated = await tx.transaction.updateMany({
      where: { id: { in: TX_IDS } },
      data: { competenceDate: NEW_COMPETENCE },
    })

    if (updated.count !== TX_IDS.length)
      throw new Error(`updateMany afetou ${updated.count}/${TX_IDS.length}. Rollback.`)

    // 3.2. SANITY: confirma as 11 com competenceDate = NEW (1 só valor)
    const verifyUpdate = await tx.transaction.findMany({
      where: { id: { in: TX_IDS } },
      select: { id: true, competenceDate: true },
    })
    for (const t of verifyUpdate) {
      if (
        !t.competenceDate ||
        t.competenceDate.toISOString() !== NEW_COMPETENCE.toISOString()
      ) {
        throw new Error(`tx ${t.id} competenceDate não bateu: ${t.competenceDate}. Rollback.`)
      }
    }

    // 3.3. SANITY: NENHUMA tx FORA dessas 11 com Excel reconciled paymentDate=08/jun
    //      ficou com competenceDate < jun (= não mexemos em mais nada do tipo)
    const orfasRestantes = await tx.transaction.count({
      where: {
        bankAccount: { companyId: COMPANY_ID },
        origin: 'IMPORT_EXCEL',
        lifecycle: 'EFFECTED',
        reconciledWithId: { not: null },
        paymentDate: { gte: new Date('2026-06-01'), lt: new Date('2026-07-01') },
        competenceDate: { lt: new Date('2026-06-01') },
      },
    })
    if (orfasRestantes !== 0)
      throw new Error(`${orfasRestantes} Excel ainda com competenceDate errado. Rollback.`)

    // 3.4. SANITY: balances NÃO mudaram
    const balPos = await Promise.all([
      tx.bankAccount.findUniqueOrThrow({ where: { id: balPre.banrisul.id }, select: { balance: true } }),
      tx.bankAccount.findUniqueOrThrow({ where: { id: balPre.stone.id }, select: { balance: true } }),
      tx.bankAccount.findUniqueOrThrow({ where: { id: balPre.sicredi.id }, select: { balance: true } }),
    ])
    if (!close(balPos[0].balance, BANRISUL_BEFORE))
      throw new Error(`banrisul mudou (${fmt(balPos[0].balance)}). Rollback.`)
    if (!close(balPos[1].balance, STONE_BEFORE))
      throw new Error(`stone mudou (${fmt(balPos[1].balance)}). Rollback.`)
    if (!close(balPos[2].balance, SICREDI_BEFORE))
      throw new Error(`sicredi mudou (${fmt(balPos[2].balance)}). Rollback.`)

    // 3.5. Audit log — 1 entry por tx pra rastreabilidade
    for (const t of before) {
      await tx.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          userId: 'cmp9e4kgz00007wajsn05e9mg',
          userName: 'Yussef (Etapa B competenceDate fix)',
          userEmail: 'yussefmusa5522@gmail.com',
          action: 'EXCEL_COMPETENCE_DATE_FIX',
          entityType: 'Transaction',
          entityId: t.id,
          metadata: JSON.stringify({
            context:
              'Etapa B Yussef 11/06/2026 — corrige competenceDate de Excel paga 08/jun cuja planilha veio com data errada (mai/abr).',
            fornecedor: t.supplier?.razaoSocial ?? t.description.slice(0, 40),
            amount: t.amount,
            competenceDateBefore: t.competenceDate?.toISOString() ?? null,
            competenceDateAfter: NEW_COMPETENCE.toISOString(),
            paymentDate: t.paymentDate?.toISOString() ?? null,
            balanceImpact: 0,
            dreImpact: 0,
            backupPath:
              '/var/backups/conta-ia/pre-etapa-b-competenceDate-fix-20260611_214900.dump',
          }),
        },
      })
    }

    return { updated: updated.count }
  })

  console.log(`  ✓ ${result.updated} Excel atualizadas`)
  console.log(`  ✓ todas com competenceDate = 2026-06-08`)
  console.log(`  ✓ balances inalterados`)

  // 4. Pós: prova DRE caixa Cacula jun continua igual
  const drePost = await getDreCaixaJun()
  console.log(`\n[snapshot pós]`)
  console.log(`  DRE caixa Cacula jun: ${drePost.qtd} tx, signed ${fmt(drePost.signed)}`)
  if (drePost.qtd !== DRE_QTD_BEFORE)
    throw new Error(`DRE qtd mudou pós: ${drePost.qtd} != ${DRE_QTD_BEFORE}`)
  if (!close(drePost.signed, DRE_SIGNED_BEFORE))
    throw new Error(`DRE signed mudou pós: ${fmt(drePost.signed)} != ${fmt(DRE_SIGNED_BEFORE)}`)
  console.log(`  ✓ DRE caixa idêntico ao antes (zero efeito)`)

  await prisma.$disconnect()
  console.log(`\n=== ETAPA B CONCLUÍDA ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
