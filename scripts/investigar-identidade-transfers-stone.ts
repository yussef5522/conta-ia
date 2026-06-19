// INVESTIGAÇÃO READ-ONLY (18/06/2026)
// Hipótese Yussef: lado-DESTINO das transferências internas Cacula guardou
// a descrição/FITID da ORIGEM em vez do próprio do OFX -> contentHash não
// bate -> gate marca como nova no re-import.
//
// Extrato Stone (lei) — UMA SÓ de cada, com memo "YUSSEF ABU ZAHRY MUSA - Transferencia Pix":
//   +8000  08/06 FITID 4cc5c61a
//   +650   09/06 FITID 0715d8f1
//   +34000 08/06 FITID 89a8dfbf
//   +1100  09/06 FITID 14d500c7
//
// NÃO MUTA NADA.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const STONE = 'cmq182qfr0005aktn6q2ugpv2'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const BANCO_CAIXA = 'cmq2objjg0005y2fald7auroi'

// FITIDs reais do extrato Stone 06/2026 (fornecidos pelo Yussef)
const FITIDS_EXTRATO_STONE: Array<{
  fitid: string
  amount: number
  date: string
  memo: string
}> = [
  { fitid: '4cc5c61a', amount: 8000, date: '2026-06-08', memo: 'YUSSEF ABU ZAHRY MUSA - Transferencia Pix' },
  { fitid: '0715d8f1', amount: 650, date: '2026-06-09', memo: 'YUSSEF ABU ZAHRY MUSA - Transferencia Pix' },
  { fitid: '89a8dfbf', amount: 34000, date: '2026-06-08', memo: 'YUSSEF ABU ZAHRY MUSA - Transferencia Pix' },
  { fitid: '14d500c7', amount: 1100, date: '2026-06-09', memo: 'YUSSEF ABU ZAHRY MUSA - Transferencia Pix' },
]

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
  console.log('INVESTIGAÇÃO IDENTIDADE — transferências internas Stone (READ-ONLY)')
  console.log('━'.repeat(80))

  // ─────────────────────────────────────────────────────
  // 1) Registro completo das 2 tx específicas + suas contrapartes
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 1) Registro completo: cmq5i5001 (+8000) e cmq8rfym8 (+650) ━━')

  for (const id of ['cmq5i5001006puwdidvfgtlbg', 'cmq8rfym80003hzknpsv5k0vr']) {
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        bankAccountId: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        externalId: true,
        fitidKey: true,
        contentHash: true,
        transferGroupId: true,
        transferDirection: true,
        origin: true,
        importId: true,
      },
    })
    if (!tx) {
      console.log(`\n  ${id}: NÃO EXISTE`)
      continue
    }
    console.log(`\n  ${tx.id}`)
    console.log(`    conta=${nomeConta(tx.bankAccountId)} (${tx.bankAccountId})`)
    console.log(`    type=${tx.type} amount=R$ ${tx.amount.toFixed(2)} (positivo = entrada)`)
    console.log(`    date=${tx.date.toISOString().slice(0, 16)}`)
    console.log(`    direction=${tx.transferDirection ?? 'null'}`)
    console.log(`    description (memo cru armazenado): "${tx.description}"`)
    console.log(`    externalId (fitid OFX): "${tx.externalId ?? 'null'}"`)
    console.log(`    fitidKey: ${tx.fitidKey ?? 'null'}`)
    console.log(`    contentHash: ${tx.contentHash ?? 'null'}`)
    console.log(`    groupId=${tx.transferGroupId}`)
    console.log(`    origin=${tx.origin} importId=${tx.importId?.slice(0, 12)}`)

    // Contraparte (outro lado do groupId)
    if (tx.transferGroupId) {
      const outro = await prisma.transaction.findFirst({
        where: {
          transferGroupId: tx.transferGroupId,
          id: { not: tx.id },
        },
        select: {
          id: true,
          bankAccountId: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          externalId: true,
          fitidKey: true,
          contentHash: true,
          transferDirection: true,
        },
      })
      if (outro) {
        console.log(`    PAR (outro lado):`)
        console.log(`      ${outro.id} conta=${nomeConta(outro.bankAccountId)}`)
        console.log(`      direction=${outro.transferDirection ?? 'null'} amount=R$ ${outro.amount.toFixed(2)}`)
        console.log(`      description: "${outro.description}"`)
        console.log(`      externalId: "${outro.externalId ?? 'null'}"`)
        console.log(`      fitidKey: ${outro.fitidKey ?? 'null'}`)
        console.log(`      contentHash: ${outro.contentHash ?? 'null'}`)
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // 2) Padrão geral: TODAS as transferências TRANSFER do Stone
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 2) Padrão geral: TODAS tx TRANSFER do Stone (lado IN/destino) ━━')
  const transfersStone = await prisma.transaction.findMany({
    where: {
      bankAccountId: STONE,
      type: 'TRANSFER',
    },
    select: {
      id: true,
      amount: true,
      date: true,
      description: true,
      externalId: true,
      fitidKey: true,
      contentHash: true,
      transferGroupId: true,
      transferDirection: true,
    },
    orderBy: { date: 'desc' },
  })

  console.log(`  Total tx TRANSFER no Stone: ${transfersStone.length}`)
  console.log(`  Lado IN (entrada / destino): ${transfersStone.filter((t) => t.transferDirection === 'IN').length}`)
  console.log(`  Lado OUT (saída / origem): ${transfersStone.filter((t) => t.transferDirection === 'OUT').length}`)
  console.log(`  null direction: ${transfersStone.filter((t) => t.transferDirection === null).length}`)

  console.log(`\n  Top 20 (recent first) — coluna "Origem do memo":`)
  console.log(`  ${'date'.padEnd(11)} ${'amt'.padStart(9)} ${'dir'.padStart(4)} ${'externalId'.padEnd(14)} memo (~40c)`)
  for (const t of transfersStone.slice(0, 20)) {
    const hint =
      t.description.includes('YUSSEF') || t.description.toLowerCase().includes('transferência')
        ? 'STONE-própria'
        : t.description.includes('PIX ENVIADO')
          ? '🚨 BANRISUL'
          : t.description.includes('PAGAMENTO PIX-PIX_DEB') || t.description.includes('CACULA MIX')
            ? '🚨 SICREDI'
            : '?'
    console.log(
      `  ${t.date.toISOString().slice(0, 10)} ${t.amount.toFixed(2).padStart(9)} ${(t.transferDirection ?? '-').padStart(4)} ${(t.externalId ?? 'null').slice(0, 13).padEnd(14)} "${t.description.slice(0, 40)}" [${hint}]`,
    )
  }

  // ─────────────────────────────────────────────────────
  // 3) Para CADA FITID do extrato Stone real, calcular contentHash esperado
  //    do re-import e verificar quantas batem
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 3) DRY-RUN simulado: re-import dos 4 FITIDs reais do extrato ━━')
  console.log(`  Para cada FITID do extrato, calculo a identidade que o gate veria`)
  console.log(`  e busco se já existe no DB.\n`)

  for (const linha of FITIDS_EXTRATO_STONE) {
    const ident = computeIdentity({
      accountId: STONE,
      fitid: linha.fitid,
      date: linha.date,
      amount: linha.amount,
      type: 'CREDIT', // Stone OFX exporta como CREDIT (entrada)
      memo: linha.memo,
    })

    console.log(`  📄 FITID=${linha.fitid} R$ ${linha.amount} ${linha.date}`)
    console.log(`     memo: "${linha.memo}"`)
    console.log(`     contentHash do extrato: ${ident.contentHash.slice(0, 16)}`)
    console.log(`     fitidKey do extrato: ${ident.fitidKey?.slice(0, 16) ?? 'null (curto)'} (confiavel=${ident.parts.fitidConfiavel})`)

    // 3.1: existe tx Stone com mesmo externalId (FITID)?
    const porExternalId = await prisma.transaction.count({
      where: { bankAccountId: STONE, externalId: linha.fitid },
    })
    // 3.2: existe tx Stone com mesmo contentHash?
    const porContent = await prisma.transaction.count({
      where: { bankAccountId: STONE, contentHash: ident.contentHash },
    })
    // 3.3: existe entry imported_identities com mesmo contentHash?
    const porIdent = await prisma.importedIdentity.count({
      where: { bankAccountId: STONE, contentHash: ident.contentHash, tombstone: false },
    })
    // 3.4: existe tx Stone com mesmo valor/data (independente de descrição)?
    const dateStart = new Date(linha.date + 'T00:00:00.000Z')
    const dateEnd = new Date(linha.date + 'T23:59:59.999Z')
    const porValorData = await prisma.transaction.findMany({
      where: {
        bankAccountId: STONE,
        amount: linha.amount,
        date: { gte: dateStart, lte: dateEnd },
      },
      select: { id: true, type: true, description: true, externalId: true, contentHash: true, transferDirection: true },
    })

    console.log(`     → existe tx Stone com mesmo externalId="${linha.fitid}": ${porExternalId}`)
    console.log(`     → existe tx Stone com mesmo contentHash: ${porContent}`)
    console.log(`     → ledger imported_identities com mesmo contentHash: ${porIdent}`)
    console.log(`     → existe tx Stone com mesmo valor+data (qualquer desc): ${porValorData.length}`)
    for (const t of porValorData) {
      console.log(
        `         · ${t.id} ${t.type} ${t.transferDirection ?? '-'} ext="${(t.externalId ?? 'null').slice(0, 12)}" hash=${t.contentHash?.slice(0, 12) ?? 'null'} desc="${t.description.slice(0, 50)}"`,
      )
    }
    // VEREDICTO
    const seriaNova = porContent === 0 && porIdent === 0
    console.log(`     ${seriaNova ? '🚨 GATE marcaria como NOVA (duplicação!)' : '✅ gate dropa (idempotente)'}`)
    console.log('')
  }

  // ─────────────────────────────────────────────────────
  // 4) Soma viva do Stone — conta esses 2 ids?
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 4) Soma viva do Stone — confirmar que essas 4 tx estão lá ━━')
  const txsEsperadas = [
    { id: 'cmq5i5001006puwdidvfgtlbg', amount: 8000, descricao: '+8000 06/08' },
    { id: 'cmq8rfym80003hzknpsv5k0vr', amount: 650, descricao: '+650 06/09' },
    { id: 'cmqhdfbky00jenco9c97gz00i', amount: 34000, descricao: '+34000 06/08 par 67d01c12' },
    { id: 'cmqhdfbky00jcnco96xc9kzp1', amount: 1100, descricao: '+1100 06/09 par 5287daa8' },
  ]
  for (const e of txsEsperadas) {
    const t = await prisma.transaction.findUnique({
      where: { id: e.id },
      select: { id: true, bankAccountId: true, type: true, amount: true, date: true, description: true },
    })
    if (!t) {
      console.log(`  ${e.descricao} (${e.id}): NÃO EXISTE`)
      continue
    }
    console.log(
      `  ${e.descricao} ${nomeConta(t.bankAccountId)} ${t.type} R$ ${t.amount} ${t.date.toISOString().slice(0, 10)} ✓ desc="${t.description.slice(0, 35)}"`,
    )
  }

  // Soma signed Stone
  const sumStone = await prisma.$queryRaw<Array<{ signed_sum: number; tx_count: bigint }>>`
    SELECT
      COALESCE(SUM(CASE
        WHEN type='CREDIT' THEN amount
        WHEN type='DEBIT' THEN -amount
        WHEN type='TRANSFER' THEN amount
        ELSE 0 END), 0) AS signed_sum,
      COUNT(*) AS tx_count
    FROM transactions
    WHERE "bankAccountId" = ${STONE}
  `
  console.log(`\n  Soma signed Stone (todas tx vivas): R$ ${Number(sumStone[0].signed_sum).toFixed(2)} (${sumStone[0].tx_count} tx)`)
  console.log(`  Inclusas as 4 acima: R$ ${(8000 + 650 + 34000 + 1100).toFixed(2)} = R$ 43.750,00`)

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
