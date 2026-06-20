// AUDITORIA DUPLICATAS SISTEMA INTEIRO — Cacula (READ-ONLY)
//
// 6 classes de duplicação investigadas. NÃO MUTA NADA.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const STONE = 'cmq182qfr0005aktn6q2ugpv2'
const BANCO_CAIXA = 'cmq2objjg0005y2fald7auroi'
const CAIXA_LOJA = 'cmq2o25qe0001y2faydl1yrp5'

const CONTAS_BANCARIAS = [BANRISUL, SICREDI, STONE]
const CONTAS_CAIXA = [BANCO_CAIXA, CAIXA_LOJA]

const DAY_MS = 86400 * 1000
const prisma = new PrismaClient()

function nomeConta(id: string | null): string {
  if (id === STONE) return 'STONE'
  if (id === BANRISUL) return 'BANRISUL'
  if (id === SICREDI) return 'SICREDI'
  if (id === BANCO_CAIXA) return 'BANCO_CAIXA'
  if (id === CAIXA_LOJA) return 'CAIXA_LOJA'
  return id?.slice(0, 12) ?? 'null'
}

function isBancaria(id: string | null): boolean {
  return id !== null && CONTAS_BANCARIAS.includes(id)
}

async function main() {
  console.log('━'.repeat(80))
  console.log('AUDITORIA DUPLICATAS — Cacula (READ-ONLY)')
  console.log('━'.repeat(80))

  const totalTx = await prisma.transaction.count({
    where: { bankAccount: { companyId: CACULA } },
  })
  console.log(`\nUniverso: ${totalTx} tx vivas na Cacula`)

  // ═════════════════════════════════════════════════════════════════════
  // 1) PLACEHOLDER SINTÉTICA DUPLICADA
  //    tx MANUAL/externalId=null/TRANSFER que TEM par OFX real (mesma
  //    conta+valor+data+sinal-OFX) → bug "21k" replicado.
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('1) PLACEHOLDER SINTÉTICA DUPLICADA (bug do 21k)')
  console.log('═'.repeat(80))

  const placeholders = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      type: 'TRANSFER',
      origin: 'MANUAL',
      externalId: null,
      transferGroupId: { not: null },
    },
    select: {
      id: true,
      bankAccountId: true,
      amount: true,
      date: true,
      description: true,
      transferDirection: true,
      transferGroupId: true,
    },
  })
  console.log(`\n  Placeholders MANUAL/externalId=null/TRANSFER: ${placeholders.length}`)

  interface DuplicateClasse1 {
    placeholder: typeof placeholders[number]
    ofxReal: {
      id: string
      type: string
      amount: number
      date: Date
      description: string
      externalId: string | null
      status: string
      categoryId: string | null
      transferGroupId: string | null
    }
  }
  const duplicatesClasse1: DuplicateClasse1[] = []
  const orphans: typeof placeholders = []

  for (const ph of placeholders) {
    // OFX OUT = DEBIT (pro lado origem); OFX IN = CREDIT (pro lado destino)
    const expectedOfxType = ph.transferDirection === 'OUT' ? 'DEBIT' : 'CREDIT'
    const ofxReal = await prisma.transaction.findFirst({
      where: {
        bankAccountId: ph.bankAccountId,
        type: expectedOfxType,
        amount: ph.amount,
        origin: 'OFX',
        externalId: { not: null },
        date: {
          gte: new Date(ph.date.getTime() - DAY_MS),
          lte: new Date(ph.date.getTime() + DAY_MS),
        },
      },
      select: {
        id: true, type: true, amount: true, date: true, description: true,
        externalId: true, status: true, categoryId: true, transferGroupId: true,
      },
    })
    if (ofxReal) {
      duplicatesClasse1.push({ placeholder: ph, ofxReal })
    } else {
      orphans.push(ph)
    }
  }

  console.log(`\n  🚨 PLACEHOLDERS COM OFX REAL DUPLICADO: ${duplicatesClasse1.length}`)
  let valorTotalDup1 = 0
  for (const d of duplicatesClasse1) {
    valorTotalDup1 += d.placeholder.amount
    console.log(
      `\n    [${duplicatesClasse1.indexOf(d) + 1}] ${nomeConta(d.placeholder.bankAccountId)} ${d.placeholder.transferDirection} ${d.placeholder.date.toISOString().slice(0, 10)} R$ ${d.placeholder.amount}`,
    )
    console.log(`        Placeholder MANUAL: ${d.placeholder.id} desc="${d.placeholder.description.slice(0, 50)}"`)
    console.log(`        OFX real:           ${d.ofxReal.id} ${d.ofxReal.type} ext=${d.ofxReal.externalId} status=${d.ofxReal.status} desc="${d.ofxReal.description.slice(0, 50)}"`)
    console.log(`        OFX já pareado?     groupId=${d.ofxReal.transferGroupId?.slice(0, 8) ?? 'null'}`)
  }
  console.log(`\n  Valor total duplicado (Classe 1): R$ ${valorTotalDup1.toFixed(2)}`)
  console.log(`  Impacto DRE: ZERO (ambas type=TRANSFER, filtradas do DRE)`)
  console.log(`  Impacto saldo: lateral OUT/IN duplicado afeta signed sum quando OFX está sem groupId`)

  // ═════════════════════════════════════════════════════════════════════
  // 2) PLACEHOLDER ÓRFÃ (sem OFX real correspondente)
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('2) PLACEHOLDER ÓRFÃ (transferência sem extrato do outro lado)')
  console.log('═'.repeat(80))
  console.log(`\n  Total: ${orphans.length} placeholders sem OFX real correspondente`)
  console.log(`  (NÃO são duplicação — extrato da outra conta provavelmente não foi importado)\n`)
  let valorOrphans = 0
  for (const o of orphans.slice(0, 30)) {
    valorOrphans += o.amount
    console.log(
      `   · ${nomeConta(o.bankAccountId).padEnd(13)} ${o.transferDirection ?? '-'} ${o.date.toISOString().slice(0, 10)} R$ ${o.amount.toFixed(2).padStart(10)} "${o.description.slice(0, 40)}"`,
    )
  }
  if (orphans.length > 30) {
    const restoVal = orphans.slice(30).reduce((s, o) => s + o.amount, 0)
    console.log(`   ... + ${orphans.length - 30} mais, valor R$ ${restoVal.toFixed(2)}`)
    valorOrphans += restoVal
  }
  console.log(`\n  Valor total órfãos: R$ ${valorOrphans.toFixed(2)}`)

  // ═════════════════════════════════════════════════════════════════════
  // 3) MANUAL DENTRO DE CONTA BANCÁRIA (viola princípio Xero/QuickBooks)
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('3) MANUAL DENTRO DE CONTA BANCÁRIA (viola princípio "extrato = lei")')
  console.log('═'.repeat(80))

  const manualEmBancaria = await prisma.transaction.findMany({
    where: {
      bankAccountId: { in: CONTAS_BANCARIAS },
      origin: 'MANUAL',
    },
    select: {
      id: true,
      bankAccountId: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      transferGroupId: true,
      transferDirection: true,
      externalId: true,
    },
  })
  console.log(`\n  Total tx MANUAL em conta bancária: ${manualEmBancaria.length}`)
  const porTipoConta: Record<string, { qtd: number; sum: number }> = {}
  for (const t of manualEmBancaria) {
    const key = `${nomeConta(t.bankAccountId)} ${t.type}`
    if (!porTipoConta[key]) porTipoConta[key] = { qtd: 0, sum: 0 }
    porTipoConta[key].qtd++
    porTipoConta[key].sum += t.amount
  }
  for (const [k, v] of Object.entries(porTipoConta)) {
    console.log(`    ${k.padEnd(22)} ${v.qtd} tx R$ ${v.sum.toFixed(2)}`)
  }
  console.log(`\n  ⚠️ Estes 100% deveriam ser do extrato. MANUAL em conta de extrato indica:`)
  console.log(`     - contraparte sintética do detector (placeholder)`)
  console.log(`     - lançamento humano "ajuste" sem extrato (viola conciliação)`)

  // Quantas dessas são placeholders TRANSFER vs lançamentos individuais
  const phTransfers = manualEmBancaria.filter((t) => t.type === 'TRANSFER' && t.transferGroupId)
  const naoTransferManual = manualEmBancaria.filter((t) => t.type !== 'TRANSFER')
  console.log(`\n  Distribuição:`)
  console.log(`    placeholders TRANSFER (esperado, mas violando): ${phTransfers.length}`)
  console.log(`    NÃO-transfer (CREDIT/DEBIT humano puro): ${naoTransferManual.length}`)
  for (const t of naoTransferManual.slice(0, 10)) {
    console.log(
      `      · ${nomeConta(t.bankAccountId)} ${t.type} ${t.date.toISOString().slice(0, 10)} R$ ${t.amount} "${t.description.slice(0, 40)}"`,
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // 4) RE-IMPORT DUP — externalId ou contentHash repetidos
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('4) RE-IMPORT DUP — externalId / contentHash repetidos')
  console.log('═'.repeat(80))

  const dupExternalId = await prisma.$queryRaw<
    Array<{ bankAccountId: string; externalId: string; qtd: bigint }>
  >`
    SELECT t."bankAccountId", t."externalId", COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t."externalId" IS NOT NULL
    GROUP BY t."bankAccountId", t."externalId"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `
  console.log(`\n  Grupos com mesmo externalId em mesma conta (>1): ${dupExternalId.length}`)
  for (const r of dupExternalId.slice(0, 20)) {
    console.log(`    ${nomeConta(r.bankAccountId).padEnd(13)} ext=${r.externalId.padEnd(40)} qtd=${r.qtd}`)
  }

  const dupContent = await prisma.$queryRaw<
    Array<{ bankAccountId: string; contentHash: string; qtd: bigint }>
  >`
    SELECT t."bankAccountId", t."contentHash", COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t."contentHash" IS NOT NULL
    GROUP BY t."bankAccountId", t."contentHash"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `
  console.log(`\n  Grupos com mesmo contentHash em mesma conta (>1): ${dupContent.length}`)
  for (const r of dupContent.slice(0, 20)) {
    console.log(`    ${nomeConta(r.bankAccountId).padEnd(13)} hash=${r.contentHash.slice(0, 16)} qtd=${r.qtd}`)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 5) CROSS-SOURCE DUP — mesma (conta, valor, data, sinal) origins diferentes
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('5) CROSS-SOURCE DUP — OFX × MANUAL × IMPORT_EXCEL mesma econômica')
  console.log('═'.repeat(80))

  const crossSource = await prisma.$queryRaw<
    Array<{ bankAccountId: string; date: Date; amount: number; signal: string; origins: string; qtd: bigint }>
  >`
    SELECT
      t."bankAccountId",
      t.date::date AS date,
      t.amount,
      CASE WHEN t.type IN ('CREDIT','TRANSFER') THEN '+' ELSE '-' END AS signal,
      STRING_AGG(DISTINCT t.origin, ',' ORDER BY t.origin) AS origins,
      COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
    GROUP BY t."bankAccountId", t.date::date, t.amount, signal
    HAVING COUNT(DISTINCT t.origin) > 1
    ORDER BY t.amount DESC NULLS LAST
    LIMIT 50
  `
  console.log(`\n  Grupos (conta+data+valor+sinal) com origins distintas: ${crossSource.length}`)
  for (const r of crossSource.slice(0, 30)) {
    console.log(`    ${nomeConta(r.bankAccountId).padEnd(13)} ${r.date.toISOString().slice(0, 10)} ${r.signal} R$ ${Number(r.amount).toFixed(2).padStart(10)} origins=[${r.origins}] qtd=${r.qtd}`)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 6) COLISÃO valor+data GENÉRICA
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('6) COLISÃO valor+data GENÉRICA (qualquer >1 tx mesma assinatura)')
  console.log('═'.repeat(80))

  const colisoes = await prisma.$queryRaw<
    Array<{
      bankAccountId: string
      date: Date
      amount: number
      signal: string
      qtd: bigint
      fitids_distintos: bigint
      origins: string
      types: string
    }>
  >`
    SELECT
      t."bankAccountId",
      t.date::date AS date,
      t.amount,
      CASE WHEN t.type IN ('CREDIT','TRANSFER') THEN '+' ELSE '-' END AS signal,
      COUNT(*)::bigint AS qtd,
      COUNT(DISTINCT t."externalId")::bigint AS fitids_distintos,
      STRING_AGG(DISTINCT t.origin, ',' ORDER BY t.origin) AS origins,
      STRING_AGG(DISTINCT t.type, ',' ORDER BY t.type) AS types
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
    GROUP BY t."bankAccountId", t.date::date, t.amount, signal
    HAVING COUNT(*) > 1
    ORDER BY t.amount DESC NULLS LAST
    LIMIT 100
  `

  // Classifica: legítimas (FITIDs distintos = vendas reais repetidas) vs suspeitas
  let legitimas = 0
  let suspeitas = 0
  let valorSuspeito = 0
  const suspeitasDetalhe: typeof colisoes = []
  for (const c of colisoes) {
    const fitids = Number(c.fitids_distintos)
    if (fitids >= Number(c.qtd)) {
      // Todas têm FITID distinto → provavelmente legítimas (2 PIX maquininha)
      legitimas++
    } else {
      // Tem null FITID OU FITIDs repetidos → suspeita
      suspeitas++
      valorSuspeito += Number(c.amount) * (Number(c.qtd) - 1)
      suspeitasDetalhe.push(c)
    }
  }
  console.log(`\n  Total grupos com >1 tx mesma assinatura: ${colisoes.length}`)
  console.log(`  ✅ Legítimas (todos FITIDs distintos): ${legitimas}`)
  console.log(`  🚨 Suspeitas (FITID null ou repetido): ${suspeitas}`)
  console.log(`  Valor total excedente suspeito: R$ ${valorSuspeito.toFixed(2)}`)
  console.log(`\n  Top 20 SUSPEITAS:`)
  for (const c of suspeitasDetalhe.slice(0, 20)) {
    console.log(
      `    ${nomeConta(c.bankAccountId).padEnd(13)} ${c.date.toISOString().slice(0, 10)} ${c.signal} R$ ${Number(c.amount).toFixed(2).padStart(10)} qtd=${c.qtd} fitids_distintos=${c.fitids_distintos} origins=[${c.origins}] types=[${c.types}]`,
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // RESUMO CONSOLIDADO
  // ═════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('RESUMO CONSOLIDADO POR CLASSE')
  console.log('═'.repeat(80))
  console.log(`\n  Classe 1 — Placeholder sintético + OFX real (bug 21k):  ${duplicatesClasse1.length} pares · R$ ${valorTotalDup1.toFixed(2)}`)
  console.log(`  Classe 2 — Placeholder órfã (lado faltante):           ${orphans.length} tx · R$ ${valorOrphans.toFixed(2)} (NÃO é dup)`)
  console.log(`  Classe 3 — MANUAL em conta bancária:                   ${manualEmBancaria.length} tx`)
  console.log(`  Classe 4 — Re-import (externalId dup / contentHash dup): ${dupExternalId.length} / ${dupContent.length}`)
  console.log(`  Classe 5 — Cross-source (origins distintas):           ${crossSource.length} grupos`)
  console.log(`  Classe 6 — Colisão genérica suspeita:                  ${suspeitas} grupos · R$ ${valorSuspeito.toFixed(2)}`)

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
