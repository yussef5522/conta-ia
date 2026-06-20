// INVESTIGAÇÃO READ-ONLY — transferências pareadas aparecendo como
// "Pendente / Sem categoria" nas Movimentações.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const STONE = 'cmq182qfr0005aktn6q2ugpv2'
const BANCO_CAIXA = 'cmq2objjg0005y2fald7auroi'

const prisma = new PrismaClient()

function nomeConta(id: string | null): string {
  if (id === STONE) return 'STONE'
  if (id === BANRISUL) return 'BANRISUL'
  if (id === SICREDI) return 'SICREDI'
  if (id === BANCO_CAIXA) return 'BANCO_CAIXA'
  return id?.slice(0, 12) ?? 'null'
}

async function main() {
  console.log('━'.repeat(80))
  console.log('INVESTIGAÇÃO TRANSFERÊNCIAS PENDENTES (READ-ONLY)')
  console.log('━'.repeat(80))

  // ─────────────────────────────────────────────────────
  // 1) A tx Banrisul -21.000 01/06 — registro completo
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 1) Banrisul "PIX ENVIADO" -21.000 em 01/06 ━━')
  const candidatas = await prisma.transaction.findMany({
    where: {
      bankAccountId: BANRISUL,
      amount: 21000,
      date: { gte: new Date('2026-06-01'), lt: new Date('2026-06-02') },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      externalId: true,
      transferGroupId: true,
      transferDirection: true,
      status: true,
      lifecycle: true,
      origin: true,
      categoryId: true,
      classificationSource: true,
      aiConfidence: true,
      category: { select: { name: true, dreGroup: true } },
    },
  })
  console.log(`  ${candidatas.length} candidata(s):`)
  for (const t of candidatas) {
    console.log(`\n  📌 ${t.id}`)
    console.log(`    type=${t.type} amount=${t.amount} date=${t.date.toISOString().slice(0, 10)}`)
    console.log(`    description: "${t.description}"`)
    console.log(`    externalId: "${t.externalId ?? 'null'}"`)
    console.log(`    transferGroupId: ${t.transferGroupId ?? 'null'}`)
    console.log(`    transferDirection: ${t.transferDirection ?? 'null'}`)
    console.log(`    status (UI badge): ${t.status}`)
    console.log(`    lifecycle (caixa/realizado): ${t.lifecycle}`)
    console.log(`    origin: ${t.origin}`)
    console.log(`    categoryId: ${t.categoryId ?? 'null (Sem categoria)'}`)
    console.log(`    categoria.name: ${t.category?.name ?? '-'}`)
    console.log(`    dreGroup: ${t.category?.dreGroup ?? '-'}`)
    console.log(`    classificationSource: ${t.classificationSource ?? 'null'}`)

    // Par (lado oposto do groupId)
    if (t.transferGroupId) {
      const par = await prisma.transaction.findMany({
        where: { transferGroupId: t.transferGroupId, id: { not: t.id } },
        select: {
          id: true,
          bankAccountId: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          status: true,
          transferDirection: true,
          categoryId: true,
          category: { select: { name: true, dreGroup: true } },
        },
      })
      console.log(`    PAR (${par.length} lado oposto):`)
      for (const p of par) {
        console.log(
          `      ${p.id} conta=${nomeConta(p.bankAccountId)} ${p.type} ${p.transferDirection ?? '-'} R$ ${p.amount} "${p.description.slice(0, 40)}" status=${p.status} cat=${p.category?.name ?? 'null'} dreGroup=${p.category?.dreGroup ?? '-'}`,
        )
      }
    } else {
      console.log(`    ⚠ SEM transferGroupId — não está pareada de fato`)
    }
  }

  // ─────────────────────────────────────────────────────
  // 2) Status esperado pra TRANSFER pareada
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 2) Status enum + valores típicos pra TRANSFER pareada ━━')
  const statusDist = await prisma.$queryRaw<Array<{ status: string; type: string; qtd: bigint }>>`
    SELECT status, type, COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t."transferGroupId" IS NOT NULL
    GROUP BY status, type
    ORDER BY status, type
  `
  console.log(`  status x type pra tx COM transferGroupId (Cacula):`)
  for (const r of statusDist) {
    console.log(`    status=${r.status.padEnd(12)} type=${r.type.padEnd(10)} qtd=${r.qtd}`)
  }

  // ─────────────────────────────────────────────────────
  // 3) Memo de cada lado dos 4 pares 21000 / 8000 / 650 / 34000 / 1100 etc
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 3) Memo dos 2 lados pra cada par em junho ━━')
  const todasTransfers = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      type: 'TRANSFER',
      transferGroupId: { not: null },
      date: { gte: new Date('2026-06-01'), lt: new Date('2026-06-19') },
    },
    select: {
      id: true,
      bankAccountId: true,
      amount: true,
      date: true,
      description: true,
      externalId: true,
      transferGroupId: true,
      transferDirection: true,
      status: true,
      categoryId: true,
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Agrupa por groupId
  const groups = new Map<string, typeof todasTransfers>()
  for (const t of todasTransfers) {
    const gid = t.transferGroupId!
    if (!groups.has(gid)) groups.set(gid, [])
    groups.get(gid)!.push(t)
  }

  console.log(`  ${groups.size} pares pareados em junho.\n`)
  let parseidOk = 0
  let lateralPendentes = 0
  let lateralSemCategoria = 0
  for (const [gid, sides] of groups) {
    const dataSide = sides[0]
    console.log(
      `  [groupId ${gid.slice(0, 8)}] ${dataSide.date.toISOString().slice(0, 10)} R$ ${dataSide.amount}`,
    )
    for (const s of sides) {
      const flag =
        s.status !== 'RECONCILED' && s.status !== 'PAID' ? ' 🚨 status' : ''
      const flagCat = !s.categoryId ? ' 🚨 sem categoria' : ''
      if (s.status !== 'RECONCILED' && s.status !== 'PAID') lateralPendentes++
      if (!s.categoryId) lateralSemCategoria++
      console.log(
        `    ${s.transferDirection?.padEnd(3) ?? '-'} ${nomeConta(s.bankAccountId).padEnd(13)} status=${s.status.padEnd(11)} cat=${(s.category?.name ?? 'null').padEnd(35)} ext=${(s.externalId ?? 'null').slice(0, 8)} "${s.description.slice(0, 35)}"${flag}${flagCat}`,
      )
    }
    parseidOk++
  }
  console.log(`\n  Resumo dos pares junho:`)
  console.log(`    pares ok lidos: ${parseidOk}`)
  console.log(`    lados com status != RECONCILED/PAID: ${lateralPendentes}`)
  console.log(`    lados com categoryId null: ${lateralSemCategoria}`)

  // ─────────────────────────────────────────────────────
  // 4) Total tx TRANSFER status=PENDENTE ou sem categoria (alcance global)
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 4) Alcance global: tx type=TRANSFER PENDENTE / sem categoria ━━')
  const transferTotais = await prisma.$queryRaw<
    Array<{ tipo_de_problema: string; qtd: bigint; valor_total: number }>
  >`
    WITH t AS (
      SELECT t.id, t.amount, t.status, t."categoryId", t."transferGroupId", t.date
      FROM transactions t
      JOIN bank_accounts ba ON ba.id = t."bankAccountId"
      WHERE ba."companyId" = ${CACULA}
        AND t.type = 'TRANSFER'
    )
    SELECT 'TOTAL_TRANSFER' AS tipo_de_problema, COUNT(*)::bigint AS qtd, COALESCE(SUM(amount), 0) AS valor_total FROM t
    UNION ALL
    SELECT 'STATUS_PENDING', COUNT(*)::bigint, COALESCE(SUM(amount), 0) FROM t WHERE status = 'PENDING'
    UNION ALL
    SELECT 'STATUS_RECONCILED', COUNT(*)::bigint, COALESCE(SUM(amount), 0) FROM t WHERE status = 'RECONCILED'
    UNION ALL
    SELECT 'STATUS_PAID', COUNT(*)::bigint, COALESCE(SUM(amount), 0) FROM t WHERE status = 'PAID'
    UNION ALL
    SELECT 'SEM_CATEGORIA', COUNT(*)::bigint, COALESCE(SUM(amount), 0) FROM t WHERE "categoryId" IS NULL
    UNION ALL
    SELECT 'TEM_CATEGORIA', COUNT(*)::bigint, COALESCE(SUM(amount), 0) FROM t WHERE "categoryId" IS NOT NULL
    UNION ALL
    SELECT 'TGROUP_NULL', COUNT(*)::bigint, COALESCE(SUM(amount), 0) FROM t WHERE "transferGroupId" IS NULL
  `
  console.log(`  ${'INDICADOR'.padEnd(22)} ${'QTD'.padStart(5)} ${'VALOR'.padStart(14)}`)
  for (const r of transferTotais) {
    console.log(
      `  ${r.tipo_de_problema.padEnd(22)} ${String(r.qtd).padStart(5)} R$ ${Number(r.valor_total).toFixed(2).padStart(12)}`,
    )
  }

  // ─────────────────────────────────────────────────────
  // 5) Distribuição classificationSource das TRANSFERs
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 5) Quem CRIOU as TRANSFER (origin + classificationSource) ━━')
  const sources = await prisma.$queryRaw<Array<{ origin: string; source: string | null; qtd: bigint }>>`
    SELECT t.origin, t."classificationSource" AS source, COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t.type = 'TRANSFER'
    GROUP BY t.origin, t."classificationSource"
    ORDER BY qtd DESC
  `
  for (const r of sources) {
    console.log(`  origin=${r.origin.padEnd(12)} source=${(r.source ?? 'null').padEnd(12)} qtd=${r.qtd}`)
  }

  // ─────────────────────────────────────────────────────
  // 6) Tx específica do extrato 01/06 — referência cross
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 6) Lateral Stone 01/06 R$ 21000 (par da -21k Banrisul) ━━')
  const stoneSide = await prisma.transaction.findMany({
    where: {
      bankAccountId: STONE,
      amount: 21000,
      date: { gte: new Date('2026-06-01'), lt: new Date('2026-06-02') },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      externalId: true,
      transferGroupId: true,
      transferDirection: true,
      status: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  })
  for (const t of stoneSide) {
    console.log(
      `  ${t.id} type=${t.type} ${t.transferDirection ?? '-'} status=${t.status} group=${t.transferGroupId?.slice(0, 8)} cat=${t.category?.name ?? 'null'} desc="${t.description}"`,
    )
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
