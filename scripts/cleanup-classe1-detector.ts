// Sprint Detector-No-Sintese FASE 2 — limpa Classe 1 (2 pares)
// DELETE placeholder MANUAL + UPDATE OFX real pra TRANSFER linkada
// CONFIRMED=true pra mutar

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'

interface Caso {
  placeholderId: string
  ofxRealId: string
  amount: number
  date: string
  description: string
  externalId: string
}

const CASOS: Caso[] = [
  {
    placeholderId: 'cmq1e0ceu00mnpm34ewv7hd8t',
    ofxRealId: 'cmqhdec7u005enco9as1h27zz',
    amount: 21000,
    date: '2026-06-01',
    description: 'PIX ENVIADO',
    externalId: '918448',
  },
  {
    placeholderId: 'cmq458kpq001hy2fad009hs7k',
    ofxRealId: 'cmqhdec7u005fnco9nvsu6wko',
    amount: 9100,
    date: '2026-06-03',
    description: 'PIX ENVIADO',
    externalId: '938032',
  },
]

const prisma = new PrismaClient()

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`FASE 2 CLEANUP CLASSE 1 (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  for (const c of CASOS) {
    console.log(`\n──── Par ${c.amount} ${c.date} ────`)
    const [placeholder, ofxReal] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: c.placeholderId } }),
      prisma.transaction.findUnique({ where: { id: c.ofxRealId } }),
    ])
    if (!placeholder) {
      console.log(`  🚨 placeholder ${c.placeholderId} NÃO encontrada — pulando`)
      continue
    }
    if (!ofxReal) {
      console.log(`  🚨 OFX real ${c.ofxRealId} NÃO encontrada — pulando`)
      continue
    }

    // Validações de safety
    if (placeholder.bankAccountId !== BANRISUL || ofxReal.bankAccountId !== BANRISUL) {
      console.log(`  🚨 Conta diferente de BANRISUL — pulando`)
      continue
    }
    if (Math.abs(placeholder.amount - c.amount) > 0.01) {
      console.log(`  🚨 amount placeholder divergente (${placeholder.amount})`)
      continue
    }
    if (Math.abs(ofxReal.amount - c.amount) > 0.01) {
      console.log(`  🚨 amount OFX real divergente (${ofxReal.amount})`)
      continue
    }
    if (placeholder.type !== 'TRANSFER' || !placeholder.transferGroupId) {
      console.log(`  🚨 placeholder não é TRANSFER ou sem groupId — pulando`)
      continue
    }
    if (ofxReal.type !== 'DEBIT' || ofxReal.origin !== 'OFX') {
      console.log(`  🚨 OFX real não é DEBIT/OFX — pulando`)
      continue
    }
    if (ofxReal.transferGroupId !== null) {
      console.log(`  🚨 OFX real já pareada (group=${ofxReal.transferGroupId}) — pulando`)
      continue
    }

    console.log(`  ANTES:`)
    console.log(`    placeholder ${placeholder.id} MANUAL TRANSFER OUT group=${placeholder.transferGroupId?.slice(0, 8)} desc="${placeholder.description.slice(0, 40)}"`)
    console.log(`    OFX real    ${ofxReal.id} OFX DEBIT ext=${ofxReal.externalId} status=${ofxReal.status} desc="${ofxReal.description.slice(0, 40)}"`)

    // Identidade nova: OFX real promovido a TRANSFER
    const newIdent = computeIdentity({
      accountId: BANRISUL,
      fitid: ofxReal.externalId,
      date: ofxReal.date,
      amount: ofxReal.amount,
      type: 'TRANSFER',
      memo: ofxReal.description,
    })

    console.log(`  PROPOSTA:`)
    console.log(`    DELETE placeholder ${placeholder.id}`)
    console.log(`    UPDATE ${ofxReal.id} -> type=TRANSFER, transferGroupId=${placeholder.transferGroupId?.slice(0, 8)}, direction=OUT, status=RECONCILED, contentHash=${newIdent.contentHash.slice(0, 16)}`)

    if (!confirmed) {
      console.log(`  ⏸  dry-run — não aplicado`)
      continue
    }

    // Atomic: revert saldo do delete + delete placeholder + update OFX real
    //   placeholder TRANSFER OUT: amount sai do saldo (negativo) → delete reverte (positivo)
    //   OFX real DEBIT: amount sai do saldo (negativo) → vira TRANSFER OUT (mantém negativo)
    //   Saldo final: 0 mudança (cancela-se)
    // Atualizar ledger ImportedIdentity também:
    //   - placeholder pode ter entry: deletar com tombstone
    //   - OFX real pode ter entry: atualizar com nova contentHash
    await prisma.$transaction(async (db) => {
      // 1) Reverte saldo do placeholder (que será deletado)
      await db.bankAccount.update({
        where: { id: BANRISUL },
        data: { balance: { increment: placeholder.amount } }, // delete OUT reverte +
      })
      // 2) Limpa ImportedIdentity do placeholder (tombstone)
      await db.importedIdentity.updateMany({
        where: { transactionId: placeholder.id },
        data: { tombstone: true, transactionId: null },
      })
      // 3) Delete placeholder
      await db.transaction.delete({ where: { id: placeholder.id } })
      // 4) UPDATE OFX real → TRANSFER linkada
      await db.transaction.update({
        where: { id: ofxReal.id },
        data: {
          type: 'TRANSFER',
          transferGroupId: placeholder.transferGroupId!,
          transferDirection: 'OUT',
          status: 'RECONCILED',
          contentHash: newIdent.contentHash,
          fitidKey: newIdent.fitidKey,
          // categoryId removido (TRANSFER não tem categoria)
          categoryId: null,
          classifiedByRuleId: null,
        },
      })
      // 5) Atualiza ImportedIdentity da OFX real com contentHash novo
      await db.importedIdentity.updateMany({
        where: { transactionId: ofxReal.id },
        data: { contentHash: newIdent.contentHash, fitidKey: newIdent.fitidKey, tombstone: false },
      })
    })

    // Verify
    const after = await prisma.transaction.findUnique({
      where: { id: c.ofxRealId },
      select: {
        type: true, status: true, transferGroupId: true, transferDirection: true,
        externalId: true, description: true,
      },
    })
    console.log(`  ✅ aplicado. VERIFY OFX real:`)
    console.log(`    type=${after?.type} status=${after?.status} dir=${after?.transferDirection} group=${after?.transferGroupId?.slice(0, 8)} ext=${after?.externalId}`)
    const ph = await prisma.transaction.findUnique({ where: { id: c.placeholderId } })
    console.log(`    placeholder deletada: ${ph === null}`)
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log(confirmed ? 'FASE 2 APLICADA.' : 'DRY-RUN — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
