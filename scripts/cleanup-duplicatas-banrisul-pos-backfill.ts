// Sprint ContentHash Estável FASE 3 — deleta as 2 órfãs DEBIT PENDING
// (Banrisul 20.300 + 8.000) que duplicam as TRANSFER OUT respectivas.
// NÃO TOCA na R$50 RECARGA TELEFONE (não é duplicata).
//
// CONFIRMED=true pra mutar.

import { PrismaClient } from '@prisma/client'

const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'

const ALVOS: Array<{ id: string; amount: number; ext: string; partnerTransferId: string }> = [
  {
    id: 'cmqhdec7v005onco9ax0wcd0t',
    amount: 20300,
    ext: '540806',
    partnerTransferId: 'cmq5i1tkr0069uwdilr5uc8qs', // TRANSFER OUT pareada (group 1550d4ea)
  },
  {
    id: 'cmqk58d8k0004dfyawdv5iti2',
    amount: 8000,
    ext: '951138',
    partnerTransferId: 'cmqhdec7w006lnco9fmytefa0', // TRANSFER OUT pareada (group 44b87261)
  },
]

const prisma = new PrismaClient()

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`FASE 3 — Deletar 2 órfãs DEBIT duplicadas (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  for (const a of ALVOS) {
    console.log(`\n──── Órfã ${a.id} (R$ ${a.amount}, ext ${a.ext}) ────`)
    const [orfa, transfer] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: a.id } }),
      prisma.transaction.findUnique({ where: { id: a.partnerTransferId } }),
    ])
    if (!orfa) {
      console.log(`  🚨 órfã NÃO encontrada — pulando`)
      continue
    }
    if (!transfer) {
      console.log(`  🚨 TRANSFER pareada referência NÃO encontrada — pulando`)
      continue
    }

    // Safety asserts
    if (orfa.bankAccountId !== BANRISUL) {
      console.log(`  🚨 órfã não é Banrisul — pulando`)
      continue
    }
    if (Math.abs(orfa.amount - a.amount) > 0.01) {
      console.log(`  🚨 amount divergente (${orfa.amount}) — pulando`)
      continue
    }
    if (orfa.type !== 'DEBIT') {
      console.log(`  🚨 órfã não é DEBIT (type=${orfa.type}) — pulando`)
      continue
    }
    if (orfa.transferGroupId !== null) {
      console.log(`  🚨 órfã JÁ TEM transferGroupId — pulando`)
      continue
    }
    if (orfa.externalId !== a.ext) {
      console.log(`  🚨 ext divergente (${orfa.externalId}) — pulando`)
      continue
    }
    if (orfa.contentHash !== transfer.contentHash) {
      console.log(`  🚨 contentHash NÃO bate entre órfã (${orfa.contentHash?.slice(0,12)}) e TRANSFER (${transfer.contentHash?.slice(0,12)}) — pulando`)
      continue
    }
    if (transfer.type !== 'TRANSFER' || !transfer.transferGroupId) {
      console.log(`  🚨 TRANSFER pareada não é TRANSFER ou sem groupId — pulando`)
      continue
    }

    console.log(`  Órfã:     ${orfa.id} type=${orfa.type} ext=${orfa.externalId} status=${orfa.status} hash=${orfa.contentHash?.slice(0,12)} importId=${orfa.importId?.slice(0,8)}`)
    console.log(`  TRANSFER: ${transfer.id} type=${transfer.type} dir=${transfer.transferDirection} group=${transfer.transferGroupId?.slice(0,8)} hash=${transfer.contentHash?.slice(0,12)}`)
    console.log(`  PROPOSTA: revert saldo (+${a.amount}) + tombstone ledger + DELETE órfã`)

    if (!confirmed) {
      console.log(`  ⏸ DRY-RUN — não aplicado`)
      continue
    }

    await prisma.$transaction(async (db) => {
      // 1) Reverte impacto da órfã no saldo: DEBIT - significa que saldo
      //    está R$ -amount; deletar reverte +amount.
      await db.bankAccount.update({
        where: { id: BANRISUL },
        data: { balance: { increment: orfa.amount } },
      })
      // 2) Tombstone das identities da órfã (preserva histórico)
      await db.importedIdentity.updateMany({
        where: { transactionId: orfa.id },
        data: { tombstone: true, transactionId: null },
      })
      // 3) Delete órfã
      await db.transaction.delete({ where: { id: orfa.id } })
    })

    const verify = await prisma.transaction.findUnique({ where: { id: a.id } })
    console.log(`  ✅ órfã deletada (verify: ${verify === null ? 'OK' : 'FALHOU'})`)
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log(confirmed ? 'FASE 3 APLICADA.' : 'DRY-RUN — nada foi mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
