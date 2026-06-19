// AUDITORIA DRE Cacula Junho/2026 (READ-ONLY)
//
// Objetivo: explicar gap entre receita real R$ 254.861 e dashboard
// R$ 283.424 (gap +R$ 28.562). NÃO MUTA NADA.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const STONE = 'cmq182qfr0005aktn6q2ugpv2'

const RECEITA_REAL = 254861.29
const DASHBOARD = 283424.0

const prisma = new PrismaClient()

function nomeConta(id: string | null): string {
  if (id === STONE) return 'STONE'
  if (id === BANRISUL) return 'BANRISUL'
  if (id === SICREDI) return 'SICREDI'
  return id?.slice(0, 12) ?? 'null'
}

async function main() {
  console.log('━'.repeat(80))
  console.log('AUDITORIA DRE Cacula Junho/2026 (READ-ONLY)')
  console.log(`Verdade OFX: R$ ${RECEITA_REAL.toFixed(2)}`)
  console.log(`Dashboard:   R$ ${DASHBOARD.toFixed(2)}`)
  console.log(`GAP:         R$ +${(DASHBOARD - RECEITA_REAL).toFixed(2)}`)
  console.log('━'.repeat(80))

  // ─────────────────────────────────────────────────────
  // 1) Quebra RECEITA_BRUTA junho por conta + origem
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 1) RECEITA_BRUTA junho — quebra por conta + origem ━━')

  const breakdown = await prisma.$queryRaw<
    Array<{ conta: string | null; origin: string; lifecycle: string; qtd: bigint; total: number }>
  >`
    SELECT ba.name AS conta, t.origin, t.lifecycle, COUNT(*)::bigint AS qtd, COALESCE(SUM(t.amount), 0) AS total
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    LEFT JOIN categories c ON c.id = t."categoryId"
    WHERE ba."companyId" = ${CACULA}
      AND t.date >= '2026-06-01'::date
      AND t.date < '2026-06-19'::date
      AND t.type = 'CREDIT'
      AND c."dreGroup" = 'RECEITA_BRUTA'
    GROUP BY ba.name, t.origin, t.lifecycle
    ORDER BY ba.name, t.origin, t.lifecycle
  `

  console.log(
    `\n  ${'CONTA'.padEnd(16)} ${'ORIGIN'.padEnd(12)} ${'LIFECYCLE'.padEnd(12)} ${'QTD'.padStart(5)} ${'TOTAL'.padStart(14)}`,
  )
  let totalGeral = 0
  let totalEffected = 0
  let totalPayable = 0
  for (const r of breakdown) {
    const amount = Number(r.total)
    totalGeral += amount
    if (r.lifecycle === 'EFFECTED') totalEffected += amount
    else totalPayable += amount
    console.log(
      `  ${(r.conta ?? '-').padEnd(16)} ${r.origin.padEnd(12)} ${r.lifecycle.padEnd(12)} ${String(r.qtd).padStart(5)} ${amount.toFixed(2).padStart(14)}`,
    )
  }
  console.log(`\n  TOTAL EFFECTED (realizado): R$ ${totalEffected.toFixed(2)}`)
  console.log(`  TOTAL PAYABLE/RECEIVABLE:   R$ ${totalPayable.toFixed(2)}`)
  console.log(`  TOTAL GERAL:                R$ ${totalGeral.toFixed(2)}`)
  console.log(`  Dashboard projetada:         R$ ${DASHBOARD.toFixed(2)}`)
  console.log(`  Δ DRE realizado vs Dashboard: R$ ${(totalEffected - DASHBOARD).toFixed(2)}`)

  // ─────────────────────────────────────────────────────
  // 2) GAP: lançamentos RECEITA_BRUTA NÃO-OFX
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 2) GAP +R$ 28.562 — lançamentos RECEITA_BRUTA NÃO-OFX ━━')
  console.log('  (qualquer origem != OFX que entra no DRE realizado)\n')

  const naoOfx = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      date: { gte: new Date('2026-06-01'), lt: new Date('2026-06-19') },
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
      origin: { not: 'OFX' },
    },
    select: {
      id: true,
      bankAccountId: true,
      date: true,
      amount: true,
      description: true,
      origin: true,
      lifecycle: true,
      category: { select: { name: true } },
    },
    orderBy: [{ amount: 'desc' }],
  })

  console.log(`  Total tx NÃO-OFX em RECEITA_BRUTA: ${naoOfx.length}`)
  let somaNaoOfx = 0
  for (const t of naoOfx.slice(0, 60)) {
    somaNaoOfx += t.amount
    console.log(
      `   · ${t.date.toISOString().slice(0, 10)} ${nomeConta(t.bankAccountId).padEnd(13)} ${t.origin.padEnd(12)} ${t.lifecycle.padEnd(11)} R$ ${t.amount.toFixed(2).padStart(10)} "${t.description.slice(0, 50)}"`,
    )
  }
  const sobrante = naoOfx.slice(60).reduce((s, t) => s + t.amount, 0)
  if (naoOfx.length > 60) {
    console.log(`   ... + ${naoOfx.length - 60} linhas, somam R$ ${sobrante.toFixed(2)}`)
    somaNaoOfx += sobrante
  }
  console.log(`\n  Soma tx NÃO-OFX em RECEITA_BRUTA: R$ ${somaNaoOfx.toFixed(2)}`)

  // ─────────────────────────────────────────────────────
  // 3) Classificar o gap por origem
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 3) Classificar gap por origem ━━')
  const porOrigem = new Map<string, { count: number; sum: number }>()
  for (const t of naoOfx) {
    const k = `${t.origin} | lifecycle=${t.lifecycle}`
    const cur = porOrigem.get(k) ?? { count: 0, sum: 0 }
    cur.count++
    cur.sum += t.amount
    porOrigem.set(k, cur)
  }
  for (const [k, v] of porOrigem) {
    console.log(`  ${k.padEnd(40)} qtd=${v.count} total=R$ ${v.sum.toFixed(2)}`)
  }

  // Conta caixa/cofre (sem extrato OFX) — possíveis vendas reais
  console.log('\n  Quebra por conta (NÃO-OFX):')
  const porConta = new Map<string, number>()
  for (const t of naoOfx) {
    const c = nomeConta(t.bankAccountId)
    porConta.set(c, (porConta.get(c) ?? 0) + t.amount)
  }
  for (const [c, v] of porConta) {
    console.log(`    ${c.padEnd(16)}: R$ ${v.toFixed(2)}`)
  }

  // ─────────────────────────────────────────────────────
  // 4) Confirmar: transferência YUSSEF + empréstimo Sicredi NÃO estão em receita
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 4) Confirmar: transferência YUSSEF + empréstimo 100k FORA da receita ━━')

  // 4a) Transferências (type=TRANSFER) total junho
  const transfersTotal = await prisma.$queryRaw<Array<{ qtd: bigint; total: number }>>`
    SELECT COUNT(*)::bigint AS qtd, COALESCE(SUM(amount), 0) AS total
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t.date >= '2026-06-01'::date
      AND t.date < '2026-06-19'::date
      AND t.type = 'TRANSFER'
  `
  console.log(`  type=TRANSFER junho: ${transfersTotal[0].qtd} tx, total signed (entrada+saida) R$ ${Number(transfersTotal[0].total).toFixed(2)}`)
  console.log(`  → essas são as pernas das transferências internas. NÃO entram em DRE/receita (filtradas pelo engine).`)

  // 4b) Empréstimo 100k C61021346
  const emprestimo = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      OR: [
        { description: { contains: 'C61021346' } },
        { description: { contains: 'LIBERACAO CREDITO' } },
      ],
    },
    select: {
      id: true,
      bankAccountId: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      origin: true,
      lifecycle: true,
      category: { select: { name: true, dreGroup: true } },
    },
  })
  console.log(`\n  Empréstimo C61021346: ${emprestimo.length} tx`)
  for (const t of emprestimo) {
    console.log(
      `   · ${t.date.toISOString().slice(0, 10)} ${nomeConta(t.bankAccountId).padEnd(12)} ${t.type} R$ ${t.amount.toFixed(2)} ${t.category?.dreGroup ?? '-'} (${t.category?.name ?? '-'}) origin=${t.origin}`,
    )
  }

  // ─────────────────────────────────────────────────────
  // 5) Comparar com maio
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 5) Comparativo maio/2026 ━━')
  const maioStats = await prisma.$queryRaw<
    Array<{ origin: string; qtd: bigint; receita: number; total_tx: bigint }>
  >`
    SELECT
      t.origin,
      COUNT(*) FILTER (WHERE c."dreGroup" = 'RECEITA_BRUTA' AND t.type = 'CREDIT')::bigint AS qtd,
      COALESCE(SUM(CASE WHEN c."dreGroup" = 'RECEITA_BRUTA' AND t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0) AS receita,
      COUNT(*)::bigint AS total_tx
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    LEFT JOIN categories c ON c.id = t."categoryId"
    WHERE ba."companyId" = ${CACULA}
      AND t.date >= '2026-05-01'::date
      AND t.date < '2026-06-01'::date
    GROUP BY t.origin
    ORDER BY t.origin
  `
  let receitaMaio = 0
  let totalTxMaio = BigInt(0)
  for (const r of maioStats) {
    receitaMaio += Number(r.receita)
    totalTxMaio += r.total_tx
    console.log(`  origin=${r.origin.padEnd(12)} receita_qtd=${r.qtd} receita=R$ ${Number(r.receita).toFixed(2)} total_tx=${r.total_tx}`)
  }
  console.log(`\n  TOTAL maio: ${totalTxMaio} tx, RECEITA_BRUTA EFFECTED/realizado = R$ ${receitaMaio.toFixed(2)}`)

  // Conta importações OFX em maio
  const maioOfx = await prisma.ofxImport.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      periodStart: { lte: new Date('2026-05-31') },
      periodEnd: { gte: new Date('2026-05-01') },
      status: 'SUCCESS',
    },
    select: {
      id: true,
      bankAccountId: true,
      periodStart: true,
      periodEnd: true,
      newTransactions: true,
    },
  })
  console.log(`\n  OfxImports cobrindo maio: ${maioOfx.length}`)
  for (const i of maioOfx) {
    console.log(
      `   · ${i.id.slice(0, 12)} conta=${nomeConta(i.bankAccountId)} ${i.periodStart?.toISOString().slice(0, 10)} → ${i.periodEnd?.toISOString().slice(0, 10)} (${i.newTransactions} tx)`,
    )
  }
  console.log(`\n  Maio vs Junho:`)
  console.log(`    Maio receita: R$ ${receitaMaio.toFixed(2)}`)
  console.log(`    Junho receita (EFFECTED): R$ ${totalEffected.toFixed(2)}`)
  if (receitaMaio > 0) {
    const pct = ((totalEffected - receitaMaio) / receitaMaio) * 100
    console.log(`    Variação: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`)
  } else {
    console.log(`    Variação: ∞ (maio = 0 → +1825% confirmaria maio vazio)`)
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
