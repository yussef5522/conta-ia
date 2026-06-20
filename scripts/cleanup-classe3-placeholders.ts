// Sprint Detector-No-Sintese FASE 3 — Cleanup Classe 3:
//   placeholders MANUAL+TRANSFER em conta bancária
//
// Pra cada placeholder:
//   - Busca OFX real correspondente (mesma conta+valor+data±1d, sinal compat, no group)
//   - Achou → "adopt": deleta placeholder + promove OFX a TRANSFER linkada
//   - Sem OFX → mantém como TRANSFER órfã (status=RECONCILED + categoria limpa)
//
// NÃO TOCA os 4 saldos iniciais 31/05 (origin=MANUAL mas type=DEBIT/CREDIT, não TRANSFER).
//
// CONFIRMED=true pra mutar.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const STONE = 'cmq182qfr0005aktn6q2ugpv2'

const CONTAS_BANCARIAS = [BANRISUL, SICREDI, STONE]
const DAY_MS = 86400 * 1000

const prisma = new PrismaClient()

function nome(id: string | null): string {
  if (id === BANRISUL) return 'BANRISUL'
  if (id === SICREDI) return 'SICREDI'
  if (id === STONE) return 'STONE'
  return id?.slice(0, 8) ?? '-'
}

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`FASE 3 — Cleanup Classe 3 (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  // 1) Lista placeholders MANUAL TRANSFER em conta bancária
  const placeholders = await prisma.transaction.findMany({
    where: {
      bankAccountId: { in: CONTAS_BANCARIAS },
      type: 'TRANSFER',
      origin: 'MANUAL',
    },
    select: {
      id: true,
      bankAccountId: true,
      amount: true,
      date: true,
      description: true,
      transferGroupId: true,
      transferDirection: true,
      externalId: true,
      categoryId: true,
      status: true,
    },
    orderBy: { date: 'asc' },
  })

  console.log(`\nTotal placeholders MANUAL TRANSFER em conta bancária: ${placeholders.length}`)
  let adotadas = 0
  let limpasOrfa = 0
  let puladas = 0

  for (const ph of placeholders) {
    console.log(`\n──── ${ph.id} ${nome(ph.bankAccountId)} ${ph.transferDirection ?? '-'} ${ph.date.toISOString().slice(0, 10)} R$ ${ph.amount} ────`)
    console.log(`  desc="${ph.description.slice(0, 60)}" status=${ph.status} categoryId=${ph.categoryId ? 'set' : 'null'} ext=${ph.externalId ?? 'null'}`)

    // 2) Procura OFX real na MESMA conta, mesmo amount, ±1d, type=DEBIT (se OUT) ou CREDIT (se IN), sem groupId
    const wantedOfxType = ph.transferDirection === 'OUT' ? 'DEBIT' : 'CREDIT'
    const ofxReal = await prisma.transaction.findFirst({
      where: {
        bankAccountId: ph.bankAccountId,
        type: wantedOfxType,
        amount: ph.amount,
        origin: 'OFX',
        externalId: { not: null },
        transferGroupId: null,
        date: {
          gte: new Date(ph.date.getTime() - DAY_MS),
          lte: new Date(ph.date.getTime() + DAY_MS),
        },
      },
      select: {
        id: true, type: true, amount: true, date: true, description: true,
        externalId: true, status: true, transferGroupId: true,
      },
    })

    if (ofxReal) {
      console.log(`  ✓ OFX real encontrado: ${ofxReal.id} ${ofxReal.type} ext=${ofxReal.externalId} status=${ofxReal.status} desc="${ofxReal.description.slice(0, 40)}"`)
      console.log(`  PROPOSTA: ADOTAR — delete placeholder + promove OFX a TRANSFER linkada`)
      if (!confirmed) { adotadas++; continue }

      // Aplica adoção
      const newIdent = computeIdentity({
        accountId: ph.bankAccountId!,
        fitid: ofxReal.externalId,
        date: ofxReal.date,
        amount: ofxReal.amount,
        type: 'TRANSFER',
        memo: ofxReal.description,
      })
      await prisma.$transaction(async (db) => {
        // 1) reverte saldo da placeholder
        const placeholderDelta = ph.transferDirection === 'OUT' ? ph.amount : -ph.amount
        await db.bankAccount.update({
          where: { id: ph.bankAccountId! },
          data: { balance: { increment: placeholderDelta } },
        })
        // 2) tombstone identity da placeholder
        await db.importedIdentity.updateMany({
          where: { transactionId: ph.id },
          data: { tombstone: true, transactionId: null },
        })
        // 3) delete placeholder
        await db.transaction.delete({ where: { id: ph.id } })
        // 4) update OFX real para TRANSFER linkada
        await db.transaction.update({
          where: { id: ofxReal.id },
          data: {
            type: 'TRANSFER',
            transferGroupId: ph.transferGroupId!,
            transferDirection: ph.transferDirection,
            status: 'RECONCILED',
            contentHash: newIdent.contentHash,
            fitidKey: newIdent.fitidKey,
            categoryId: null,
            classifiedByRuleId: null,
          },
        })
        // 5) update ImportedIdentity da OFX real
        await db.importedIdentity.updateMany({
          where: { transactionId: ofxReal.id },
          data: { contentHash: newIdent.contentHash, fitidKey: newIdent.fitidKey, tombstone: false },
        })
      })
      console.log(`  ✅ adotada`)
      adotadas++
      continue
    }

    // 3) Sem OFX real → mantém como TRANSFER órfã, mas limpa categoria e seta RECONCILED
    const needsUpdate =
      ph.status !== 'RECONCILED' || ph.categoryId !== null
    if (!needsUpdate) {
      console.log(`  ↪ órfã já limpa (status=RECONCILED + categoryId=null) — sem mudança`)
      puladas++
      continue
    }
    console.log(`  ↪ ÓRFÃ — manter como TRANSFER pendente do outro extrato`)
    console.log(`     PROPOSTA: status -> RECONCILED, categoryId -> null`)
    if (!confirmed) { limpasOrfa++; continue }
    await prisma.transaction.update({
      where: { id: ph.id },
      data: { status: 'RECONCILED', categoryId: null, classifiedByRuleId: null },
    })
    console.log(`  ✅ órfã limpa`)
    limpasOrfa++
  }

  console.log('\n' + '━'.repeat(80))
  console.log(`RESUMO: adotadas=${adotadas} limpas-órfãs=${limpasOrfa} sem-mudança=${puladas}`)
  console.log(confirmed ? 'FASE 3 APLICADA.' : 'DRY-RUN — nada foi mutado.')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
