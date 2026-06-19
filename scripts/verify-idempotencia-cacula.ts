// Sprint Import Idempotente — VERIFICAÇÃO READ-ONLY (18/06/2026).
//
// Responde 4 perguntas do Yussef:
//   1) Quantas das 2656 tx existentes têm contentHash/fitidKey?
//   2) Onde o gate Fase 2 consulta? (transactions OU imported_identities?)
//   3) Dry-run simulado: reimportar Sicredi 01-18/06 daria quantas novas?
//   4) (relatorio-duplicatas-cacula.ts roda separado)
//
// NÃO MUTA NADA.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'
import { applyIdentityGate } from '../lib/import-identity/apply-gate'
import { loadLedgerState } from '../lib/import-identity/ledger-queries'

const CACULA_ID = 'cmq17yapb00gnrndlh33sctbo'
const SICREDI_ID = 'cmq180ksv0001aktni9wj64mq'
const BANRISUL_ID = 'cmq17z90v00qxrndl02kfn4iz'
const STONE_ID = 'cmq182qfr0005aktn6q2ugpv2'
const PERIODO_INICIO = '2026-06-01'
const PERIODO_FIM = '2026-06-19'

const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('VERIFICAÇÃO IDEMPOTÊNCIA — Cacula Mix (READ-ONLY)')
  console.log('━'.repeat(80))

  // ─────────────────────────────────────────────────────
  // 1) BACKFILL: contentHash/fitidKey preenchidos?
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 1) BACKFILL: das 2656 tx existentes da Cacula ━━')
  const totals = await prisma.$queryRaw<
    Array<{
      total: bigint
      com_contenthash: bigint
      com_fitidkey: bigint
      com_dedupHash: bigint
    }>
  >`
    SELECT
      COUNT(*) AS total,
      COUNT("contentHash") AS com_contenthash,
      COUNT("fitidKey") AS com_fitidkey,
      COUNT("dedupHash") AS "com_dedupHash"
    FROM transactions t
    JOIN bank_accounts b ON b.id = t."bankAccountId"
    WHERE b."companyId" = ${CACULA_ID}
  `
  const t = totals[0]
  console.log(`  Total tx (todas contas Cacula):       ${t.total}`)
  console.log(`  Com dedupHash legacy preenchido:      ${t.com_dedupHash}`)
  console.log(`  Com contentHash (Sprint Idempot):     ${t.com_contenthash}`)
  console.log(`  Com fitidKey (Sprint Idempot):        ${t.com_fitidkey}`)

  // imported_identities
  const ii = await prisma.importedIdentity.count({
    where: { companyId: CACULA_ID },
  })
  console.log(`  Entradas em imported_identities:      ${ii}`)

  if (Number(t.com_contenthash) === 0) {
    console.log(
      '\n  🚨 DIAGNÓSTICO: contentHash=0 nas 2656 tx existentes.',
    )
    console.log('     -> Backfill da Fase 1 NÃO rodou nos dados antigos.')
    console.log('     -> Gate Fase 2 consultaria imported_identities (=0 entries).')
    console.log('     -> Reimport hoje sobre extrato existente NÃO seria barrado')
    console.log('        pelo gate de identidade canônica.')
    console.log('     -> Defesa restante: @@unique([bankAccountId, dedupHash])')
    console.log('        protege APENAS contra duplicata exata FITID+data+valor+memo')
    console.log('        — vulnerável ao bug Banrisul fitid renumerado.')
  }

  // ─────────────────────────────────────────────────────
  // 2) ONDE O GATE CONSULTA? — explicação direta do código
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 2) Gate Fase 2 consulta ONDE? ━━')
  console.log(`  Função: loadLedgerState() em lib/import-identity/ledger-queries.ts`)
  console.log(`    - prisma.importedIdentity.findMany({ fitidKey: { in: ... } })`)
  console.log(`    - prisma.importedIdentity.groupBy({ contentHash: { in: ... } })`)
  console.log(`  NÃO consulta transactions.fitidKey nem transactions.contentHash.`)
  console.log(``)
  console.log(`  Conclusão: a coluna nova em transactions é só pra RASTRO/AUDITORIA.`)
  console.log(`  A proteção real vem de imported_identities (vazia hoje em prod).`)

  // ─────────────────────────────────────────────────────
  // 3) DRY-RUN: simular reimport Sicredi 01-18/06
  // ─────────────────────────────────────────────────────
  console.log('\n━━ 3) DRY-RUN: simular reimport Sicredi 01-18/06 ━━')
  console.log('  Pega tx Sicredi do período (que JÁ ESTÃO no banco),')
  console.log('  reconstrói o que seria o "incoming" se reimport ocorresse hoje,')
  console.log('  roda applyIdentityGate -> retorna {toInsert, skipped}.\n')

  for (const [conta, id] of [
    ['SICREDI', SICREDI_ID],
    ['BANRISUL', BANRISUL_ID],
    ['STONE', STONE_ID],
  ] as const) {
    const existing = await prisma.transaction.findMany({
      where: {
        bankAccountId: id,
        date: { gte: new Date(PERIODO_INICIO), lt: new Date(PERIODO_FIM) },
        type: { in: ['CREDIT', 'DEBIT'] },
      },
      select: {
        id: true,
        bankAccountId: true,
        date: true,
        type: true,
        amount: true,
        description: true,
        externalId: true,
      },
    })

    if (existing.length === 0) {
      console.log(`  ${conta}: zero tx no período. Skipping.`)
      continue
    }

    // Reconstrói incoming "como se um OFX trouxesse"
    const incomingIdentities = existing.map((tx) => ({
      payload: { txId: tx.id },
      identity: computeIdentity({
        accountId: tx.bankAccountId!,
        fitid: tx.externalId,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        memo: tx.description,
      }),
    }))

    const fitidKeys = incomingIdentities
      .map((i) => i.identity.fitidKey)
      .filter((k): k is string => k !== null)
    const contentHashes = incomingIdentities.map((i) => i.identity.contentHash)

    const ledger = await loadLedgerState(id, fitidKeys, contentHashes)
    const r = applyIdentityGate(incomingIdentities, ledger)

    console.log(`  ${conta} (${existing.length} tx incoming):`)
    console.log(
      `    -> toInsert: ${r.toInsert.length} | skipped: ${r.skipped.length}`,
    )
    console.log(
      `       (fitid: ${r.stats.skippedFitid} | content: ${r.stats.skippedContent})`,
    )
    if (r.toInsert.length > existing.length / 2) {
      console.log(
        `    🚨 ALERTA: ${((r.toInsert.length / existing.length) * 100).toFixed(0)}% passaria como NOVA.`,
      )
      console.log(`       Reimport hoje DUPLICARIA ${r.toInsert.length} tx no Sicredi/Banrisul/Stone.`)
    } else if (r.toInsert.length === 0) {
      console.log(`    ✅ ZERO novas. Idempotência funcionando ${conta === 'STONE' ? '(Stone UUID confiável + ledger)' : ''}`)
    }
  }

  console.log('\n' + '━'.repeat(80))
  console.log('FIM — nada foi mutado.')
  console.log('━'.repeat(80))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
