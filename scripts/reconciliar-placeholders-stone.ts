// Sprint Reconcile Transfer Identity — FASE A (18/06/2026)
//
// Reconcilia placeholders Stone (TRANSFER IN origin=MANUAL externalId=null)
// que herdaram descrição da origem. UPDATE: externalId + description +
// contentHash + fitidKey. NÃO mexer em amount, date, conta, transferGroupId.
//
// Casos com FITID conhecido (Yussef forneceu):
//   +8000 06/08 → 4cc5c61a-e1b5-4846-bbba-b3d6e66b8faf
//   +650  06/09 → 0715d8f1-beef-4b67-a863-a34097378a7b
//
// Caso sem FITID (só corrige memo):
//   +7400 06/10 → memo correto (externalId fica null; gate dropa via contentHash)
//
// CONFIRMED=true pra mutar.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const STONE = 'cmq182qfr0005aktn6q2ugpv2'
const CACULA = 'cmq17yapb00gnrndlh33sctbo'

const PLACEHOLDERS = [
  {
    id: 'cmq5i5001006puwdidvfgtlbg',
    newExternalId: '4cc5c61a-e1b5-4846-bbba-b3d6e66b8faf',
    newDescription: 'Yussef Abu Zahry Musa - Transferencia | Pix',
    expectedAmount: 8000,
    expectedDate: '2026-06-08',
  },
  {
    id: 'cmq8rfym80003hzknpsv5k0vr',
    newExternalId: '0715d8f1-beef-4b67-a863-a34097378a7b',
    newDescription: 'YUSSEF ABU ZAHRY MUSA - Transferencia | Pix',
    expectedAmount: 650,
    expectedDate: '2026-06-09',
  },
  {
    id: 'cmqbnnzz10004zm5gjkddv3yj',
    newExternalId: null, // FITID não fornecido — gate cairá no contentHash
    newDescription: 'YUSSEF ABU ZAHRY MUSA - Transferencia | Pix',
    expectedAmount: 7400,
    expectedDate: '2026-06-10',
  },
] as const

const prisma = new PrismaClient()

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`FASE A — Reconciliar ${PLACEHOLDERS.length} placeholders Stone (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  for (const ph of PLACEHOLDERS) {
    console.log(`\n──── ${ph.id} (esperado +R$ ${ph.expectedAmount} ${ph.expectedDate}) ────`)
    const before = await prisma.transaction.findUnique({
      where: { id: ph.id },
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
      },
    })
    if (!before) {
      console.log(`  🚨 NÃO ENCONTRADA. pulando.`)
      continue
    }
    // Validação safety
    if (before.bankAccountId !== STONE) {
      console.log(`  🚨 conta diferente de STONE (${before.bankAccountId}). pulando.`)
      continue
    }
    if (Math.abs(before.amount - ph.expectedAmount) > 0.01) {
      console.log(`  🚨 amount divergente (esperado ${ph.expectedAmount}, achou ${before.amount}). pulando.`)
      continue
    }
    if (before.type !== 'TRANSFER' || !before.transferGroupId) {
      console.log(`  🚨 não é TRANSFER com groupId. pulando.`)
      continue
    }

    // ANTES
    console.log(`  ANTES:`)
    console.log(`    description: "${before.description}"`)
    console.log(`    externalId:  ${before.externalId ?? 'null'}`)
    console.log(`    fitidKey:    ${before.fitidKey?.slice(0, 16) ?? 'null'}`)
    console.log(`    contentHash: ${before.contentHash?.slice(0, 16) ?? 'null'}`)

    // Nova identidade
    const newIdent = computeIdentity({
      accountId: STONE,
      fitid: ph.newExternalId,
      date: before.date,
      amount: before.amount,
      type: 'TRANSFER',
      memo: ph.newDescription,
    })

    console.log(`  DEPOIS (proposta):`)
    console.log(`    description: "${ph.newDescription}"`)
    console.log(`    externalId:  ${ph.newExternalId ?? 'null (sem FITID conhecido)'}`)
    console.log(`    fitidKey:    ${newIdent.fitidKey?.slice(0, 16) ?? 'null'} (confiavel=${newIdent.parts.fitidConfiavel})`)
    console.log(`    contentHash: ${newIdent.contentHash.slice(0, 16)}`)

    if (!confirmed) {
      console.log(`  ⏸  dry-run — não aplicado`)
      continue
    }

    // APPLY: atomic update + ledger entry sync
    await prisma.$transaction(async (db) => {
      // 1) Update Transaction
      await db.transaction.update({
        where: { id: before.id },
        data: {
          description: ph.newDescription,
          externalId: ph.newExternalId,
          fitidKey: newIdent.fitidKey,
          contentHash: newIdent.contentHash,
        },
      })

      // 2) imported_identities — atualizar a entry vinculada à essa tx
      //    pra refletir nova identidade. Match por transactionId.
      const existingEntries = await db.importedIdentity.findMany({
        where: { transactionId: before.id, tombstone: false },
        select: { id: true, importBatchId: true },
      })
      if (existingEntries.length === 0) {
        // Não existia entry — criar pra registrar no ledger
        // Precisamos de um importBatchId; busca synthetic batch da conta
        // (criado no backfill anterior) ou cria um se não existir.
        let synthetic = await db.ofxImport.findFirst({
          where: {
            bankAccountId: STONE,
            source: 'MANUAL',
            fileName: '[backfill-pre-sprint-import-idempotente]',
          },
          select: { id: true },
        })
        if (!synthetic) {
          const ucr = await db.userCompany.findFirst({
            where: { companyId: CACULA },
            select: { userId: true },
          })
          if (!ucr) throw new Error('Sem user da Cacula')
          synthetic = await db.ofxImport.create({
            data: {
              bankAccountId: STONE,
              userId: ucr.userId,
              status: 'SUCCESS',
              fileName: '[backfill-pre-sprint-import-idempotente]',
              fileSize: 0,
              totalTransactions: 0,
              source: 'MANUAL',
            },
            select: { id: true },
          })
        }
        await db.importedIdentity.create({
          data: {
            companyId: CACULA,
            bankAccountId: STONE,
            importBatchId: synthetic.id,
            fitidKey: newIdent.fitidKey,
            contentHash: newIdent.contentHash,
            transactionId: before.id,
            tombstone: false,
          },
        })
      } else {
        // Atualiza a primeira (pode ter 1+, mantém todas se for o caso)
        await db.importedIdentity.update({
          where: { id: existingEntries[0].id },
          data: {
            fitidKey: newIdent.fitidKey,
            contentHash: newIdent.contentHash,
          },
        })
        // Se houver mais (não esperado), só atualiza a primeira; resto fica.
      }
    })

    // VERIFY pós-update
    const after = await prisma.transaction.findUnique({
      where: { id: before.id },
      select: {
        description: true,
        externalId: true,
        fitidKey: true,
        contentHash: true,
        amount: true,
        date: true,
        transferGroupId: true,
        type: true,
      },
    })
    const ledger = await prisma.importedIdentity.findMany({
      where: { transactionId: before.id },
      select: { contentHash: true, fitidKey: true, tombstone: true },
    })
    console.log(`  ✅ aplicado. VERIFY:`)
    console.log(`    Tx description=${after!.description} externalId=${after!.externalId}`)
    console.log(`    Tx contentHash=${after!.contentHash?.slice(0, 16)} fitidKey=${after!.fitidKey?.slice(0, 16) ?? 'null'}`)
    console.log(`    Tx amount=${after!.amount} date=${after!.date.toISOString().slice(0, 10)} type=${after!.type} group=${after!.transferGroupId?.slice(0, 8)}`)
    console.log(`    Ledger entries: ${ledger.length}`)
    for (const l of ledger) {
      console.log(`      - contentHash=${l.contentHash.slice(0, 16)} tombstone=${l.tombstone}`)
    }
    // PAR intacto
    const par = await prisma.transaction.findMany({
      where: { transferGroupId: before.transferGroupId! },
      select: { id: true, bankAccountId: true, type: true, amount: true, transferDirection: true },
    })
    console.log(`    Par (groupId): ${par.length} tx`)
    for (const p of par) {
      console.log(`      - ${p.id} ${p.type} ${p.transferDirection} R$ ${p.amount}`)
    }
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log(confirmed ? 'FASE A APLICADA.' : 'DRY-RUN — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
