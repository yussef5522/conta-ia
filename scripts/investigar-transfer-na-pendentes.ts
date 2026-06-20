// READ-ONLY — Investigar transferências pareadas aparecendo em "Pendentes"
// Cenário: PIX ENVIADO 08/06 R$20.300 + 16/06 R$8.000 (Banrisul)

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'

const prisma = new PrismaClient()

const nome: Record<string, string> = {
  'cmq17z90v00qxrndl02kfn4iz': 'BANRISUL',
  'cmq180ksv0001aktni9wj64mq': 'SICREDI',
  'cmq182qfr0005aktn6q2ugpv2': 'STONE',
  'cmq2objjg0005y2fald7auroi': 'BANCO_CAIXA',
  'cmq2o25qe0001y2faydl1yrp5': 'CAIXA_LOJA',
}

async function main() {
  console.log('━'.repeat(80))
  console.log('INVESTIGAR TRANSFER NA PENDENTES (READ-ONLY)')
  console.log('━'.repeat(80))

  // ──────────────────────────────────────────────────
  // 1) DUPLICATA: todas linhas Banrisul 20.300 08/06 e 8.000 16/06
  // ──────────────────────────────────────────────────
  console.log('\n━━ 1) Linhas físicas pra cada caso ━━')

  for (const [data, valor] of [['2026-06-08', 20300], ['2026-06-16', 8000]] as const) {
    console.log(`\n  ━━ Banrisul ${data} R$ ${valor} ━━`)
    const linhas = await prisma.transaction.findMany({
      where: {
        bankAccountId: BANRISUL,
        amount: valor,
        date: {
          gte: new Date(`${data}T00:00:00.000Z`),
          lte: new Date(`${data}T23:59:59.999Z`),
        },
      },
      select: {
        id: true,
        type: true,
        status: true,
        transferGroupId: true,
        transferDirection: true,
        transferDismissedAt: true,
        categoryId: true,
        origin: true,
        externalId: true,
        contentHash: true,
        dedupHash: true,
        description: true,
        importId: true,
        createdAt: true,
        lifecycle: true,
        reconciledWithId: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    console.log(`  Total linhas físicas: ${linhas.length}`)
    for (const l of linhas) {
      console.log(`\n    📌 ${l.id}`)
      console.log(`        type=${l.type} status=${l.status} lifecycle=${l.lifecycle}`)
      console.log(`        transferGroupId=${l.transferGroupId ?? 'null'}`)
      console.log(`        transferDirection=${l.transferDirection ?? 'null'}`)
      console.log(`        transferDismissedAt=${l.transferDismissedAt?.toISOString().slice(0, 16) ?? 'null'}`)
      console.log(`        categoryId=${l.categoryId ?? 'null'}`)
      console.log(`        origin=${l.origin}`)
      console.log(`        externalId=${l.externalId ?? 'null'}`)
      console.log(`        dedupHash=${l.dedupHash?.slice(0, 16) ?? 'null'}`)
      console.log(`        contentHash=${l.contentHash?.slice(0, 16) ?? 'null'}`)
      console.log(`        reconciledWithId=${l.reconciledWithId ?? 'null'}`)
      console.log(`        importId=${l.importId?.slice(0, 8) ?? 'null'}`)
      console.log(`        createdAt=${l.createdAt.toISOString().slice(0, 16)}`)
      console.log(`        description="${l.description}"`)
    }
  }

  // ──────────────────────────────────────────────────
  // 2) Reproduzir EXATAMENTE a query da tela Pendentes
  // ──────────────────────────────────────────────────
  console.log('\n━━ 2) Reproduzir query da tela Pendentes (semCategoria=true) ━━')
  console.log('  Filtro applicado (do código):')
  console.log('    bankAccount.companyId = CACULA')
  console.log('    categoryId IS NULL')
  console.log('    transferGroupId IS NULL  ← exclui TRANSFER pareada')
  console.log("    reconciledWithId IS NULL")
  console.log('    reconciledFrom { none: {} }')
  console.log("    type NOT 'TRANSFER'   ← exclui type TRANSFER")
  console.log('    status = PENDING')
  console.log('')

  const pendentes = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      categoryId: null,
      transferGroupId: null,
      reconciledWithId: null,
      reconciledFrom: { none: {} },
      type: { not: 'TRANSFER' },
      status: 'PENDING',
    },
    select: {
      id: true,
      bankAccountId: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      externalId: true,
      origin: true,
      transferGroupId: true,
      transferDirection: true,
      transferDismissedAt: true,
      categoryId: true,
      status: true,
    },
    orderBy: { date: 'desc' },
  })

  console.log(`  Total tx em Pendentes (Cacula, todas contas): ${pendentes.length}`)
  // Filtrar só Banrisul DEBITs valor 20300 ou 8000
  const suspeitas = pendentes.filter(
    (p) => p.bankAccountId === BANRISUL && (p.amount === 20300 || p.amount === 8000),
  )
  console.log(`\n  Suspeitas (Banrisul valor 20.300 ou 8.000): ${suspeitas.length}`)
  for (const s of suspeitas) {
    console.log(`    ${s.id} ${s.date.toISOString().slice(0, 10)} ${s.type} R$ ${s.amount} ext=${s.externalId ?? 'null'} origin=${s.origin} desc="${s.description}"`)
  }

  // ──────────────────────────────────────────────────
  // 3) Cruzar com os 19 grupos pareados
  // ──────────────────────────────────────────────────
  console.log('\n━━ 3) Cruzar pares vs Pendentes — quais "vazam"? ━━')

  const pares = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      transferGroupId: { not: null },
    },
    select: {
      id: true,
      bankAccountId: true,
      amount: true,
      date: true,
      transferGroupId: true,
      transferDirection: true,
      status: true,
      type: true,
      externalId: true,
    },
  })
  // Agrupar
  const byGroup = new Map<string, typeof pares>()
  for (const p of pares) {
    const gid = p.transferGroupId!
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid)!.push(p)
  }

  // Pra cada par, check se há tx ÓRFÃ (sem groupId) DEBIT/CREDIT mesmo valor/data/conta
  // (essa órfã é a que vaza pra Pendentes)
  console.log(`\n  ${byGroup.size} grupos. Pra cada um, busca tx ÓRFÃ duplicada:\n`)
  let comOrfa = 0
  let semOrfa = 0
  for (const [gid, sides] of byGroup) {
    const a = sides[0]
    const data = a.date.toISOString().slice(0, 10)
    let temOrfa = false
    for (const lado of sides) {
      // Procura tx mesma conta+valor+data SEM groupId
      const orfas = await prisma.transaction.findMany({
        where: {
          bankAccountId: lado.bankAccountId,
          amount: lado.amount,
          date: {
            gte: new Date(`${data}T00:00:00.000Z`),
            lte: new Date(`${data}T23:59:59.999Z`),
          },
          transferGroupId: null,
          type: { in: ['DEBIT', 'CREDIT'] },
        },
        select: { id: true, type: true, externalId: true, origin: true, status: true, description: true },
      })
      if (orfas.length > 0) {
        if (!temOrfa) {
          console.log(`  🚨 [${gid.slice(0, 8)}] ${data} R$ ${a.amount}:`)
          temOrfa = true
        }
        for (const o of orfas) {
          console.log(
            `      ${nome[lado.bankAccountId ?? '']?.padEnd(13)} órfã ${o.id} ${o.type} status=${o.status} origin=${o.origin} ext=${o.externalId ?? 'null'} "${o.description.slice(0, 35)}"`,
          )
        }
      }
    }
    if (temOrfa) comOrfa++
    else semOrfa++
  }
  console.log(`\n  Pares COM tx órfã duplicada (vazam pra Pendentes): ${comOrfa}`)
  console.log(`  Pares SEM tx órfã (não vazam): ${semOrfa}`)

  // ──────────────────────────────────────────────────
  // 4) Saldo Banrisul vs LEDGERBAL
  // ──────────────────────────────────────────────────
  console.log('\n━━ 4) Saldo Banrisul vs LEDGERBAL ━━')
  const banrisul = await prisma.bankAccount.findUnique({
    where: { id: BANRISUL },
    select: { name: true, balance: true, ledgerBal: true, ledgerBalDate: true },
  })
  console.log(`  cache balance:  R$ ${banrisul?.balance.toFixed(2)}`)
  console.log(`  ledgerBal:      R$ ${banrisul?.ledgerBal?.toFixed(2)} (date=${banrisul?.ledgerBalDate?.toISOString().slice(0, 10)})`)
  console.log(`  LEDGERBAL real Yussef: R$ -9.588,12`)
  const delta = (banrisul?.balance ?? 0) - (-9588.12)
  console.log(`  Δ vs LEDGERBAL: R$ ${delta.toFixed(2)} ${Math.abs(delta) < 1 ? '✅' : '🚨'}`)

  // Signed sum total
  const totals = await prisma.$queryRaw<Array<{ signed_sum: number; count: bigint }>>`
    SELECT
      SUM(CASE
        WHEN type='CREDIT' THEN amount
        WHEN type='DEBIT' THEN -amount
        WHEN type='TRANSFER' AND "transferDirection"='OUT' THEN -amount
        WHEN type='TRANSFER' AND "transferDirection"='IN' THEN amount
        WHEN type='TRANSFER' THEN amount
        ELSE 0 END) AS signed_sum,
      COUNT(*) AS count
    FROM transactions
    WHERE "bankAccountId" = ${BANRISUL}
  `
  console.log(`\n  Soma signed total Banrisul (todas tx vivas): R$ ${Number(totals[0].signed_sum).toFixed(2)} (${totals[0].count} tx)`)
  console.log(`  Se balance == LEDGERBAL E orfãs duplicadas existem, indica que orfãs:`)
  console.log(`    (a) JÁ contam no saldo, OU`)
  console.log(`    (b) estão IGNORED/PENDING e não somam, OU`)
  console.log(`    (c) recalcularSaldo usa LEDGERBAL_ANCHOR e ignora tx pré-data`)

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — read-only, nada mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
