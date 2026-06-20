// Investiga os 8 grupos contentHash duplicados (FASE 0) — READ-ONLY
import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'

const nomes: Record<string, string> = {
  'cmq17z90v00qxrndl02kfn4iz': 'BANRISUL',
  'cmq180ksv0001aktni9wj64mq': 'SICREDI',
  'cmq182qfr0005aktn6q2ugpv2': 'STONE',
  'cmq2objjg0005y2fald7auroi': 'BANCO_CAIXA',
  'cmq2o25qe0001y2faydl1yrp5': 'CAIXA_LOJA',
}

const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('INVESTIGAR 8 grupos contentHash duplicados (READ-ONLY)')
  console.log('━'.repeat(80))

  const groups = await prisma.$queryRaw<
    Array<{ bankAccountId: string; contentHash: string; qtd: bigint }>
  >`
    SELECT t."bankAccountId", t."contentHash", COUNT(*)::bigint AS qtd
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${CACULA}
      AND t."contentHash" IS NOT NULL
    GROUP BY t."bankAccountId", t."contentHash"
    HAVING COUNT(*) > 1
    ORDER BY t."bankAccountId"
  `
  console.log(`\nGrupos: ${groups.length}\n`)

  let dupReal = 0
  let legitima = 0
  let valorDupReal = 0

  for (const [i, g] of groups.entries()) {
    const txs = await prisma.transaction.findMany({
      where: {
        bankAccountId: g.bankAccountId,
        contentHash: g.contentHash,
      },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        externalId: true,
        origin: true,
        transferGroupId: true,
        status: true,
        categoryId: true,
        importId: true,
        createdAt: true,
        category: { select: { name: true, dreGroup: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    console.log(`[${i + 1}] ${nomes[g.bankAccountId] ?? g.bankAccountId.slice(0, 12)} hash=${g.contentHash.slice(0, 16)} qtd=${g.qtd}`)
    // Diagnosticar: FITIDs distintos? origins distintos? importIds distintos?
    const fitids = new Set(txs.map((t) => t.externalId))
    const origins = new Set(txs.map((t) => t.origin))
    const importIds = new Set(txs.map((t) => t.importId))
    const value = txs[0].amount

    let diagnostico: string
    let isDup = false
    if (origins.has('IMPORT_EXCEL') && origins.size === 1) {
      diagnostico = '✅ LEGÍTIMA — múltiplos lançamentos Excel sem FITID (caixa físico)'
    } else if (origins.has('MANUAL') && origins.size === 1) {
      diagnostico = '✅ LEGÍTIMA — múltiplos lançamentos manuais (caixa)'
    } else if (origins.size === 1 && origins.has('OFX') && fitids.size === txs.length) {
      diagnostico = '✅ LEGÍTIMA — múltiplas tx OFX com FITIDs distintos (vendas reais iguais)'
    } else if (origins.has('OFX') && origins.has('MANUAL')) {
      diagnostico = '🚨 DUP REAL — mistura OFX + MANUAL (placeholder + OFX real)'
      isDup = true
      valorDupReal += value
    } else if (origins.size === 1 && origins.has('OFX') && fitids.size < txs.length) {
      diagnostico = '🚨 DUP REAL — mesmo OFX importado 2x'
      isDup = true
      valorDupReal += value
    } else {
      diagnostico = '⚠ INVESTIGAR — caso ambíguo'
    }
    if (isDup) dupReal++
    else legitima++

    console.log(`    Diagnóstico: ${diagnostico}`)
    for (const t of txs) {
      console.log(
        `      · ${t.id} ${t.type} ${t.date.toISOString().slice(0, 10)} R$ ${t.amount} ext=${t.externalId ?? 'null'} origin=${t.origin} group=${t.transferGroupId?.slice(0, 8) ?? 'null'} status=${t.status} cat=${t.category?.name ?? '-'} importId=${t.importId?.slice(0, 8) ?? 'null'} createdAt=${t.createdAt.toISOString().slice(0, 16)}`,
      )
      console.log(`        desc="${t.description.slice(0, 80)}"`)
    }
    console.log('')
  }

  console.log('━'.repeat(80))
  console.log('RESUMO')
  console.log('━'.repeat(80))
  console.log(`  Legítimas (não tocar): ${legitima}`)
  console.log(`  🚨 DUP REAIS (limpar):  ${dupReal} · valor excedente R$ ${valorDupReal.toFixed(2)}`)
  console.log(`\n  Ambíguos / investigar manualmente: ${groups.length - legitima - dupReal}`)

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
