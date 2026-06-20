// Sprint ContentHash Estável FASE 2 — recomputa contentHash de TODAS as tx
// type=TRANSFER (regra nova) + sincroniza ImportedIdentity.
// READ-ONLY por default (--confirmed=true pra mutar).
//
// Garantia: tx CREDIT/DEBIT NÃO mudam (sanity check rodado dentro).

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

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
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`FASE 2 — Backfill contentHash TRANSFER (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  // 1) Sanity check: CREDIT/DEBIT não mudam de hash
  console.log('\n━━ Sanity check: CREDIT/DEBIT mantêm hash ━━')
  const amostraDC = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      type: { in: ['CREDIT', 'DEBIT'] },
      contentHash: { not: null },
    },
    select: {
      id: true, bankAccountId: true, type: true, amount: true, date: true,
      description: true, externalId: true, contentHash: true,
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  })
  let semMudanca = 0, mudou = 0
  for (const t of amostraDC) {
    const novo = computeIdentity({
      accountId: t.bankAccountId!,
      fitid: t.externalId,
      date: t.date,
      amount: t.amount,
      type: t.type,
      memo: t.description,
    })
    if (novo.contentHash === t.contentHash) semMudanca++
    else mudou++
  }
  console.log(`  Amostra 50 CREDIT/DEBIT: ${semMudanca} sem mudança / ${mudou} mudou`)
  if (mudou > 0) {
    console.error(`  🚨 ABORTANDO — DEBIT/CREDIT mudou (não deveria). Sprint mal feita.`)
    process.exit(1)
  }

  // 2) Lista todas tx TRANSFER + recomputa
  console.log('\n━━ TRANSFERs: recomputa hash ━━')
  const transfers = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      type: 'TRANSFER',
    },
    select: {
      id: true, bankAccountId: true, type: true, amount: true, date: true,
      description: true, externalId: true, contentHash: true, fitidKey: true,
      transferDirection: true, transferGroupId: true,
    },
  })
  console.log(`  Total TRANSFER da Cacula: ${transfers.length}`)

  let updates = 0
  const exemplosMudados: Array<{ id: string; antes: string | null; depois: string; conta: string; dir: string | null }> = []
  for (const t of transfers) {
    const novo = computeIdentity({
      accountId: t.bankAccountId!,
      fitid: t.externalId,
      date: t.date,
      amount: t.amount,
      type: 'TRANSFER',
      transferDirection: t.transferDirection as 'IN' | 'OUT' | null,
      memo: t.description,
    })
    if (novo.contentHash === t.contentHash) continue
    updates++
    if (exemplosMudados.length < 10) {
      exemplosMudados.push({
        id: t.id,
        antes: t.contentHash,
        depois: novo.contentHash,
        conta: nome[t.bankAccountId ?? ''] ?? '-',
        dir: t.transferDirection,
      })
    }
    if (!confirmed) continue
    // Aplica: UPDATE tx + ImportedIdentity entries
    await prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: t.id },
        data: { contentHash: novo.contentHash, fitidKey: novo.fitidKey },
      })
      await db.importedIdentity.updateMany({
        where: { transactionId: t.id },
        data: { contentHash: novo.contentHash, fitidKey: novo.fitidKey },
      })
    })
  }
  console.log(`\n  TRANSFER c/ hash mudado: ${updates}/${transfers.length}`)
  console.log(`  Exemplos (primeiros 10):`)
  for (const e of exemplosMudados) {
    console.log(`    ${e.conta.padEnd(13)} dir=${(e.dir ?? '-').padStart(4)} ${e.id} ${e.antes?.slice(0,12) ?? 'null'} -> ${e.depois.slice(0,12)}`)
  }

  // 3) Verifica colisão entre TRANSFER (recomputado) e DEBIT/CREDIT existentes
  // — vai mostrar quantas tx duplicatas Banrisul agora batem contentHash
  if (confirmed) {
    console.log('\n━━ Pós-backfill: verificando colisões esperadas (duplicatas detectadas) ━━')
    const duplicacoes = await prisma.$queryRaw<
      Array<{ bankAccountId: string; contentHash: string; qtd: bigint }>
    >`
      SELECT t."bankAccountId", t."contentHash", COUNT(*)::bigint AS qtd
      FROM transactions t
      JOIN bank_accounts ba ON ba.id = t."bankAccountId"
      WHERE ba."companyId" = ${CACULA}
        AND t."contentHash" IS NOT NULL
      GROUP BY t."bankAccountId", t."contentHash"
      HAVING COUNT(*) > 1
    `
    console.log(`  Grupos com mesmo contentHash em mesma conta (>1): ${duplicacoes.length}`)
    for (const d of duplicacoes.slice(0, 30)) {
      const tx = await prisma.transaction.findMany({
        where: { bankAccountId: d.bankAccountId, contentHash: d.contentHash },
        select: { id: true, type: true, transferDirection: true, transferGroupId: true, status: true, amount: true, date: true, externalId: true, description: true },
        take: 5,
      })
      console.log(`\n  ${nome[d.bankAccountId] ?? '-'} hash=${d.contentHash.slice(0, 12)} qtd=${d.qtd}`)
      for (const x of tx) {
        console.log(`    ${x.id} ${x.type} ${x.transferDirection ?? '-'} grp=${x.transferGroupId?.slice(0,8) ?? 'null'} status=${x.status} amount=${x.amount} date=${x.date.toISOString().slice(0,10)} ext=${x.externalId ?? 'null'} "${x.description.slice(0, 40)}"`)
      }
    }
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log(confirmed ? 'FASE 2 APLICADA.' : 'DRY-RUN — nada foi mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
