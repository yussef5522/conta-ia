// Lista os 7 grupos REVISAR_MANUAL (importIds iguais) pra inspeção
import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
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
      importId: true,
      createdAt: true,
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const groups = new Map<string, typeof txs>()
  for (const t of txs) {
    if (!t.bankAccountId) continue
    const id = computeIdentity({
      accountId: t.bankAccountId,
      fitid: t.externalId,
      date: t.date,
      amount: t.amount,
      type: t.type,
      memo: t.description,
    })
    let g = groups.get(id.contentHash)
    if (!g) {
      g = []
      groups.set(id.contentHash, g)
    }
    g.push(t)
  }

  const revisar: Array<typeof txs> = []
  for (const [, g] of groups) {
    if (g.length < 2) continue
    const importIds = new Set(g.map((t) => t.importId))
    if (importIds.size === 1) revisar.push(g)
  }
  console.log(`Total REVISAR_MANUAL: ${revisar.length}`)
  for (const [i, g] of revisar.entries()) {
    console.log(`\n[${i + 1}] ${g[0].date.toISOString().slice(0, 10)} R$ ${g[0].amount} "${g[0].description.slice(0, 60)}"`)
    for (const t of g) {
      console.log(`    ${t.id} [${t.type}] ${t.category?.dreGroup ?? '-'} · ${t.category?.name ?? '-'} · importId=${t.importId?.slice(0, 8) ?? 'null'} ext=${t.externalId?.slice(0, 12)}`)
    }
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
