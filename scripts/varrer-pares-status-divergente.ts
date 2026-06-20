// READ-ONLY: lista TODOS os pares transferGroupId com lados em status diferente
// Sprint Transfer Display+Sync FASE 0
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
  console.log('VARREDURA — pares transferGroupId com STATUS DIVERGENTE (READ-ONLY)')
  console.log('━'.repeat(80))

  // Busca todos transferGroupId distintos da Cacula
  const allTransfers = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      transferGroupId: { not: null },
    },
    select: {
      id: true,
      bankAccountId: true,
      transferGroupId: true,
      transferDirection: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      status: true,
      origin: true,
      categoryId: true,
    },
    orderBy: { date: 'asc' },
  })

  // Agrupa por groupId
  const groups = new Map<string, typeof allTransfers>()
  for (const t of allTransfers) {
    const gid = t.transferGroupId!
    if (!groups.has(gid)) groups.set(gid, [])
    groups.get(gid)!.push(t)
  }

  console.log(`\nTotal de pares (transferGroupId distintos): ${groups.size}`)

  // Identifica divergentes
  const divergentes: typeof allTransfers[] = []
  const semPar: typeof allTransfers[] = []
  const orfasComCategoria: typeof allTransfers[] = []
  for (const sides of groups.values()) {
    if (sides.length !== 2) {
      semPar.push(sides)
      continue
    }
    const statuses = new Set(sides.map((s) => s.status))
    if (statuses.size > 1) divergentes.push(sides)
    for (const s of sides) {
      if (s.categoryId !== null) orfasComCategoria.push([s])
    }
  }

  console.log(`\n🚨 Pares com STATUS DIVERGENTE entre os 2 lados: ${divergentes.length}`)
  for (const sides of divergentes) {
    const a = sides[0]
    console.log(`\n  groupId=${a.transferGroupId} ${a.date.toISOString().slice(0, 10)} R$ ${a.amount}`)
    for (const s of sides) {
      console.log(
        `    ${(nome[s.bankAccountId ?? ''] ?? '-').padEnd(13)} ${s.type} ${s.transferDirection ?? '-'} status=${s.status.padEnd(11)} origin=${s.origin.padEnd(12)} cat=${s.categoryId ? 'set' : 'null'} "${s.description.slice(0, 40)}"`,
      )
    }
  }

  console.log(`\n⚠ Grupos com !=2 lados (precisa investigar à parte): ${semPar.length}`)
  for (const sides of semPar) {
    console.log(`  groupId=${sides[0].transferGroupId} (${sides.length} lados)`)
    for (const s of sides) {
      console.log(`    ${nome[s.bankAccountId ?? ''] ?? '-'} ${s.type} ${s.transferDirection ?? '-'} status=${s.status}`)
    }
  }

  console.log(`\n⚠ Lados TRANSFER com categoryId set (não deveria existir): ${orfasComCategoria.length}`)
  for (const sides of orfasComCategoria.slice(0, 20)) {
    const s = sides[0]
    console.log(`  ${s.id} ${nome[s.bankAccountId ?? ''] ?? '-'} ${s.transferDirection ?? '-'} status=${s.status} categoryId=${s.categoryId}`)
  }

  // Distribuição global status x type
  const counts = await prisma.$queryRaw<Array<{ status: string; type: string; qtd: bigint }>>`
    SELECT t.status, t.type, COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t."transferGroupId" IS NOT NULL
    GROUP BY t.status, t.type
    ORDER BY t.status, t.type
  `
  console.log(`\nDistribuição status × type (Cacula, todas tx com transferGroupId):`)
  for (const r of counts) {
    console.log(`  status=${r.status.padEnd(12)} type=${r.type.padEnd(10)} qtd=${r.qtd}`)
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — read-only, nada mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
