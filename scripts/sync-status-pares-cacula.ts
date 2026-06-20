// Sprint Transfer Display+Sync FASE 2 — sincroniza status dos pares Cacula
// + limpa categoryId set nas TRANSFER (viola invariante).
// CONFIRMED=true pra mutar.

import { PrismaClient } from '@prisma/client'
import { syncPairStatus } from '../lib/transfers/sync-pair-status'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'

const prisma = new PrismaClient()

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`FASE 2 sync status + invariante (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  // 1) Lista pares divergentes
  const transfers = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      transferGroupId: { not: null },
    },
    select: { id: true, transferGroupId: true, status: true, categoryId: true, type: true, bankAccountId: true },
  })
  const byGroup = new Map<string, typeof transfers>()
  for (const t of transfers) {
    const gid = t.transferGroupId!
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid)!.push(t)
  }

  const divergentes: string[] = []
  for (const [gid, sides] of byGroup) {
    const statuses = new Set(sides.map((s) => s.status))
    if (statuses.size > 1) divergentes.push(gid)
  }

  console.log(`\nPares divergentes: ${divergentes.length}`)
  for (const gid of divergentes) {
    const sides = byGroup.get(gid)!
    console.log(`\n  groupId=${gid.slice(0, 8)}`)
    for (const s of sides) {
      console.log(`    ${s.id} status=${s.status}`)
    }
    if (!confirmed) {
      console.log(`    ⏸ DRY-RUN — não aplicado`)
      continue
    }
    const result = await syncPairStatus(prisma, gid)
    console.log(`    ✅ sync → ${result.canonical} (${result.updated} updated)`)
  }

  // 2) Limpa categoryId set em TRANSFER (invariante: TRANSFER não tem categoria)
  const transfersComCat = transfers.filter((t) => t.categoryId !== null)
  console.log(`\nTRANSFER com categoryId set (viola invariante): ${transfersComCat.length}`)
  for (const t of transfersComCat) {
    console.log(`  ${t.id} categoryId=${t.categoryId}`)
  }
  if (transfersComCat.length > 0) {
    if (!confirmed) {
      console.log(`  ⏸ DRY-RUN — não aplicado`)
    } else {
      const r = await prisma.transaction.updateMany({
        where: { id: { in: transfersComCat.map((t) => t.id) } },
        data: { categoryId: null, classifiedByRuleId: null },
      })
      console.log(`  ✅ ${r.count} TRANSFER com categoria limpa`)
    }
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log(confirmed ? 'FASE 2 APLICADA.' : 'DRY-RUN — nada foi mutado.')
}

main().catch((e) => { console.error(e); process.exit(1) })
