// READ-ONLY — diagnóstico das 3 tx PIX 15/06 categoria "Contabilidade"
// R$ 25.000, R$ 9.000, R$ 5.000 desc PIX-PIX_DEB 60025889060 YUSSEF ABU ZAHRY MUSA
// Rastro: origin / FITID / import / dedup / pareamento / saldo do dia

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
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
  console.log('DIAGNÓSTICO 3 PIX YUSSEF 15/06/2026 — origem real?')
  console.log('━'.repeat(80))

  const dataIni = new Date('2026-06-15T00:00:00.000Z')
  const dataFim = new Date('2026-06-15T23:59:59.999Z')

  // Localiza as 3
  const tres = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      date: { gte: dataIni, lte: dataFim },
      type: 'DEBIT',
      amount: { in: [25000, 9000, 5000] },
      description: { contains: 'YUSSEF' },
    },
    select: {
      id: true,
      bankAccountId: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      externalId: true,
      contentHash: true,
      dedupHash: true,
      fitidKey: true,
      origin: true,
      importId: true,
      categoryId: true,
      transferGroupId: true,
      transferDirection: true,
      status: true,
      lifecycle: true,
      createdAt: true,
      updatedAt: true,
      reconciledWithId: true,
      classificationSource: true,
      classifiedByRuleId: true,
      category: { select: { name: true, dreGroup: true } },
      bankAccount: { select: { name: true } },
      ofxImport: { select: { id: true, fileName: true, fileHash: true, fileSize: true, periodStart: true, periodEnd: true, createdAt: true, status: true, userId: true } },
    },
    orderBy: { amount: 'desc' },
  })

  console.log(`\n  Encontradas: ${tres.length} tx\n`)

  for (const [i, t] of tres.entries()) {
    console.log('━'.repeat(80))
    console.log(`[${i + 1}/${tres.length}] R$ ${t.amount.toFixed(2)} — id ${t.id}`)
    console.log('━'.repeat(80))

    console.log(`  conta:               ${nome[t.bankAccountId ?? ''] ?? '-'} (${t.bankAccountId})`)
    console.log(`  type:                ${t.type}`)
    console.log(`  date:                ${t.date.toISOString()}`)
    console.log(`  description:         "${t.description}"`)
    console.log(`  amount:              R$ ${t.amount.toFixed(2)}`)
    console.log(`  origin:              ${t.origin}`)
    console.log(`  externalId (FITID):  ${t.externalId ?? 'null'}`)
    console.log(`  importId:            ${t.importId ?? 'null'}`)
    console.log(`  status:              ${t.status}`)
    console.log(`  lifecycle:           ${t.lifecycle}`)
    console.log(`  categoryId:          ${t.categoryId ?? 'null'}`)
    console.log(`  category:            ${t.category?.name ?? 'null'} (dreGroup=${t.category?.dreGroup ?? '-'})`)
    console.log(`  classificationSource: ${t.classificationSource ?? 'null'}`)
    console.log(`  classifiedByRuleId:  ${t.classifiedByRuleId ?? 'null'}`)
    console.log(`  transferGroupId:     ${t.transferGroupId ?? 'null'}`)
    console.log(`  transferDirection:   ${t.transferDirection ?? 'null'}`)
    console.log(`  reconciledWithId:    ${t.reconciledWithId ?? 'null'}`)
    console.log(`  contentHash:         ${t.contentHash?.slice(0, 24) ?? 'null'}`)
    console.log(`  dedupHash:           ${t.dedupHash?.slice(0, 24) ?? 'null'}`)
    console.log(`  fitidKey:            ${t.fitidKey?.slice(0, 24) ?? 'null'}`)
    console.log(`  createdAt:           ${t.createdAt.toISOString()}`)
    console.log(`  updatedAt:           ${t.updatedAt.toISOString()}`)

    if (t.ofxImport) {
      console.log(`\n  📄 OfxImport (extrato origem):`)
      console.log(`     id:           ${t.ofxImport.id}`)
      console.log(`     fileName:     "${t.ofxImport.fileName}"`)
      console.log(`     fileHash:     ${t.ofxImport.fileHash?.slice(0, 32) ?? 'null'}`)
      console.log(`     fileSize:     ${t.ofxImport.fileSize} bytes`)
      console.log(`     periodStart:  ${t.ofxImport.periodStart?.toISOString().slice(0, 10) ?? 'null'}`)
      console.log(`     periodEnd:    ${t.ofxImport.periodEnd?.toISOString().slice(0, 10) ?? 'null'}`)
      console.log(`     createdAt:    ${t.ofxImport.createdAt.toISOString()}`)
      console.log(`     status:       ${t.ofxImport.status}`)
      console.log(`     userId:       ${t.ofxImport.userId}`)
    } else {
      console.log(`\n  📄 OfxImport: null (tx NÃO veio de import OFX rastreado)`)
    }

    // 4) Outras tx com mesmo valor+data (qualquer conta)
    console.log(`\n  🔍 Outras tx com mesmo valor+data (qualquer conta da Cacula):`)
    const mesmas = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: CACULA },
        amount: t.amount,
        date: { gte: dataIni, lte: dataFim },
        id: { not: t.id },
      },
      select: {
        id: true, bankAccountId: true, type: true, amount: true, date: true,
        externalId: true, origin: true, transferGroupId: true, transferDirection: true,
        description: true, importId: true,
        bankAccount: { select: { name: true } },
      },
    })
    if (mesmas.length === 0) {
      console.log(`     (nenhuma) — não há contraparte de transferência cross-account`)
    } else {
      for (const m of mesmas) {
        console.log(`     · ${m.id} ${nome[m.bankAccountId ?? '']} ${m.type} ${m.transferDirection ?? '-'} R$ ${m.amount} ext=${m.externalId ?? 'null'} origin=${m.origin} group=${m.transferGroupId?.slice(0, 8) ?? 'null'} "${m.description.slice(0, 50)}"`)
      }
    }

    // 5) Já tem ImportedIdentity?
    const idents = await prisma.importedIdentity.findMany({
      where: { transactionId: t.id },
      select: { id: true, contentHash: true, fitidKey: true, tombstone: true, importBatchId: true, createdAt: true },
    })
    console.log(`\n  📑 ImportedIdentity entries: ${idents.length}`)
    for (const id of idents) {
      console.log(`     · ${id.id} batch=${id.importBatchId.slice(0, 8)} content=${id.contentHash.slice(0, 16)} fitidKey=${id.fitidKey?.slice(0, 16) ?? 'null'} tomb=${id.tombstone} createdAt=${id.createdAt.toISOString().slice(0, 16)}`)
    }
  }

  // ─────────────────────────────────────────────────────
  // 6) Soma DEBITs do dia 15/06 vs LEDGERBAL
  // ─────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(80))
  console.log('6) DEBITs 15/06 por conta — bate com extrato real?')
  console.log('━'.repeat(80))

  // Conta de origem das 3 (provavelmente Sicredi — "PAGAMENTO PIX-PIX_DEB" é padrão Sicredi)
  const contasInvestigar = Array.from(new Set(tres.map((t) => t.bankAccountId).filter(Boolean))) as string[]
  for (const accId of contasInvestigar) {
    console.log(`\n  ━━ ${nome[accId] ?? accId} ━━`)
    const todasDoDia = await prisma.transaction.findMany({
      where: {
        bankAccountId: accId,
        date: { gte: dataIni, lte: dataFim },
      },
      select: {
        id: true, type: true, amount: true, description: true, externalId: true,
        origin: true, transferGroupId: true, transferDirection: true,
        importId: true, status: true,
      },
      orderBy: [{ type: 'asc' }, { amount: 'desc' }],
    })

    let sumCredit = 0, sumDebit = 0, sumTransferIn = 0, sumTransferOut = 0
    console.log(`  Total tx do dia: ${todasDoDia.length}`)
    console.log(`\n  DEBITs (saídas):`)
    for (const t of todasDoDia.filter((x) => x.type === 'DEBIT')) {
      sumDebit += t.amount
      console.log(`    · R$ ${t.amount.toFixed(2).padStart(10)} ext=${(t.externalId ?? 'null').padEnd(8)} origin=${t.origin.padEnd(8)} grp=${t.transferGroupId?.slice(0,8) ?? '-'.padEnd(8)} "${t.description.slice(0,50)}"`)
    }
    console.log(`\n  CREDITs (entradas):`)
    for (const t of todasDoDia.filter((x) => x.type === 'CREDIT')) {
      sumCredit += t.amount
      console.log(`    · R$ ${t.amount.toFixed(2).padStart(10)} ext=${(t.externalId ?? 'null').padEnd(8)} origin=${t.origin.padEnd(8)} "${t.description.slice(0,50)}"`)
    }
    const transfers = todasDoDia.filter((x) => x.type === 'TRANSFER')
    if (transfers.length > 0) {
      console.log(`\n  TRANSFERs:`)
      for (const t of transfers) {
        if (t.transferDirection === 'IN') sumTransferIn += t.amount
        else if (t.transferDirection === 'OUT') sumTransferOut += t.amount
        console.log(`    · R$ ${t.amount.toFixed(2).padStart(10)} ${t.transferDirection ?? '-'} ext=${(t.externalId ?? 'null').padEnd(10)} grp=${t.transferGroupId?.slice(0,8)} "${t.description.slice(0,50)}"`)
      }
    }
    console.log(`\n  Σ DEBIT: R$ ${sumDebit.toFixed(2)}`)
    console.log(`  Σ CREDIT: R$ ${sumCredit.toFixed(2)}`)
    console.log(`  Σ TRANSFER OUT: R$ ${sumTransferOut.toFixed(2)}`)
    console.log(`  Σ TRANSFER IN: R$ ${sumTransferIn.toFixed(2)}`)
    console.log(`  Net dia (CREDIT + TIN - DEBIT - TOUT): R$ ${(sumCredit + sumTransferIn - sumDebit - sumTransferOut).toFixed(2)}`)
  }

  // ledgerBal
  console.log('\n  ━━ LEDGERBAL ━━')
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: CACULA },
    select: { id: true, name: true, balance: true, ledgerBal: true, ledgerBalDate: true },
  })
  for (const c of contas) {
    console.log(`  ${c.name.padEnd(20)} balance=R$ ${c.balance.toFixed(2).padStart(12)} ledgerBal=R$ ${(c.ledgerBal ?? 0).toFixed(2).padStart(12)} ledgerBalDate=${c.ledgerBalDate?.toISOString().slice(0,10) ?? 'null'}`)
  }

  // Lista TODOS os imports da conta de origem que cobrem 15/06
  console.log('\n  ━━ Imports OFX cobrindo 15/06 ━━')
  for (const accId of contasInvestigar) {
    const importsCobertura = await prisma.ofxImport.findMany({
      where: {
        bankAccountId: accId,
        status: 'SUCCESS',
        OR: [
          { AND: [{ periodStart: { lte: dataFim } }, { periodEnd: { gte: dataIni } }] },
        ],
      },
      select: {
        id: true, fileName: true, periodStart: true, periodEnd: true,
        totalTransactions: true, newTransactions: true, duplicates: true,
        fileHash: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    console.log(`\n  ${nome[accId]} — ${importsCobertura.length} imports:`)
    for (const imp of importsCobertura) {
      console.log(`    · ${imp.id} "${imp.fileName}"`)
      console.log(`        period: ${imp.periodStart?.toISOString().slice(0,10)} → ${imp.periodEnd?.toISOString().slice(0,10)}`)
      console.log(`        total/new/dup: ${imp.totalTransactions}/${imp.newTransactions}/${imp.duplicates}`)
      console.log(`        fileHash: ${imp.fileHash?.slice(0,32) ?? 'null'}`)
      console.log(`        createdAt: ${imp.createdAt.toISOString()}`)
    }
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — read-only, nada mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
